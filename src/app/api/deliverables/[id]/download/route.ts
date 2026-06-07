import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const d = await prisma.deliverable.findUnique({ where: { id } });
    if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Track download async
    prisma.deliverable.update({ where: { id }, data: { downloadCount: { increment: 1 } } }).catch(() => {});

    const url = (d.fileUrl || "").trim();

    // External URL
    if (url.startsWith("http")) {
      return NextResponse.redirect(url);
    }

    // data: URL
    if (url.startsWith("data:")) {
      const afterData = url.slice(5);
      const commaIdx = afterData.indexOf(",");
      if (commaIdx < 0) return NextResponse.json({ error: "Bad data URL" }, { status: 400 });

      const header = afterData.slice(0, commaIdx);
      const rawContent = afterData.slice(commaIdx + 1);
      const isBase64 = header.endsWith(";base64");
      const mimeType = (isBase64 ? header.slice(0, -7) : header).split(";")[0] || "text/plain";

      const extMap: Record<string, string> = {
        "text/markdown": "md", "text/html": "html", "text/plain": "txt",
        "application/json": "json", "text/csv": "csv",
      };
      const ext = extMap[mimeType] || "txt";
      const filename = `${encodeURIComponent(d.title || "file")}.${ext}`;

      const content = isBase64
        ? Buffer.from(rawContent, "base64").toString("utf-8")
        : decodeURIComponent(rawContent);

      // Return as string (works with all NextResponse types)
      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": `${mimeType}; charset=utf-8`,
          "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
        },
      });
    }

    // Plain text fallback
    return new NextResponse(url, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
