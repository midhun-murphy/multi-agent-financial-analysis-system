from typing import Optional
from backend.llm.factory import get_llm_provider
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class LLMService:
    """
    Service wrapper around LLM provider giving simplified logging and generation interfaces.
    """

    def __init__(self) -> None:
        self.provider = get_llm_provider()

    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        response_mime_type: Optional[str] = None
    ) -> str:
        """
        Generate content from LLM synchronously.
        """
        logger.info("Requesting generation from LLM service")
        try:
            return self.provider.generate(prompt, system_instruction, response_mime_type)
        except Exception as e:
            logger.error(f"Failed to generate content: {e}", exc_info=True)
            raise e

    async def generate_async(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        response_mime_type: Optional[str] = None
    ) -> str:
        """
        Generate content from LLM asynchronously.
        """
        logger.info("Requesting async generation from LLM service")
        try:
            return await self.provider.generate_async(prompt, system_instruction, response_mime_type)
        except Exception as e:
            logger.error(f"Failed to generate content asynchronously: {e}", exc_info=True)
            raise e
