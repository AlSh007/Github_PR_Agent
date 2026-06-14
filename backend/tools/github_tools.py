import os
import re
from github import Github, GithubException

_gh: Github | None = None


def _client() -> Github:
    global _gh
    if _gh is None:
        token = os.environ["GITHUB_TOKEN"]
        _gh = Github(token)
    return _gh


def parse_issue_url(url: str) -> tuple[str, int]:
    """Extract 'owner/repo' and issue number from a GitHub issue URL."""
    match = re.search(r"github\.com/([^/]+/[^/]+)/issues/(\d+)", url)
    if not match:
        raise ValueError(f"Cannot parse GitHub issue URL: {url}")
    return match.group(1), int(match.group(2))


def fetch_issue(issue_url: str) -> dict:
    repo_name, issue_number = parse_issue_url(issue_url)
    repo = _client().get_repo(repo_name)
    issue = repo.get_issue(issue_number)
    return {
        "repo_full_name": repo_name,
        "issue_title": issue.title,
        "issue_body": issue.body or "",
    }


PRIORITY_FILES = [
    "README.md", "readme.md", "README.rst",
    "main.py", "app.py", "index.py", "server.py",
    "main.ts", "index.ts", "app.ts",
    "main.js", "index.js", "app.js",
    "package.json", "pyproject.toml", "setup.py",
]

MAX_FILE_CHARS = 3000  # truncate large files so we don't blow the context window


def fetch_repo_context(repo_full_name: str) -> str:
    """Return a snapshot of the repo: file tree + content of key files."""
    repo = _client().get_repo(repo_full_name)

    # Get flat file tree (up to 300 files)
    try:
        tree = repo.get_git_tree(repo.default_branch, recursive=True).tree
        all_paths = [f.path for f in tree if f.type == "blob"]
    except GithubException:
        all_paths = []

    tree_str = "\n".join(all_paths[:300])

    SKIP_EXTENSIONS = (".png", ".jpg", ".gif", ".ico", ".svg", ".woff", ".ttf", ".lock", ".pyc")
    SKIP_NAMES = ("__init__.py", ".gitignore", ".gitkeep", ".DS_Store")

    def is_substantive(path: str) -> bool:
        filename = path.split("/")[-1]
        return (
            not path.endswith(SKIP_EXTENSIONS)
            and filename not in SKIP_NAMES
            and not path.startswith("venv/")
            and not path.startswith("node_modules/")
            and not path.startswith(".git/")
        )

    # Priority files first, then substantive extras sorted by likely importance
    to_read = [p for p in PRIORITY_FILES if p in all_paths]
    extras = sorted(
        [p for p in all_paths if p not in to_read and is_substantive(p)],
        # prefer shorter paths (root-level or shallow files) and .py/.ts files
        key=lambda p: (p.count("/"), not p.endswith((".py", ".ts", ".js", ".md")))
    )
    to_read += extras[:max(0, 8 - len(to_read))]

    file_snapshots = []
    for path in to_read:
        try:
            content = repo.get_contents(path).decoded_content.decode("utf-8", errors="replace")
            if not content.strip():
                continue  # skip empty files
            if len(content) > MAX_FILE_CHARS:
                content = content[:MAX_FILE_CHARS] + "\n... (truncated)"
            file_snapshots.append(f"### {path}\n```\n{content}\n```")
        except Exception:
            pass

    return f"## File tree\n{tree_str}\n\n## Key file contents\n" + "\n\n".join(file_snapshots)


def fetch_files(repo_full_name: str, paths: list[str]) -> dict[str, str]:
    repo = _client().get_repo(repo_full_name)
    result = {}
    for path in paths:
        try:
            file = repo.get_contents(path)
            result[path] = file.decoded_content.decode("utf-8")
        except GithubException:
            result[path] = ""  # file doesn't exist yet (new file)
    return result


def create_pr(
    repo_full_name: str,
    branch_name: str,
    pr_title: str,
    pr_body: str,
    issue_number: int,
    file_diffs: list[dict],
) -> str:
    repo = _client().get_repo(repo_full_name)
    base_sha = repo.get_branch(repo.default_branch).commit.sha

    # Create branch
    repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=base_sha)

    # Commit each file
    for diff in file_diffs:
        path = diff["path"]
        content = diff["content"]
        try:
            existing = repo.get_contents(path, ref=branch_name)
            repo.update_file(
                path=path,
                message=f"agent: update {path}",
                content=content,
                sha=existing.sha,
                branch=branch_name,
            )
        except GithubException:
            repo.create_file(
                path=path,
                message=f"agent: create {path}",
                content=content,
                branch=branch_name,
            )

    # Open PR
    pr = repo.create_pull(
        title=pr_title,
        body=pr_body,
        head=branch_name,
        base=repo.default_branch,
    )
    return pr.html_url
