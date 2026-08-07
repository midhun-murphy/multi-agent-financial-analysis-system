import json
from typing import Dict, Any, Optional
from backend.services.llm.service import LLMService
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class BaseAgent:
    """
    Abstract/base agent structure that analytical agents inherit from.
    Provides standard parsing, logging, and LLM orchestration.
    """

    def __init__(self, agent_name: str) -> None:
        self.agent_name = agent_name
        self.llm_service = LLMService()

    def _parse_json_response(self, text: str) -> Dict[str, Any]:
        """
        Robustly extracts JSON from raw LLM responses.
        Handles markdown code blocks and loose formatting.
        """
        import time
        t_start = time.perf_counter()
        logger.info(f"[DEBUG LOG] [0.00s] Entering JSON parser")
        try:
            # Clean markdown JSON wraps
            clean_text = text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()
            parsed = json.loads(clean_text)
            t_end = time.perf_counter()
            logger.info(f"[DEBUG LOG] [{t_end - t_start:.2f}s] Exiting JSON parser. Success")
            return parsed
        except Exception as e:
            logger.error(f"Error parsing JSON from LLM text: {e}. Raw: {text}")
            return {"error": "Failed to parse JSON", "raw_response": text}
