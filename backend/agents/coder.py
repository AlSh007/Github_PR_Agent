from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from graph.state import AgentState, FileDiff
from tools.cost_tracker import calculate_cost
from tools.llm import invoke_structured


class CoderOutput(BaseModel):
    file_diffs: list[FileDiff]


SYSTEM = """You are an expert software engineer. Given an implementation plan, the repository context,
and the current file contents, produce the complete new content for each file that needs to change.

Rules:
- Return the full file content (not a diff patch) for each modified file
- Do not modify files not listed in the plan
- Write clean, idiomatic code with no unnecessary comments
- If creating a new file, include it in file_diffs with its full content

CRITICAL for documentation files (README, docs, etc.):
- Read the repository context carefully and extract SPECIFIC details: library names, framework names, env var names, commands, agent names, file structure
- Name exact technologies used (e.g. "LangGraph", "FastAPI", "Next.js", "Groq") — never write vague terms like "machine learning algorithms" or "cutting-edge technology"
- Use exact env var names you see in the code (e.g. GROQ_API_KEY, GITHUB_TOKEN)
- Use exact commands from config files (e.g. the actual uvicorn command, npm run dev)
- Describe the actual agents/modules by name as you find them in the code
- If you cannot find a specific detail, omit that section rather than inventing generic content"""


def coder_node(state: AgentState) -> dict:
    files_context = "\n\n".join(
        f"### {path}\n```\n{content}\n```"
        for path, content in state.get("relevant_files", {}).items()
    )
    repo_context = state.get("repo_context", "") or "No repo context available."

    user_msg = f"""Plan:
{state['plan']}

Files to modify: {', '.join(state.get('files_to_modify', []))}

Current file contents (files being changed):
{files_context or 'None — this is a new file'}

Repository context (existing codebase — use this to write accurate content):
{repo_context}

Previous review issues (if any):
{chr(10).join(state.get('review_verdict', {}).get('issues', [])) or 'None'}
"""

    messages = [SystemMessage(content=SYSTEM), HumanMessage(content=user_msg)]
    result, usage = invoke_structured(CoderOutput, messages)

    cost = calculate_cost(usage.get("input_tokens", 0), usage.get("output_tokens", 0))

    return {
        "file_diffs": result.file_diffs,
        "retry_count": state.get("retry_count", 0) + 1,
        "run_cost_usd": state.get("run_cost_usd", 0.0) + cost,
    }
