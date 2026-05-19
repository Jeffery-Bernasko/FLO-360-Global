import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/sign-in", "/api/auth"];
const PASSWORD_SETUP_PATH = "/change-password";

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (isPublic) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.id) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (token.mustChangePassword && pathname !== PASSWORD_SETUP_PATH) {
    const changePasswordUrl = new URL(PASSWORD_SETUP_PATH, req.nextUrl.origin);
    changePasswordUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(changePasswordUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
