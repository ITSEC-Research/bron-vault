import { NextRequest, NextResponse } from "next/server";
import { getSecureCookieOptions, isRequestSecure } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Clear the auth cookie with same options it was set with (so browser clears it)
  response.cookies.set("auth", "", {
    ...getSecureCookieOptions(request),
    maxAge: 0,
  });

  // Clear the UI hint cookie
  response.cookies.set("user_role", "", {
    httpOnly: false,
    secure: isRequestSecure(request),
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return response;
}