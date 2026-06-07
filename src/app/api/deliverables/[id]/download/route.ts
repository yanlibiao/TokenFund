import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const d = await prisma.deliverable.findUnique({ where: { id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Increment download count
  await prisma.deliverable.update({
    where: { id },
    data: { downloadCount: { increment: 1 } },
  });

  // If fileUrl is a data URL, decode and serve
  if (d.fileUrl.startsWith("data:")) {
    const [header, b64] = d.fileUrl.split(";base64,");
    const mimeType = header.replace("data:", "");
    const ext = mimeType === "text/markdown" ? "md" :
      mimeType === "text/html" ? "html" :
      mimeType === "text/plain" ? "txt" :
      mimeType === "application/json" ? "json" : "txt";

    const buffer = Buffer.from(b64 || "", "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${d.title}.${ext}"`,
        "Content-Length": String(buffer.length),
      },
    });
  }

  // External URL — redirect
  return NextResponse.redirect(d.fileUrl);
}
