import { Sandbox } from "e2b";

const E2B_API_KEY = process.env.E2B_API_KEY || "";
const AGENT_TEMPLATE = "2207125716s-default-team/tokenfund-agent-v2:default";

export async function createSandbox() {
  if (!E2B_API_KEY) throw new Error("E2B_API_KEY not configured.");
  return Sandbox.create({
    apiKey: E2B_API_KEY,
    template: AGENT_TEMPLATE,
    timeoutMs: 600_000,
  });
}

export type { Sandbox };
