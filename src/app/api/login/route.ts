import { NextResponse } from "next/server";
import { MixpanelError, verifyCredentials } from "@/lib/mixpanel/client";
import { createSession, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session/sessionStore";
import { validateLogin } from "@/lib/validation";

/**
 * POST /api/login with { user, secret, projectId, region }.
 * Verifies the credentials against Mixpanel, stores them server-side and sets an
 * httpOnly session cookie. Credentials are never returned or logged.
 * @param request - Incoming request with a JSON body.
 * @returns 204 on success, 400 for invalid input, 401 when Mixpanel rejects the
 *   credentials, or another status for upstream failures.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateLogin(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const config = {
    user: parsed.value.user,
    secret: parsed.value.secret,
    projectId: parsed.value.projectId,
    region: parsed.value.region,
  };
  try {
    await verifyCredentials(config);
  } catch (error) {
    if (error instanceof MixpanelError) {
      console.error(`/api/login Mixpanel error [${error.kind}]: ${error.message}` + (error.detail ? ` | upstream: ${error.detail}` : ""));
      if (error.kind === "auth") {
        return NextResponse.json({ error: "Mixpanel rejected these credentials" }, { status: 401 });
      }
      if (error.kind === "no_access") {
        return NextResponse.json({ error: "This Mixpanel project does not allow API access" }, { status: 403 });
      }
      if (error.kind === "rate_limit") {
        return NextResponse.json({ error: "Mixpanel rate limit reached, try again shortly" }, { status: 429 });
      }
      return NextResponse.json({ error: "Could not verify credentials with Mixpanel" }, { status: 502 });
    }
    console.error("Unexpected /api/login error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE, createSession(config), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return response;
}
