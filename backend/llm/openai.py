from typing import Optional
from backend.llm.provider import LLMProvider

class OpenAIProvider(LLMProvider):
    """
    Stub OpenAI provider for V2.
    """
    def generate(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        raise NotImplementedError("OpenAI LLM Provider is a stub for V2.")

    async def generate_async(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        raise NotImplementedError("OpenAI LLM Provider is a stub for V2.")
