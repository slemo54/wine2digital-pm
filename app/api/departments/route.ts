import { NextResponse } from "next/server";
import { getDepartments } from "@/lib/departments";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const departments = await getDepartments();
    return NextResponse.json({ departments });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}
