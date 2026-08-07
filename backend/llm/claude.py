from typing import Optional
from backend.llm.provider import LLMProvider

class ClaudeProvider(LLMProvider):
    """
    Stub Claude provider for V2.
    """
    def generate(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        raise NotImplementedError("Claude LLM Provider is a stub for V2.")

    async def generate_async(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        raise NotImplementedError("Claude LLM Provider is a stub for V2.")
