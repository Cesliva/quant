import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/signup",
    "/invite",
  ];
  
  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // Marketing/landing page is public
  if (pathname === "/" || pathname.startsWith("/(marketing)")) {
    return NextResponse.next();
  }
  
  // Auth routes are public
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // All other routes require authentication
  // The actual auth check will be done client-side using useAuth hook
  // This middleware just allows the request through
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

