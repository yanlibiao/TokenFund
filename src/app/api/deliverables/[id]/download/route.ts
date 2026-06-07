import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MIME_MAP: Record<string, { mime: string; ext: string }> = {
  "text/markdown": { mime: "text/markdown; charset=utf-8", ext: "md" },
  "text/html": { mime: "text/html; charset=utf-8", ext: "html" },
  "text/plain": { mime: "text/plain; charset=utf-8", ext: "txt" },
  "application/json": { mime: "application/json; charset=utf-8", ext: "json" },
  "text/csv": { mime: "text/csv; charset=utf-8", ext: "csv" },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const d = await prisma.deliverable.findUnique({ where: { id } });
    if (!d) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Increment download count (fire-and-forget, don't block)
    prisma.deliverable.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    }).catch(() => {});

    const url = d.fileUrl;
    if (!url) {
      return new NextResponse("Empty file", { status: 400 });
    }

    // Handle data: URLs (base64 encoded content)
    if (url.startsWith("data:")) {
      const parts = url.split(";base64,");
      if (parts.length < 2) {
        // Try without base64: data:text/plain,hello
        const commaIdx = url.indexOf(",");
        const mimeType = url.slice(5, commaIdx) || "text/plain";
        const rawContent = url.slice(commaIdx + 1);
        const info = MIME_MAP[mimeType] || { mime: "text/plain; charset=utf-8", ext: "txt" };
        const buffer = Buffer.from(rawContent, "utf-8");
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": info.mime,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.title)}.${info.ext}`,
            "Content-Length": String(buffer.length),
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      const mimeType = parts[0].replace("data:", "");
      const info = MIME_MAP[mimeType] || { mime: "text/plain; charset=utf-8", ext: "txt" };

      try {
        const buffer = Buffer.from(parts[1], "base64");
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": info.mime,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.title)}.${info.ext}`,
            "Content-Length": String(buffer.length),
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch {
        // Base64 decode failed — serve raw content
        const buffer = Buffer.from(parts[1], "utf-8");
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.title)}.txt`,
            "Content-Length": String(buffer.length),
          },
        });
      }
    }

    // External URL — redirect
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return NextResponse.redirect(url);
    }

    // Fallback: serve as plain text
    const buffer = Buffer.from(url, "utf-8");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.title)}.txt`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error: any) {
    console.error("Download error:", error);
    return new NextResponse("Internal Server Error: " + (error.message || "Unknown"), {
      status: 500,
    });
  }
}
