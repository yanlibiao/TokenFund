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

  // Step 1: install everything in one shot with long timeout
  console.log("📦 Installing Python packages + Playwright + Chromium...");
  const install = await sb.commands.run(
    "pip3 install -q open-interpreter matplotlib numpy python-docx openpyxl playwright 2>&1 | tail -3 && python3 -m playwright install chromium 2>&1 | tail -3 && python3 -m playwright install-deps chromium 2>&1 | tail -3",
    { timeoutMs: 0, requestTimeoutMs: 600_000 }
  );
  console.log(install.stdout?.slice(-500) || "no stdout");
  if (install.stderr) console.log("stderr:", install.stderr.slice(-300));

  // Step 2: verify
  console.log("🔍 Verifying...");
  const v = await sb.commands.run(
    `python3 -c "from playwright.sync_api import sync_playwright; p=sync_playwright().start(); b=p.chromium.launch(headless=True,args=['--no-sandbox']); print('chromium:',b.version); b.close(); p.stop()"`,
    { timeoutMs: 0, requestTimeoutMs: 60000 }
  );
  console.log(v.stdout?.trim() || v.stderr?.slice(0,300));

  if (!v.stdout?.includes("chromium:")) {
    console.log("⚠️ Chromium verify failed but will try anyway");
  }

  // Step 3: snapshot
  console.log("📸 Snapshot...");
  const snap = await sb.createSnapshot({ name: "tokenfund-agent-v2" });
  console.log(`✅ Snapshot: ${snap.snapshotId}`);
  console.log("Copy this to src/lib/e2b.ts");
  await sb.kill();
}

main().catch((e) => { console.error(e); process.exit(1); });
