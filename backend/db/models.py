import os
import psycopg2
from psycopg2.extras import RealDictCursor


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


CREATE_RUNS_TABLE = """
CREATE TABLE IF NOT EXISTS agent_runs (
    id          TEXT PRIMARY KEY,
    issue_url   TEXT NOT NULL,
    issue_title TEXT,
    repo        TEXT,
    status      TEXT NOT NULL DEFAULT 'running',
    pr_url      TEXT,
    cost_usd    NUMERIC(10, 6) DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
"""


def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(CREATE_RUNS_TABLE)
        conn.commit()


def upsert_run(run_id: str, **fields):
    if not fields:
        return
    set_clauses = ", ".join(f"{k} = %s" for k in fields)
    set_clauses += ", updated_at = NOW()"
    values = list(fields.values()) + [run_id]
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO agent_runs (id, {', '.join(fields.keys())})
                VALUES (%s, {', '.join(['%s'] * len(fields))})
                ON CONFLICT (id) DO UPDATE SET {set_clauses}
                """,
                [run_id] + list(fields.values()) + list(fields.values()) + [run_id],
            )
        conn.commit()


def insert_run(run_id: str, issue_url: str, issue_title: str, repo: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO agent_runs (id, issue_url, issue_title, repo, status)
                VALUES (%s, %s, %s, %s, 'running')
                ON CONFLICT (id) DO NOTHING
                """,
                (run_id, issue_url, issue_title, repo),
            )
        conn.commit()


def update_run(run_id: str, status: str, pr_url: str = None, cost_usd: float = None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE agent_runs
                SET status = %s,
                    pr_url = COALESCE(%s, pr_url),
                    cost_usd = COALESCE(%s, cost_usd),
                    updated_at = NOW()
                WHERE id = %s
                """,
                (status, pr_url, cost_usd, run_id),
            )
        conn.commit()


def list_runs(limit: int = 20) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT %s",
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]


def get_run(run_id: str) -> dict | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM agent_runs WHERE id = %s", (run_id,))
            row = cur.fetchone()
            return dict(row) if row else None
