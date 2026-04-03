import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

async function isValidAdminToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret"
    );
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Do NOT protect /api/v1/* (those use API key auth)
  // Do NOT protect /api/admin/auth (login endpoint)
  if (pathname.startsWith("/api/v1") || pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  // Protect /dashboard/* routes: redirect to /login if no valid token
  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get("admin_token")?.value;
    if (!token || !(await isValidAdminToken(token))) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Protect /api/admin/* (except /api/admin/auth handled above): return 401 if no valid token
  if (pathname.startsWith("/api/admin")) {
    const token = request.cookies.get("admin_token")?.value;
    if (!token || !(await isValidAdminToken(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/admin/:path*"],
};
