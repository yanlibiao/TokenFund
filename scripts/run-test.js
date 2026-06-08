const { Sandbox } = require("e2b");
const fs = require("fs");
const path = require("path");

async function main() {
  const sb = await Sandbox.create({
    apiKey: "e2b_ad233dcd1454e5ec37f9eb8c0cb6564ead701b84",
    template: "2207125716s-default-team/tokenfund-agent-v2:default",
    timeoutMs: 600000,
  });
  console.log("Sandbox:", sb.sandboxId);

  const scriptFile = path.join(__dirname, "..", "test_task.py");
  const script = fs.readFileSync(scriptFile, "utf8");
  console.log("Script size:", script.length);

  await sb.files.write("/home/user/task.py", script);
  console.log("Uploaded. Running...");

  const r = await sb.commands.run("cd /home/user && python3 -u task.py 2>&1", {
    timeoutMs: 300000,
  });
  console.log(r.stdout);
  if (r.stderr) console.log("STDERR:", r.stderr.slice(0, 800));
  console.log("Exit:", r.exitCode);

  // Check files
  const r2 = await sb.commands.run("ls -la /home/user/*.csv /home/user/*.md /home/user/*.png /home/user/*.docx 2>&1", { timeoutMs: 5000 });
  console.log("Files:", r2.stdout);

  await sb.kill();
}
main().catch((e) => console.error(e));
