import { NextRequest, NextResponse } from "next/server";
import { getSecureCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Clear the auth cookie with consistent secure options
  response.cookies.set("auth", "", {
    ...getSecureCookieOptions(),
    maxAge: 0, // Override maxAge to 0 to clear the cookie
  });

  return response;
}