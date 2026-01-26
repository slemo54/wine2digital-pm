import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// GitHub repository info
const GITHUB_OWNER = "slemo54";
const GITHUB_REPO = "wine2digital-pm";

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
}

export async function GET() {
  // Only admins can see changelog
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string | undefined;
  const role = ((session.user as any).role as string | undefined) || "member";

  if (!userId || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Fetch last 30 commits from GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=30`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Wine2Digital-PM",
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      // If rate limited or error, return empty array
      console.error("GitHub API error:", response.status, await response.text());
      return NextResponse.json({ commits: [], error: "GitHub API unavailable" });
    }

    const commits: GitHubCommit[] = await response.json();

    // Extract only the title (first line of commit message)
    const changelog = commits.map((commit) => ({
      sha: commit.sha.slice(0, 7),
      title: commit.commit.message.split("\n")[0],
      date: commit.commit.author.date,
      url: commit.html_url,
    }));

    return NextResponse.json({ commits: changelog });
  } catch (error) {
    console.error("Changelog fetch error:", error);
    return NextResponse.json({ commits: [], error: "Failed to fetch changelog" });
  }
}
