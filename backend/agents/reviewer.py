from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from graph.state import AgentState, ReviewVerdict
from tools.cost_tracker import calculate_cost
from tools.llm import invoke_structured


class ReviewOutput(BaseModel):
    approved: bool
    issues: list[str]


SYSTEM = """You are a senior code reviewer. Given the implementation plan, acceptance criteria,
and the proposed file changes, determine if the implementation is correct and complete.

If you find issues, list each one clearly so the coder can fix them.
Only reject if there are real correctness or completeness problems — not style preferences."""


def reviewer_node(state: AgentState) -> dict:
    diffs_context = "\n\n".join(
        f"### {d['path']}\n```\n{d['content']}\n```"
        for d in state.get("file_diffs", [])
    )

    user_msg = f"""Acceptance criteria:
{chr(10).join(f'- {c}' for c in state.get('acceptance_criteria', []))}

Proposed changes:
{diffs_context or 'No changes produced'}
"""

    messages = [SystemMessage(content=SYSTEM), HumanMessage(content=user_msg)]
    result, usage = invoke_structured(ReviewOutput, messages)

    cost = calculate_cost(usage.get("input_tokens", 0), usage.get("output_tokens", 0))

    return {
        "review_verdict": ReviewVerdict(approved=result.approved, issues=result.issues),
        "run_cost_usd": state.get("run_cost_usd", 0.0) + cost,
    }
