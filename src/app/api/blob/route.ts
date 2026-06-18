import { NextRequest, NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { requireUser } from "@/auth-server";

/**
 * Authenticated proxy for Vercel Blob objects. The browser never sees the
 * direct blob URL — it fetches `/api/blob?key=…` and this handler streams
 * the content after verifying the session.
 */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Blob storage not configured" },
      { status: 503 },
    );
  }

  try {
    const meta = await head(key, { token });
    const res = await fetch(meta.url);
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }

    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": meta.contentType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${key.split("/").pop()}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Blob not found" }, { status: 404 });
  }
}
