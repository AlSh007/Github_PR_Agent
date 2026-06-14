from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from graph.state import AgentState, FileDiff
from tools.cost_tracker import extract_cost

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)


class CoderOutput(BaseModel):
    file_diffs: list[FileDiff]


structured_llm = llm.with_structured_output(CoderOutput, include_raw=True)

SYSTEM = """You are an expert software engineer. Given an implementation plan and the current file contents,
produce the complete new content for each file that needs to change.

Rules:
- Return the full file content (not a diff patch) for each modified file
- Do not modify files not listed in the plan
- Write clean, idiomatic code with no unnecessary comments
- If creating a new file, include it in file_diffs with its full content"""


def coder_node(state: AgentState) -> dict:
    files_context = "\n\n".join(
        f"### {path}\n```\n{content}\n```"
        for path, content in state.get("relevant_files", {}).items()
    )

    user_msg = f"""Plan:
{state['plan']}

Files to modify: {', '.join(state.get('files_to_modify', []))}

Current file contents:
{files_context or 'No files fetched yet'}

Previous review issues (if any):
{chr(10).join(state.get('review_verdict', {}).get('issues', [])) or 'None'}
"""

    messages = [SystemMessage(content=SYSTEM), HumanMessage(content=user_msg)]
    response = structured_llm.invoke(messages)

    result: CoderOutput = response["parsed"]
    cost = extract_cost(response["raw"]) + state.get("run_cost_usd", 0.0)

    return {
        "file_diffs": result.file_diffs,
        "retry_count": state.get("retry_count", 0) + 1,
        "run_cost_usd": cost,
    }
