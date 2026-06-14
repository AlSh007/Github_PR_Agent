import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from graph.graph import graph
from db.models import update_run

router = APIRouter()


class ApprovalRequest(BaseModel):
    decision: str           # "approved" | "rejected" | "revised"
    extra_instructions: str = ""


@router.post("/{run_id}/approve")
async def approve_run(run_id: str, body: ApprovalRequest):
    if body.decision not in ("approved", "rejected", "revised"):
        raise HTTPException(status_code=400, detail="Invalid decision value")

    config = {"configurable": {"thread_id": run_id}}
    state = graph.get_state(config)
    if state is None:
        raise HTTPException(status_code=404, detail="Run not found")

    graph.update_state(
        config,
        {
            "human_decision": body.decision,
            "extra_instructions": body.extra_instructions,
        },
    )

    try:
        result = await asyncio.to_thread(graph.invoke, None, config)
    except Exception as e:
        update_run(run_id, status="failed")
        raise HTTPException(status_code=500, detail=str(e))

    pr_url = result.get("pr_url")
    cost = result.get("run_cost_usd", 0.0)

    if body.decision == "approved" and pr_url:
        update_run(run_id, status="completed", pr_url=pr_url, cost_usd=cost)
    elif body.decision == "rejected":
        update_run(run_id, status="rejected", cost_usd=cost)
    else:
        update_run(run_id, status="awaiting_approval", cost_usd=cost)

    return {
        "run_id": run_id,
        "status": "completed" if pr_url else ("rejected" if body.decision == "rejected" else "awaiting_approval"),
        "pr_url": pr_url,
        "run_cost_usd": cost,
    }
