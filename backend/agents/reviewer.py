from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from graph.state import AgentState, ReviewVerdict
from tools.cost_tracker import extract_cost

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)


class ReviewOutput(BaseModel):
    approved: bool
    issues: list[str]


structured_llm = llm.with_structured_output(ReviewOutput, include_raw=True)

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
    response = structured_llm.invoke(messages)

    result: ReviewOutput = response["parsed"]
    cost = extract_cost(response["raw"]) + state.get("run_cost_usd", 0.0)

    return {
        "review_verdict": ReviewVerdict(
            approved=result.approved,
            issues=result.issues,
        ),
        "run_cost_usd": cost,
    }
