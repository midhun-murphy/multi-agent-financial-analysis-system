from typing import TypedDict, Optional

class SessionState(TypedDict):
    """
    Represents the user session context.
    """
    session_id: str
    ticker: str
    company_name: str
    uploaded_file_path: Optional[str]
    created_at: str
