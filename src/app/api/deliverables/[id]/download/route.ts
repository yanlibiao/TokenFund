import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/markdown": "md", "text/html": "html", "text/plain": "txt",
  "application/json": "json", "text/csv": "csv",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const d = await prisma.deliverable.findUnique({ where: { id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  prisma.deliverable.update({ where: { id }, data: { downloadCount: { increment: 1 } } }).catch(() => {});

  const url = (d.fileUrl || "").trim();
  if (!url) return new NextResponse("Empty", { status: 400 });
  if (url.startsWith("http")) return NextResponse.redirect(url);

  // data: URL
  if (url.startsWith("data:")) {
    const after = url.slice(5);
    const comma = after.indexOf(",");
    if (comma < 0) return NextResponse.json({ error: "Bad URL" }, { status: 400 });

    const header = after.slice(0, comma);
    const content = after.slice(comma + 1);
    const isBase64 = header.toLowerCase().endsWith(";base64");
    const mime = (isBase64 ? header.slice(0, -7) : header).split(";")[0] || "text/plain";

    let body: string;
    if (isBase64) {
      const binary = Buffer.from(content, "base64");
      // Use raw Response for binary — NextResponse doesn't like Uint8Array
      return new Response(binary, {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(d.title || "file")}"`,
          "Content-Length": String(binary.length),
          "Cache-Control": "public, max-age=3600",
        },
      });
    } else {
      // Text data — decode URI component
      body = decodeURIComponent(content);
    }

    const ext = MIME_TO_EXT[mime] || "txt";
    return new NextResponse(body, {
      headers: {
        "Content-Type": `${mime}; charset=utf-8`,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.title || "file")}.${ext}`,
      },
    });
  }

  return new NextResponse(url, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
