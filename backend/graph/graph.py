import os
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from graph.state import AgentState
from agents.planner import planner_node
from agents.coder import coder_node
from agents.reviewer import reviewer_node
from agents.pr_writer import pr_writer_node
from graph.nodes import human_approval_node, file_fetcher_node, route_after_review, route_after_human


def build_graph(checkpointer=None):
    builder = StateGraph(AgentState)

    builder.add_node("planner", planner_node)
    builder.add_node("file_fetcher", file_fetcher_node)
    builder.add_node("coder", coder_node)
    builder.add_node("reviewer", reviewer_node)
    builder.add_node("human_approval", human_approval_node)
    builder.add_node("pr_writer", pr_writer_node)

    builder.set_entry_point("planner")
    builder.add_edge("planner", "file_fetcher")
    builder.add_edge("file_fetcher", "coder")
    builder.add_edge("coder", "reviewer")

    builder.add_conditional_edges(
        "reviewer",
        route_after_review,
        {
            "coder": "coder",
            "human_approval": "human_approval",
        },
    )

    builder.add_conditional_edges(
        "human_approval",
        route_after_human,
        {
            "pr_writer": "pr_writer",
            "planner": "planner",
            END: END,
        },
    )

    builder.add_edge("pr_writer", END)

    cp = checkpointer or MemorySaver()
    return builder.compile(
        checkpointer=cp,
        interrupt_before=["human_approval"],
    )


def _make_checkpointer():
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        try:
            import psycopg
            from langgraph.checkpoint.postgres import PostgresSaver
            with PostgresSaver.from_conn_string(db_url) as saver:
                saver.setup()
            # Return a fresh instance (connection managed per-call internally)
            return PostgresSaver.from_conn_string(db_url)
        except Exception as e:
            print(f"[warn] Postgres checkpointer failed ({e}), falling back to MemorySaver")
    return MemorySaver()


graph = build_graph(_make_checkpointer())
