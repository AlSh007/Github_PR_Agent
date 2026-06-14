from langchain_core.messages import AIMessage

# Groq llama-3.3-70b-versatile pricing (per million tokens)
INPUT_COST_PER_M = 0.59
OUTPUT_COST_PER_M = 0.79


def calculate_cost(input_tokens: int, output_tokens: int) -> float:
    return (input_tokens / 1_000_000 * INPUT_COST_PER_M) + (
        output_tokens / 1_000_000 * OUTPUT_COST_PER_M
    )


def extract_cost(raw_message: AIMessage) -> float:
    usage = getattr(raw_message, "usage_metadata", None) or {}
    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)
    return calculate_cost(input_tokens, output_tokens)
