import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# URL-encode credentials to handle special characters (e.g. '@' in passwords)
quoted_user = urllib.parse.quote_plus(DB_USER)
quoted_password = urllib.parse.quote_plus(DB_PASSWORD)

DATABASE_URL = f"mysql+pymysql://{quoted_user}:{quoted_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
