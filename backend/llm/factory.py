from backend.config.settings import get_settings
from backend.llm.provider import LLMProvider
from backend.llm.gemini import GeminiProvider
from backend.llm.openai import OpenAIProvider
from backend.llm.claude import ClaudeProvider
from backend.utils.logger import get_logger

logger = get_logger(__name__)

def get_llm_provider() -> LLMProvider:
    """
    Factory function returning the configured LLM provider instance.
    """
    settings = get_settings()
    provider_name = settings.llm_provider.lower()

    if provider_name == "gemini":
        logger.info("Initializing Gemini LLM Provider")
        return GeminiProvider()
    elif provider_name == "openai":
        logger.info("Initializing OpenAI LLM Provider")
        return OpenAIProvider()
    elif provider_name == "claude":
        logger.info("Initializing Claude LLM Provider")
        return ClaudeProvider()
    else:
        logger.warning(f"Unknown LLM provider: {provider_name}, defaulting to Gemini")
        return GeminiProvider()
