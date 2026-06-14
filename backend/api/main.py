import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from api.routes import runs, approval


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    if os.environ.get("DATABASE_URL"):
        try:
            from db.models import init_db
            init_db()
        except Exception as e:
            print(f"[warn] DB init failed: {e}")
    yield


app = FastAPI(title="GitHub Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs.router, prefix="/runs", tags=["runs"])
app.include_router(approval.router, prefix="/runs", tags=["approval"])


@app.get("/health")
def health():
    return {"status": "ok"}
