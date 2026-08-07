from abc import ABC, abstractmethod
from typing import Optional

class LLMProvider(ABC):
    """
    Abstract base class defining the standard interface for LLM providers.
    """

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        response_mime_type: Optional[str] = None
    ) -> str:
        """
        Generate a text response for the given prompt.
        """
        pass

    @abstractmethod
    async def generate_async(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        response_mime_type: Optional[str] = None
    ) -> str:
        """
        Asynchronously generate a text response for the given prompt.
        """
        pass
