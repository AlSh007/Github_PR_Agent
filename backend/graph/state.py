from typing import Annotated, Any
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class FileDiff(TypedDict):
    path: str
    content: str  # full new file content


class ReviewVerdict(TypedDict):
    approved: bool
    issues: list[str]


class AgentState(TypedDict):
    # Input
    issue_url: str
    extra_instructions: str  # set on human revision

    # GitHub data
    issue_title: str
    issue_body: str
    repo_full_name: str   # "owner/repo"
    relevant_files: dict[str, str]  # path → current content

    # Agent outputs
    plan: str
    files_to_modify: list[str]
    acceptance_criteria: list[str]
    file_diffs: list[FileDiff]
    review_verdict: ReviewVerdict

    # Control flow
    retry_count: int
    human_decision: str   # "approved" | "rejected" | "revised"

    # Output
    pr_url: str

    # Observability
    run_cost_usd: float
    trace_id: str

    # Streaming messages for the UI
    messages: Annotated[list[Any], add_messages]
