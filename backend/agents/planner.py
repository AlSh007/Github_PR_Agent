from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from graph.state import AgentState
from tools.cost_tracker import extract_cost

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)


class PlanOutput(BaseModel):
    plan: str
    files_to_modify: list[str]
    acceptance_criteria: list[str]


structured_llm = llm.with_structured_output(PlanOutput, include_raw=True)

SYSTEM = """You are a senior software engineer. Given a GitHub issue, produce:
1. A clear implementation plan (step-by-step)
2. The list of files that need to be modified or created
3. Acceptance criteria that the reviewer will check against

Be specific and concise. Only plan changes that are necessary to resolve the issue."""


def planner_node(state: AgentState) -> dict:
    extra = state.get("extra_instructions", "")
    user_msg = f"""GitHub Issue: {state['issue_title']}

{state['issue_body']}

Repository files available:
{chr(10).join(state.get('relevant_files', {}).keys()) or 'None fetched yet'}
"""
    if extra:
        user_msg += f"\n\nAdditional instructions from human reviewer:\n{extra}"

    messages = [SystemMessage(content=SYSTEM), HumanMessage(content=user_msg)]
    response = structured_llm.invoke(messages)

    result: PlanOutput = response["parsed"]
    cost = extract_cost(response["raw"]) + state.get("run_cost_usd", 0.0)

    return {
        "plan": result.plan,
        "files_to_modify": result.files_to_modify,
        "acceptance_criteria": result.acceptance_criteria,
        "run_cost_usd": cost,
    }
