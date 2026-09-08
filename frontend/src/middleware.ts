import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/projects', '/profile', '/admin', '/notifications', '/invite'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/projects/:path*', '/profile', '/admin/:path*', '/notifications/:path*', '/invite/:path*'],
};
