import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.api.routes import health_router, analyze_router, chat_router, export_router, database_router, auth_router
from backend.api.routes.auth import get_current_user
from backend.config.settings import get_settings
from backend.utils.logger import configure_root_logger, get_logger

# --- Settings and Logging Configuration --------------------------------------
settings = get_settings()
configure_root_logger(level=settings.log_level, production=settings.app_env == "production")
logger = get_logger(__name__)

# --- Lifespan Context Manager (Startup / Shutdown) ---------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Validate and initialize all configured storage directories
    logger.info("FastAPI application startup sequence initiated.")
    
    # 1. Ensure the MySQL database exists
    try:
        import pymysql
        from backend.database.config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
        logger.info(f"Connecting to MySQL server at {DB_HOST}:{DB_PORT} to ensure database '{DB_NAME}' exists...")
        connection = pymysql.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            user=DB_USER,
            password=DB_PASSWORD
        )
        try:
            with connection.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
            connection.commit()
            logger.info(f"Database '{DB_NAME}' checked/created successfully.")
        finally:
            connection.close()
    except Exception as db_err:
        logger.error(f"Failed to auto-create database '{DB_NAME}' using pymysql: {db_err}")

    # 2. Automatically create SQLAlchemy tables
    try:
        from backend.database.base import Base
        from backend.database.database import engine
        import backend.database.models  # Ensure models are loaded
        logger.info("Creating database tables if they do not exist...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
    except Exception as tbl_err:
        logger.error(f"Failed to initialize database tables: {tbl_err}")

    storage_dirs = [
        settings.upload_dir,
        settings.reports_dir,
        settings.exports_dir,
        settings.temp_dir,
        settings.chroma_persist_dir
    ]
    for directory in storage_dirs:
        try:
            if not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)
                logger.info(f"Storage: Created missing directory -> {directory}")
            else:
                # Validate write permissions on the storage directories
                test_file = os.path.join(directory, ".write_test")
                with open(test_file, "w") as f:
                    f.write("test")
                os.remove(test_file)
                logger.info(f"Storage: Validated permissions -> {directory}")
        except Exception as e:
            logger.critical(f"Storage: Failed to validate directory {directory} -> {e}")
            raise RuntimeError(f"Storage validation failed: {e}")

    yield

    # Shutdown: Perform cleanup actions
    logger.info("FastAPI application shutdown sequence initiated.")
    logger.info("Cleanup completed. Server shutting down.")

# --- FastAPI Application Initialization --------------------------------------
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Production-grade API for Multi-Agent Financial Statement Analysis.",
    lifespan=lifespan
)

# --- CORS Middleware Configuration -------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins if settings.cors_origins else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"]
)

# --- Custom Exception Handlers -----------------------------------------------
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.error(f"HTTP Error: {exc.detail} (Status {exc.status_code})")
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "detail": exc.detail}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"status": "error", "message": "Validation Error", "detail": exc.errors()}
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Server Exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"status": "error", "detail": "An internal server error occurred."}
    )

# --- Request / Response Logging Middleware -----------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.perf_counter()
    logger.info(f"Request started: {request.method} {request.url.path}")
    
    response = await call_next(request)
    
    duration = (time.perf_counter() - start_time) * 1000
    logger.info(f"Request finished: {request.method} {request.url.path} - Status {response.status_code} ({duration:.2f}ms)")
    return response

# --- Root Route Registration -------------------------------------------------
@app.get("/", tags=["Root"])
async def root():
    """Returns basic server status confirmation."""
    return {
        "status": "success",
        "message": "Backend Running"
    }

