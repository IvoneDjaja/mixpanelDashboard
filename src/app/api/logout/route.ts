import { NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/session/sessionStore";

/**
 * POST /api/logout. Discards the server-side session and clears the cookie.
 * @param request - Incoming request.
 * @returns 204.
 */
export async function POST(request: Request) {
  const id = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  destroySession(id);
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
