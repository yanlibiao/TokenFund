import { Sandbox } from "e2b";
import "dotenv/config";

async function main() {
  if (!process.env.E2B_API_KEY) throw new Error("E2B_API_KEY not set");

  console.log("🚀 Creating sandbox...");
  const sb = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    template: "base",
    timeoutMs: 600_000,
  });
  console.log(`✅ ${sb.sandboxId}`);

  console.log("📦 Installing open-interpreter + deps... (2 min)");
  const r = await sb.commands.run(
    "pip3 install open-interpreter matplotlib numpy python-docx openpyxl 2>&1 | tail -3",
    { timeoutMs: 300000 }
  );
  console.log(r.stdout || r.stderr);

  // Verify install
  const v = await sb.commands.run(
    "python3 -c 'import interpreter; print(\"ok\")'",
    { timeoutMs: 10000 }
  );
  console.log(`Verify: ${v.stdout?.trim()}`);

  if (!v.stdout?.includes("ok")) {
    console.error("open-interpreter not installed correctly");
    console.error(v.stderr);
    await sb.kill();
    process.exit(1);
  }

  console.log("📸 Creating snapshot...");
  const snap = await sb.createSnapshot({ name: "tokenfund-agent" });

  console.log(`\n✅ DONE`);
  console.log(`Snapshot ID: ${snap.snapshotId}`);
  console.log(`\nUpdate src/lib/e2b.ts template to: "${snap.snapshotId}"`);

  await sb.kill();
}

main().catch((e) => { console.error(e); process.exit(1); });