# --- API Router Registration -------------------------------------------------
app.include_router(health_router)
app.include_router(analyze_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(analyze_router, dependencies=[Depends(get_current_user)])  # Direct /analyze compatibility
app.include_router(chat_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(chat_router, dependencies=[Depends(get_current_user)])  # Direct /chat compatibility
app.include_router(export_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(export_router, dependencies=[Depends(get_current_user)])  # Direct /export compatibility
app.include_router(database_router)  # Direct /database/status compatibility
app.include_router(database_router, prefix="/api")
app.include_router(auth_router)
app.include_router(auth_router, prefix="/api")


# --- Secure Static Frontend Assets Serving ----------------------------------
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse
import jwt
from backend.database.config import JWT_SECRET

frontend_dir = os.path.join(os.getcwd(), "frontend")

@app.get("/static/{path:path}")
async def serve_static_files(path: str, request: Request):
    # Default to index.html if path is empty
    if not path or path == "/":
        path = "index.html"
        
    is_html_file = path.endswith(".html") or not "." in path
    is_public = path in ["login.html", "signup.html"] or not is_html_file
    
    # 1. HTML File Authorization Check
    if is_html_file and not is_public:
        token = request.cookies.get("access_token")
        authenticated = False
        if token:
            try:
                jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                authenticated = True
            except Exception:
                pass
                
        if not authenticated:
            return RedirectResponse(url="/static/login.html")
            
        # Serve authorized HTML with injected script
        filepath = os.path.join(frontend_dir, path)
        if not os.path.exists(filepath):
            filepath = os.path.join(frontend_dir, "index.html")
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Injected client-side script for JWT fetch authorization, expiry checks, and logout appending
        script_injection = f"""
        <script>
          (function() {{
            const token = "{token}";
            if (token) {{
              // Override window.fetch to inject JWT Bearer Token
              const originalFetch = window.fetch;
              window.fetch = function(input, init) {{
                init = init || {{}};
                init.headers = init.headers || {{}};
                if (init.headers instanceof Headers) {{
                  init.headers.set('Authorization', 'Bearer ' + token);
                }} else if (Array.isArray(init.headers)) {{
                  init.headers.push(['Authorization', 'Bearer ' + token]);
                }} else {{
                  init.headers['Authorization'] = 'Bearer ' + token;
                }}
                
                return originalFetch(input, init).then(response => {{
                  if (response.status === 401) {{
                    document.cookie = 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                    window.location.href = '/static/login.html?expired=true';
                  }}
                  return response;
                }});
              }};
              
              // Helper to check token expiration periodically
              try {{
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload && payload.exp) {{
                  const checkExpiry = () => {{
                    const now = Math.floor(Date.now() / 1000);
                    if (now >= payload.exp) {{
                      document.cookie = 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                      window.location.href = '/static/login.html?expired=true';
                    }}
                  }};
                  setInterval(checkExpiry, 10000);
                  checkExpiry();
                }}
              }} catch (e) {{}}
            }}
            
            // Append Log Out link to sidebar
            window.addEventListener('DOMContentLoaded', () => {{
              const appendLogout = () => {{
                const sidebarNav = document.querySelector('.sidebar-nav');
                if (sidebarNav && !document.getElementById('logout-btn')) {{
                  const navSec = document.createElement('div');
                  navSec.className = 'nav-section';
                  navSec.style.marginTop = 'auto';
                  navSec.innerHTML = `
                    <span class="nav-section-label">Account</span>
                    <a href="#" id="logout-btn" class="nav-item">
                      <svg class="lucide lucide-log-out" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      <span class="nav-item-label">Log Out</span>
                    </a>
                  `;
                  sidebarNav.appendChild(navSec);
                  
                  document.getElementById('logout-btn').addEventListener('click', async (e) => {{
                    e.preventDefault();
                    try {{
                      await fetch('/api/auth/logout', {{ method: 'POST' }});
                    }} catch(err) {{}}
                    document.cookie = 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                    window.location.href = '/static/login.html';
                  }});
                }}
              }};
              appendLogout();
              setTimeout(appendLogout, 1000);
            }});
          }})();
        </script>
        """
        
        # Inject script after head
        if "<head>" in content:
            content = content.replace("<head>", "<head>" + script_injection, 1)
        else:
            content = script_injection + content
            
        response = HTMLResponse(content=content)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        return response
        
    # 2. Public resource or static asset (css, js, assets, etc.)
    filepath = os.path.join(frontend_dir, path)
    if os.path.exists(filepath) and os.path.isfile(filepath):
        return FileResponse(filepath)
        
    return RedirectResponse(url="/static/login.html")

