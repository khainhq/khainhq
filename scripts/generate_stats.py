from __future__ import annotations

import html
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"

USERNAME = "khainhq"
DISPLAY_NAME = "Nguyen Ho Quang Khai"
USER_AGENT = "khainhq-profile-stats"
COMMIT_COUNT_OFFSET = 44
STATS_COMMIT_MESSAGE = "Update realtime profile stats"


def github_json(path: str):
    token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = Request(f"https://api.github.com{path}", headers=headers)
    with urlopen(request, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
        links = response.headers.get("Link", "")
        return data, links


def github_count(path: str) -> int:
    try:
        data, links = github_json(f"{path}{'&' if '?' in path else '?'}per_page=1")
    except HTTPError:
        return 0

    match = re.search(r"[?&]page=(\d+)>;\s*rel=\"last\"", links)
    if match:
        return int(match.group(1))
    return len(data) if isinstance(data, list) else 0


def all_owner_repos() -> list[dict]:
    repos: list[dict] = []
    page = 1
    while True:
        query = urlencode(
            {
                "type": "owner",
                "sort": "updated",
                "per_page": 100,
                "page": page,
            }
        )
        batch, _ = github_json(f"/users/{USERNAME}/repos?{query}")
        if not batch:
            return repos
        repos.extend(repo for repo in batch if not repo.get("fork"))
        if len(batch) < 100:
            return repos
        page += 1


def commit_count(repos: list[dict]) -> int:
    total = 0
    for repo in repos:
        name = repo["name"]
        page = 1
        while True:
            query = urlencode({"author": USERNAME, "per_page": 100, "page": page})
            commits, _ = github_json(f"/repos/{USERNAME}/{name}/commits?{query}")
            if not commits:
                break
            for commit in commits:
                message = commit.get("commit", {}).get("message", "")
                if message.strip() != STATS_COMMIT_MESSAGE:
                    total += 1
            if len(commits) < 100:
                break
            page += 1
    return total + COMMIT_COUNT_OFFSET


def language_totals(repos: list[dict]) -> list[tuple[str, int]]:
    totals: dict[str, int] = {}
    for repo in repos:
        name = repo["name"]
        try:
            languages, _ = github_json(f"/repos/{USERNAME}/{name}/languages")
        except HTTPError:
            continue
        for language, byte_count in languages.items():
            totals[language] = totals.get(language, 0) + int(byte_count)
    return sorted(totals.items(), key=lambda item: (-item[1], item[0]))


def search_count(query: str) -> int:
    encoded = urlencode({"q": query, "per_page": 1})
    data, _ = github_json(f"/search/issues?{encoded}")
    return int(data.get("total_count", 0))


def fmt(value: int) -> str:
    return f"{value:,}"


def color_for_language(language: str, index: int) -> str:
    colors = {
        "Python": "#3572A5",
        "JavaScript": "#f1e05a",
        "TypeScript": "#3178c6",
        "Java": "#b07219",
        "C#": "#178600",
        "HTML": "#e34c26",
        "CSS": "#663399",
        "Shell": "#89e051",
        "Dockerfile": "#384d54",
        "Jupyter Notebook": "#DA5B0B",
    }
    fallback = ["#ff79c6", "#50fa7b", "#8be9fd", "#ffb86c", "#bd93f9", "#ff5555", "#f1fa8c"]
    return colors.get(language, fallback[index % len(fallback)])


def stats_svg(stats: dict[str, int]) -> str:
    rows = [
        ("Stars", stats["stars"], "#ff5555"),
        ("Commits", stats["commits"], "#ffb86c"),
        ("Pull Requests", stats["pull_requests"], "#ff79c6"),
        ("Issues", stats["issues"], "#8be9fd"),
        ("Public Repos", stats["repos"], "#50fa7b"),
        ("Followers", stats["followers"], "#bd93f9"),
    ]
    body = []
    for index, (label, value, color) in enumerate(rows):
        y = 68 + index * 23
        body.append(
            f'<circle cx="32" cy="{y - 4}" r="5" fill="{color}"/>'
            f'<text x="52" y="{y}" fill="#f8f8f2" font-size="13" font-weight="700">{html.escape(label)}</text>'
            f'<text x="232" y="{y}" fill="#f8f8f2" font-size="13" font-weight="700">{fmt(value)}</text>'
        )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="420" height="190" viewBox="0 0 420 190" role="img" aria-labelledby="title desc">
  <title id="title">{html.escape(DISPLAY_NAME)} GitHub Stats</title>
  <desc id="desc">GitHub statistics generated from the GitHub API.</desc>
  <rect x="1" y="1" width="418" height="188" rx="6" fill="#282a36" stroke="#44475a" stroke-width="1"/>
  <g font-family="Segoe UI, Ubuntu, Helvetica Neue, Arial, sans-serif">
    <text x="24" y="36" fill="#f8f8f2" font-size="18" font-weight="700">{html.escape(DISPLAY_NAME)}'s GitHub Stats</text>
    {''.join(body)}
  </g>
</svg>
"""


def languages_svg(languages: list[tuple[str, int]]) -> str:
    top = languages[:8]
    total = sum(count for _, count in top)
    x = 24
    segments = []
    rows = []
    widths = [round((count / total) * 372) if total else 0 for _, count in top]
    if widths:
        widths[-1] += 372 - sum(widths)

    for index, ((language, count), width) in enumerate(zip(top, widths)):
        color = color_for_language(language, index)
        width = max(1, width)
        segments.append(f'<rect x="{x}" y="56" width="{width}" height="8" fill="{color}"/>')
        x += width

        row_x = 24 if index % 2 == 0 else 222
        row_y = 92 + (index // 2) * 25
        percent = (count / total) * 100 if total else 0
        rows.append(
            f'<circle cx="{row_x + 6}" cy="{row_y - 4}" r="5" fill="{color}"/>'
            f'<text x="{row_x + 20}" y="{row_y}" fill="#f8f8f2" font-size="12">{html.escape(language)} {percent:.1f}%</text>'
        )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="420" height="190" viewBox="0 0 420 190" role="img" aria-labelledby="title desc">
  <title id="title">Most Used Languages</title>
  <desc id="desc">Repository language statistics generated from the GitHub API.</desc>
  <rect x="1" y="1" width="418" height="188" rx="6" fill="#282a36" stroke="#44475a" stroke-width="1"/>
  <g font-family="Segoe UI, Ubuntu, Helvetica Neue, Arial, sans-serif">
    <text x="24" y="36" fill="#f8f8f2" font-size="18" font-weight="700">Most Used Languages</text>
    {''.join(segments)}
    {''.join(rows)}
  </g>
</svg>
"""


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    user, _ = github_json(f"/users/{USERNAME}")
    repos = all_owner_repos()
    stats = {
        "stars": sum(int(repo["stargazers_count"]) for repo in repos),
        "commits": commit_count(repos),
        "pull_requests": search_count(f"author:{USERNAME} type:pr"),
        "issues": search_count(f"author:{USERNAME} type:issue"),
        "repos": int(user["public_repos"]),
        "followers": int(user["followers"]),
    }
    languages = language_totals(repos)
    (ASSETS / "github-stats.svg").write_text(stats_svg(stats), encoding="utf-8", newline="\n")
    (ASSETS / "top-languages.svg").write_text(languages_svg(languages), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
