export interface GitHubCommit {
  sha: string;
  message: string;
  messageTitle: string; // Prima riga del messaggio
  author: string;
  date: string;
  url: string;
}

export async function fetchRecentCommits(
  owner: string,
  repo: string,
  limit = 10
): Promise<GitHubCommit[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits`;
  const params = new URLSearchParams({
    per_page: String(limit),
    page: "1",
  });

  const response = await fetch(`${url}?${params.toString()}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store", // Always fetch fresh data
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const commits = await response.json();

  return commits.map((c: any) => {
    const messageLines = (c.commit.message || "").split("\n");
    return {
      sha: c.sha,
      message: c.commit.message,
      messageTitle: messageLines[0] || "(No message)",
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url,
    };
  });
}
