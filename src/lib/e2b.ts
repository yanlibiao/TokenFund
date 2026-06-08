import { Sandbox } from "e2b";

const E2B_API_KEY = process.env.E2B_API_KEY || "";

export function hasE2BKey(): boolean {
  return E2B_API_KEY.length > 0;
}

export async function createSandbox() {
  if (!E2B_API_KEY) {
    throw new Error(
      "E2B_API_KEY not configured. Get your free key at https://e2b.dev, then add it to Vercel environment variables."
    );
  }

  return Sandbox.create({
    apiKey: E2B_API_KEY,
    template: "base",
    timeoutMs: 600_000,
  });
}

export type { Sandbox };
