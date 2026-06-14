import asyncio
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from graph.graph import graph
from tools.github_tools import fetch_issue
from db.models import insert_run, update_run, list_runs, get_run

router = APIRouter()


class RunRequest(BaseModel):
    issue_url: str


class RunResponse(BaseModel):
    run_id: str
    status: str


@router.post("", response_model=RunResponse)
async def create_run(body: RunRequest):
    try:
        issue_data = await asyncio.to_thread(fetch_issue, body.issue_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch GitHub issue: {e}")

    run_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": run_id}}

    insert_run(
        run_id=run_id,
        issue_url=body.issue_url,
        issue_title=issue_data["issue_title"],
        repo=issue_data["repo_full_name"],
    )

    initial_state = {
        "issue_url": body.issue_url,
        "extra_instructions": "",
        "issue_title": issue_data["issue_title"],
        "issue_body": issue_data["issue_body"],
        "repo_full_name": issue_data["repo_full_name"],
        "relevant_files": {},
        "retry_count": 0,
        "run_cost_usd": 0.0,
        "messages": [],
    }

    try:
        await asyncio.to_thread(graph.invoke, initial_state, config)
        update_run(run_id, status="awaiting_approval")
    except Exception as e:
        update_run(run_id, status="failed")
        raise HTTPException(status_code=500, detail=str(e))

    return RunResponse(run_id=run_id, status="awaiting_approval")


@router.get("")
def get_runs():
    return list_runs()


@router.get("/{run_id}/state")
def get_run_state(run_id: str):
    config = {"configurable": {"thread_id": run_id}}
    checkpoint_state = graph.get_state(config)
    db_run = get_run(run_id)

    if checkpoint_state is None and db_run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    values = checkpoint_state.values if checkpoint_state else {}
    return {
        "run_id": run_id,
        "status": db_run["status"] if db_run else ("awaiting_approval" if checkpoint_state and checkpoint_state.next else "completed"),
        "issue_title": values.get("issue_title"),
        "plan": values.get("plan"),
        "files_to_modify": values.get("files_to_modify"),
        "file_diffs": values.get("file_diffs"),
        "review_verdict": values.get("review_verdict"),
        "run_cost_usd": values.get("run_cost_usd", 0.0),
        "pr_url": values.get("pr_url") or (db_run or {}).get("pr_url"),
        "next_node": list(checkpoint_state.next) if checkpoint_state and checkpoint_state.next else [],
    }
