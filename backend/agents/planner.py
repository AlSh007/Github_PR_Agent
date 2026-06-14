from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from graph.state import AgentState
from tools.cost_tracker import calculate_cost
from tools.llm import invoke_structured


class PlanOutput(BaseModel):
    plan: str
    files_to_modify: list[str]
    acceptance_criteria: list[str]


SYSTEM = """You are a senior software engineer. Given a GitHub issue, produce:
1. A clear implementation plan (step-by-step)
2. The list of files that need to be modified or created
3. Acceptance criteria that the reviewer will check against

Be specific and concise. Only plan changes that are necessary to resolve the issue."""


def planner_node(state: AgentState) -> dict:
    extra = state.get("extra_instructions", "")
    repo_context = state.get("repo_context", "") or "No repo context available."

    user_msg = f"""GitHub Issue: {state['issue_title']}

{state['issue_body']}

Repository context:
{repo_context}
"""
    if extra:
        user_msg += f"\n\nAdditional instructions from human reviewer:\n{extra}"

    messages = [SystemMessage(content=SYSTEM), HumanMessage(content=user_msg)]
    result, usage = invoke_structured(PlanOutput, messages)

    cost = calculate_cost(usage.get("input_tokens", 0), usage.get("output_tokens", 0))

    return {
        "plan": result.plan,
        "files_to_modify": result.files_to_modify,
        "acceptance_criteria": result.acceptance_criteria,
        "run_cost_usd": state.get("run_cost_usd", 0.0) + cost,
    }
