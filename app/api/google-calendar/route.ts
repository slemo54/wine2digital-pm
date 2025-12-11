import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { refreshGoogleAccessToken } from "@/lib/auth-options";
import { mapGoogleEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const CALENDAR_ID =
  process.env.GOOGLE_CALENDAR_ID ||
  "c_60cbf2a6c25a790b524153d96ece7f418b4be81b1c54d0274b33b5637e617cc8@group.calendar.google.com";

export async function GET(req: NextRequest) {
  const token = await getToken({ req });

  if (!token || !token.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const timeMin = searchParams.get("start");
  const timeMax = searchParams.get("end");

  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  // Refresh token if needed for this request (local use)
  let accessToken = token.accessToken as string;
  if ((token as any).accessTokenExpires && Date.now() > (token as any).accessTokenExpires) {
    const refreshed = await refreshGoogleAccessToken(token as any);
    if (refreshed.error || !refreshed.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    accessToken = refreshed.accessToken;
  }

  try {
    const googleRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        CALENDAR_ID
      )}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(
        timeMin
      )}&timeMax=${encodeURIComponent(timeMax)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-cache",
      }
    );

    if (!googleRes.ok) {
      const body = await googleRes.text();
      return NextResponse.json({ error: "Google API error", detail: body }, { status: 502 });
    }

    const data = await googleRes.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const events = items.map(mapGoogleEvent);

    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}

