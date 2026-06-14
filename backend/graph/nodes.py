from langgraph.graph import END
from graph.state import AgentState
from tools.github_tools import fetch_files


def file_fetcher_node(state: AgentState) -> dict:
    """Fetches file contents from GitHub for the files the planner identified."""
    files_to_modify = state.get("files_to_modify", [])
    if not files_to_modify or not state.get("repo_full_name"):
        return {}
    fetched = fetch_files(state["repo_full_name"], files_to_modify)
    return {"relevant_files": fetched}


def human_approval_node(state: AgentState) -> dict:
    # Graph pauses BEFORE this node (interrupt_before=["human_approval"]).
    # When resumed, human_decision will be set by the API route.
    return {}


def route_after_review(state: AgentState) -> str:
    verdict = state.get("review_verdict", {})
    approved = verdict.get("approved", False)
    retry_count = state.get("retry_count", 0)

    if approved:
        return "human_approval"
    if retry_count < 2:
        return "coder"
    # Max retries hit — surface to human anyway
    return "human_approval"


def route_after_human(state: AgentState) -> str:
    decision = state.get("human_decision", "rejected")
    if decision == "approved":
        return "pr_writer"
    if decision == "revised":
        return "planner"
    return END
