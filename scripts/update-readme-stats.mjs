import { writeFile } from "node:fs/promises";

const username = "khainhq";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const headers = {
  "Accept": "application/vnd.github+json",
  "User-Agent": "khainhq-readme-stats",
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function graphql(query, variables = {}) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GraphQL failed: ${response.status} ${await response.text()}`);
  }
  const result = await response.json();
  if (result.errors) {
    throw new Error(JSON.stringify(result.errors));
  }
  return result.data;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pct(value, total) {
  return total ? ((value / total) * 100).toFixed(2) : "0.00";
}

function statsCard(stats) {
  const items = [
    ["☆", "#ff5555", "Total Stars Earned:", stats.stars],
    ["◷", "#ffb86c", "Total Commits:", stats.contributions],
    ["⑂", "#ff79c6", "Total PRs:", stats.pullRequests],
    ["ⓘ", "#8be9fd", "Total Issues:", stats.issues],
    ["▣", "#50fa7b", "Public Repositories:", stats.repos],
    ["◉", "#bd93f9", "Followers:", stats.followers],
  ];

  const rows = items.map(([icon, color, label, value], index) => {
    const y = 62 + index * 23;
    return `
    <text x="28" y="${y}" fill="${color}" font-size="16">${icon}</text>
    <text x="54" y="${y}" fill="#f8f8f2" font-size="13" font-weight="700">${escapeXml(label)}</text>
    <text x="206" y="${y}" fill="#f8f8f2" font-size="13" font-weight="700">${escapeXml(value)}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="190" viewBox="0 0 420 190" role="img" aria-labelledby="title desc">
  <title id="title">Nguyen Ho Quang Khai GitHub Stats</title>
  <desc id="desc">Realtime GitHub statistics card for khainhq.</desc>
  <rect x="1" y="1" width="418" height="188" rx="6" fill="#282a36" stroke="#44475a" stroke-width="1"/>
  <g font-family="Segoe UI, Ubuntu, Helvetica Neue, Arial, sans-serif">
    <text x="24" y="34" fill="#f8f8f2" font-size="18" font-weight="700">Nguyen Ho Quang Khai's GitHub Stats</text>${rows}
    <circle cx="338" cy="102" r="43" fill="#f8f8f2" opacity=".14"/>
    <circle cx="338" cy="102" r="31" fill="#f8f8f2"/>
    <path d="M338 72c-17 0-31 14-31 31 0 14 9 26 22 30 2 0 3-1 3-2v-9c-9 2-11-4-11-4-1-4-3-5-3-5-3-2 0-2 0-2 3 0 5 3 5 3 3 5 8 4 10 3 0-2 1-4 2-5-7-1-15-4-15-15 0-3 1-6 3-8 0-1-1-4 0-8 0 0 3-1 9 3 3-1 5-1 8-1s6 0 8 1c6-4 9-3 9-3 2 4 1 7 0 8 2 2 3 5 3 8 0 11-7 14-15 15 1 1 2 3 2 6v13c0 1 1 2 3 2 13-4 22-16 22-30-3-17-17-31-34-31z" fill="#282a36"/>
  </g>
</svg>
`;
}

function languageCard(languages) {
  const colors = {
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    HTML: "#e34c26",
    CSS: "#663399",
    TypeScript: "#3178c6",
    Java: "#b07219",
    "C#": "#178600",
    Shell: "#89e051",
    Dockerfile: "#384d54",
    Vue: "#41b883",
    SCSS: "#c6538c",
    "Jupyter Notebook": "#DA5B0B",
  };
  const fallback = ["#ff79c6", "#50fa7b", "#8be9fd", "#ffb86c", "#bd93f9", "#ff5555", "#f1fa8c", "#6272a4"];
  const total = languages.reduce((sum, lang) => sum + lang.count, 0);
  const top = languages.slice(0, 8);
  let x = 24;
  const rawWidths = top.map((lang) => total ? Math.round((lang.count / total) * 372) : 0);
  const widthTotal = rawWidths.reduce((sum, width) => sum + width, 0);
  if (rawWidths.length && widthTotal !== 372) {
    rawWidths[rawWidths.length - 1] += 372 - widthTotal;
  }
  const segments = top.map((lang, index) => {
    const width = Math.max(1, rawWidths[index]);
    const segment = `<rect x="${x}" y="56" width="${width}" height="8" ${index === 0 ? 'rx="4"' : ""} fill="${colors[lang.name] || fallback[index % fallback.length]}"/>`;
    x += width;
    return segment;
  }).join("\n    ");
  const rows = top.map((lang, index) => {
    const colX = index % 2 === 0 ? 24 : 222;
    const rowY = 91 + Math.floor(index / 2) * 25;
    return `<circle cx="${colX + 6}" cy="${rowY - 4}" r="5" fill="${colors[lang.name] || fallback[index % fallback.length]}"/>
    <text x="${colX + 20}" y="${rowY}" fill="#f8f8f2" font-size="12">${escapeXml(lang.name)} ${pct(lang.count, total)}%</text>`;
  }).join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="190" viewBox="0 0 420 190" role="img" aria-labelledby="title desc">
  <title id="title">Most Used Languages</title>
  <desc id="desc">Realtime most used repository languages for khainhq.</desc>
  <rect x="1" y="1" width="418" height="188" rx="6" fill="#282a36" stroke="#44475a" stroke-width="1"/>
  <g font-family="Segoe UI, Ubuntu, Helvetica Neue, Arial, sans-serif">
    <text x="24" y="34" fill="#f8f8f2" font-size="18" font-weight="700">Most Used Languages</text>
    ${segments}
    ${rows}
    <text x="24" y="176" fill="#6272a4" font-size="11">Updated from public GitHub repository data.</text>
  </g>
</svg>
`;
}

const user = await github(`/users/${username}`);
const repos = await github(`/users/${username}/repos?per_page=100&type=owner&sort=updated`);
const data = await graphql(`
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
        }
      }
      pullRequests {
        totalCount
      }
      issues {
        totalCount
      }
    }
  }
`, { login: username });

const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
const languageCounts = new Map();
for (const repo of repos) {
  const repoLanguages = await github(`/repos/${username}/${repo.name}/languages`);
  for (const [language, bytes] of Object.entries(repoLanguages)) {
    languageCounts.set(language, (languageCounts.get(language) || 0) + bytes);
  }
}

const languages = [...languageCounts.entries()]
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

await writeFile("github-stats-card-20260711.svg", statsCard({
  stars,
  contributions: data.user.contributionsCollection.contributionCalendar.totalContributions,
  pullRequests: data.user.pullRequests.totalCount,
  issues: data.user.issues.totalCount,
  repos: user.public_repos,
  followers: user.followers,
}), "utf8");

await writeFile("most-used-languages-card-20260711.svg", languageCard(languages), "utf8");
