import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { fetchRecentCommits } from "@/lib/github-api";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const commits = await fetchRecentCommits("slemo54", "wine2digital-pm", 15);

    return NextResponse.json({ commits });
  } catch (error) {
    console.error("GitHub API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch commits" },
      { status: 500 }
    );
  }
}
