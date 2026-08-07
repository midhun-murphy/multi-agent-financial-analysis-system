from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.database.database import get_db

router = APIRouter()

@router.get("/database/status", tags=["Database"])
async def database_status(db: Session = Depends(get_db)):
    """
    Checks database connectivity and returns confirmation in JSON format.
    """
    try:
        # Run a simple SELECT 1 query to verify connection
        db.execute(text("SELECT 1"))
        return {"message": "Database Connected"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(e)}"
        )
