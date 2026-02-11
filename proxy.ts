import { NextRequest, NextResponse } from "next/server"
import { auth } from "./lib/auth"
import { db } from "./db/drizzle"
import { app_users } from "./db/schema"
import { eq } from "drizzle-orm"
import arcjet, { createMiddleware, detectBot } from "@arcjet/next"

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:MONITOR",
        "CATEGORY:PREVIEW",
      ],
    }),
  ],
})

async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 1. Skip static files
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next()
  }

  // 2. Get user session
  const session = await auth.api.getSession({ headers: request.headers })
  const isLoggedIn = !!session?.user

  const publicPaths = [
  "/",
  "/signin",
  "/signup",
  "/forgot-password",  // ← Added
  "/reset-password",   // ← Added
  "/courses",
  "/course",
]
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))

  // Redirect logged out users to signin
  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/signin", request.url))
  }

  if (!isLoggedIn) return NextResponse.next()

  // 3. Fetch user profile
  const userProfile = await db
    .select({
      id: app_users.id,
      role: app_users.role,
    })
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .limit(1)
    .then((rows) => rows[0])

  const hasProfile = !!userProfile
  const userRole = userProfile?.role

  // 4. Require profile creation
  const requiresProfile =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/learn") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/instructor")

  if (requiresProfile && !hasProfile) {
    return NextResponse.redirect(new URL("/onboarding", request.url))
  }

  // 5. Prevent accessing onboarding if profile exists
  if (hasProfile && pathname === "/onboarding") {
    // Redirect to role-specific dashboard
    const redirectUrl = getRoleBasedRedirect(userRole)
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  // 6. Role-based access control
  if (hasProfile) {
    // Admin access
    if (pathname.startsWith("/admin") && userRole !== "admin") {
      const redirectUrl = getRoleBasedRedirect(userRole)
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Instructor access
    if (pathname.startsWith("/instructor") && userRole !== "instructor" && userRole !== "admin") {
      const redirectUrl = getRoleBasedRedirect(userRole)
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Redirect /dashboard to role-specific page
    if (pathname === "/dashboard") {
      const redirectUrl = getRoleBasedRedirect(userRole)
      if (redirectUrl !== "/dashboard") {
        return NextResponse.redirect(new URL(redirectUrl, request.url))
      }
    }
  }

  return NextResponse.next()
}

// Helper function to get role-based redirect URL
function getRoleBasedRedirect(role?: string): string {
  switch (role) {
    case "admin":
      return "/admin"
    case "instructor":
      return "/instructor"
    case "student":
    default:
      return "/dashboard"
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}

export default createMiddleware(aj, authMiddleware);