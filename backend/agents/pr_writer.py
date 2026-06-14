from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from graph.state import AgentState
from tools.github_tools import create_pr

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)


class PRMetadata(BaseModel):
    title: str
    body: str
    branch_name: str


structured_llm = llm.with_structured_output(PRMetadata)

SYSTEM = """You are a developer writing a pull request. Given the issue and implementation plan,
produce a clear PR title, a markdown body (what changed and why, linked to the issue),
and a short git branch name (kebab-case, max 40 chars, prefix with 'agent/')."""


def pr_writer_node(state: AgentState) -> dict:
    _, issue_number = _parse_issue_number(state["issue_url"])

    user_msg = f"""Issue: {state['issue_title']}
Issue URL: {state['issue_url']}

Plan:
{state['plan']}

Files changed: {', '.join(d['path'] for d in state.get('file_diffs', []))}
"""

    messages = [SystemMessage(content=SYSTEM), HumanMessage(content=user_msg)]
    meta: PRMetadata = structured_llm.invoke(messages)

    pr_url = create_pr(
        repo_full_name=state["repo_full_name"],
        branch_name=meta.branch_name,
        pr_title=meta.title,
        pr_body=meta.body,
        issue_number=issue_number,
        file_diffs=state["file_diffs"],
    )

    return {"pr_url": pr_url}


def _parse_issue_number(issue_url: str) -> tuple[str, int]:
    import re
    match = re.search(r"github\.com/([^/]+/[^/]+)/issues/(\d+)", issue_url)
    if not match:
        raise ValueError(f"Cannot parse issue URL: {issue_url}")
    return match.group(1), int(match.group(2))
