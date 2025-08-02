import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/check-users",
  "/api/auth/register-first-user",
  "/_next",
  "/favicon.ico"
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next()
  }

  // Allow static files
  if (pathname.match(/\.(png|svg|jpg|jpeg|ico|css|js)$/)) {
    return NextResponse.next()
  }

  // Validate JWT token
  const user = await validateRequest(request)
  if (!user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Add user info to headers for API routes
  const response = NextResponse.next()
  response.headers.set("x-user-id", user.userId)
  response.headers.set("x-username", user.username)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};