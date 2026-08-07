import os
import uuid
from fastapi import UploadFile
from backend.config.settings import get_settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import PDFProcessingError

logger = get_logger(__name__)

class UploadService:
    """
    Handles PDF uploading, validation (file type and size), and secure storage.
    """
    def __init__(self):
        self.settings = get_settings()
        self.upload_dir = self.settings.upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_uploaded_file(self, file: UploadFile) -> str:
        """
        Validates and saves an uploaded PDF file to disk.
        Returns the absolute path to the saved file.
        """
        logger.info(f"Validating upload: {file.filename}")
        
        # 1. Validate File Type
        if not file.filename.lower().endswith(".pdf"):
            logger.error(f"Invalid file extension: {file.filename}")
            raise PDFProcessingError(file.filename, "Only PDF files are supported.")

        # 2. Save file contents with validation
        file_id = str(uuid.uuid4())[:8]
        filename = f"{file_id}_{file.filename}"
        file_path = os.path.join(self.upload_dir, filename)

        try:
            contents = await file.read()
            
            # Validate size
            max_size_bytes = self.settings.max_upload_size_mb * 1024 * 1024
            if len(contents) > max_size_bytes:
                logger.error(f"File size {len(contents)} exceeds max limit {max_size_bytes}")
                raise PDFProcessingError(file.filename, f"File exceeds maximum upload size of {self.settings.max_upload_size_mb}MB.")

            with open(file_path, "wb") as f:
                f.write(contents)

            logger.info(f"Successfully saved uploaded file: {file_path} ({len(contents)} bytes)")
            return file_path
        except Exception as e:
            logger.error(f"Error saving uploaded file {file.filename}: {e}", exc_info=True)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
            raise PDFProcessingError(file.filename, f"Failed to save upload on disk: {str(e)}")
