import os
import psycopg2
from psycopg2.extras import RealDictCursor


def _db_available() -> bool:
    return bool(os.environ.get("DATABASE_URL"))


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


def insert_run(run_id: str, issue_url: str, issue_title: str, repo: str):
    if not _db_available():
        return
    try:
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
    except Exception:
        pass


def update_run(run_id: str, status: str, pr_url: str = None, cost_usd: float = None):
    if not _db_available():
        return
    try:
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
    except Exception:
        pass


def list_runs(limit: int = 20) -> list[dict]:
    if not _db_available():
        return []
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT %s",
                    (limit,),
                )
                return [dict(r) for r in cur.fetchall()]
    except Exception:
        return []


def get_run(run_id: str) -> dict | None:
    if not _db_available():
        return None
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM agent_runs WHERE id = %s", (run_id,))
                row = cur.fetchone()
                return dict(row) if row else None
    except Exception:
        return None
