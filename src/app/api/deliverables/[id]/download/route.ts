import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const d = await prisma.deliverable.findUnique({ where: { id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  prisma.deliverable.update({ where: { id }, data: { downloadCount: { increment: 1 } } }).catch(() => {});

  const url = (d.fileUrl || "").trim();
  if (!url) return NextResponse.json({ error: "Empty" }, { status: 400 });

  // HTTP redirect
  if (url.startsWith("http")) return NextResponse.redirect(url);

  if (url.startsWith("data:")) {
    const afterData = url.slice(5);
    const commaIdx = afterData.indexOf(",");
    if (commaIdx < 0) return NextResponse.json({ error: "Bad data URL" }, { status: 400 });

    const header = afterData.slice(0, commaIdx);
    const rawContent = afterData.slice(commaIdx + 1);
    const isBase64 = header.toLowerCase().endsWith(";base64");
    const mime = (isBase64 ? header.slice(0, -7) : header).split(";")[0] || "text/plain";

    const isBinary =
      mime.includes("officedocument") ||
      mime.includes("application/vnd") ||
      mime.includes("application/zip") ||
      mime.includes("image/") ||
      mime.includes("audio/") ||
      mime.includes("video/");

    const ext = isBinary
      ? "docx"
      : { "text/markdown": "md", "text/html": "html", "text/plain": "txt", "application/json": "json", "text/csv": "csv" }[mime] || "txt";

    let body: string | Uint8Array;
    if (isBinary && isBase64) {
      // Binary: serve as-is via base64 → buffer
      body = Uint8Array.from(Buffer.from(rawContent, "base64"));
    } else if (isBinary) {
      body = Uint8Array.from(Buffer.from(rawContent, "ascii"));
    } else if (isBase64) {
      body = Buffer.from(rawContent, "base64").toString("utf-8");
    } else {
      body = decodeURIComponent(rawContent);
    }

    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.title || `file.${ext}`)}`,
      "Cache-Control": "public, max-age=3600",
    };

    if (isBinary) {
      headers["Content-Length"] = String((body as Uint8Array).length);
    }

    return new NextResponse(body as any, {
      status: 200,
      headers: headers as any,
    });
  }

  return new NextResponse(url, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
