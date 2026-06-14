import time
from typing import TypeVar, Type
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage

T = TypeVar("T", bound=BaseModel)

_llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)


def invoke_structured(
    schema: Type[T],
    messages: list[BaseMessage],
    max_retries: int = 3,
) -> tuple[T, dict]:
    """
    Call Groq with structured output and return (parsed_result, usage_metadata).
    Retries on tool_use_failed errors which Groq occasionally throws even for valid output.
    """
    structured = _llm.with_structured_output(schema, include_raw=True)

    last_err = None
    for attempt in range(max_retries):
        try:
            response = structured.invoke(messages)
            parsed = response["parsed"]
            raw = response["raw"]
            usage = getattr(raw, "usage_metadata", {}) or {}
            return parsed, usage
        except Exception as e:
            last_err = e
            err_str = str(e)
            # Only retry on Groq tool_use_failed (400) — fail fast on auth/quota errors
            if "tool_use_failed" in err_str or "400" in err_str:
                wait = 1.5 ** attempt
                time.sleep(wait)
                continue
            raise

    raise RuntimeError(f"LLM call failed after {max_retries} attempts: {last_err}")
