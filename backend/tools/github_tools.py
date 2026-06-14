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
