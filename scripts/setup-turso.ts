// 在 Turso 云数据库上创建所有表
import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const SQL = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "username" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT,
  "avatarUrl" TEXT,
  "bio" TEXT,
  "githubHandle" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  UNIQUE("provider", "providerAccountId")
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "expires" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expires" DATETIME NOT NULL,
  UNIQUE("identifier", "token")
);

CREATE TABLE IF NOT EXISTS "Category" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nameEn" TEXT NOT NULL,
  "nameZh" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "icon" TEXT
);

CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "tokenGoal" INTEGER NOT NULL,
  "tokenRaised" INTEGER NOT NULL DEFAULT 0,
  "llmProvider" TEXT NOT NULL,
  "llmModel" TEXT NOT NULL,
  "repoUrl" TEXT,
  "deliverablesUrl" TEXT,
  "imageUrl" TEXT,
  "creatorId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("creatorId") REFERENCES "User"("id"),
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
);

CREATE TABLE IF NOT EXISTS "Contribution" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "amount" INTEGER NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id"),
  FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE TABLE IF NOT EXISTS "TokenUsage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
);

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  "maskedKey" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE TABLE IF NOT EXISTS "TokenWallet" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "balance" INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE TABLE IF NOT EXISTS "Deliverable" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER,
  "version" TEXT NOT NULL DEFAULT '1.0',
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
);

CREATE TABLE IF NOT EXISTS "Comment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id"),
  FOREIGN KEY ("userId") REFERENCES "User"("id"),
  FOREIGN KEY ("parentId") REFERENCES "Comment"("id")
);

CREATE TABLE IF NOT EXISTS "Star" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id"),
  FOREIGN KEY ("userId") REFERENCES "User"("id"),
  UNIQUE("projectId", "userId")
);
`;

async function main() {
  console.log("🔗 Connecting to Turso...");

  // Execute SQL statements one by one
  const statements = SQL
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    try {
      await client.execute(stmt + ";");
    } catch (err: any) {
      // Ignore "already exists" errors
      if (!err.message?.includes("already exists")) {
        console.error(`  ⚠️  ${err.message?.slice(0, 80)}`);
      }
    }
  }

  console.log("✅ All tables created on Turso!");

  // Seed categories
  console.log("🌱 Seeding categories...");
  const categories = [
    ["ai-agents", "AI 智能体", null],
    ["code-gen", "代码生成", null],
    ["data-analysis", "数据分析", null],
    ["content", "内容创作", null],
    ["education", "教育", null],
    ["dev-tools", "开发者工具", null],
    ["research", "学术研究", null],
    ["other", "其他", null],
  ];
  for (const entry of categories) {
    const slug = entry[0] as string;
    const nameZh = entry[1] as string;
    const icon = entry[2] as string | null;
    const nameEn = slug.split("-")...
    await client.execute({
      sql: "INSERT OR IGNORE INTO Category (id, nameEn, nameZh, slug, icon) VALUES (?, ?, ?, ?, ?)",
      args: [slug, nameEn, nameZh, slug, icon],
    });
  }

  // Seed demo user
  await client.execute({
    sql: "INSERT OR IGNORE INTO User (id, email, username, bio) VALUES (?, ?, ?, ?)",
    args: ["demo", "demo@tokenfund.dev", "demo", "Platform demo account"],
  });

  // Seed demo projects
  await client.execute({
    sql: `INSERT OR IGNORE INTO Project (id, title, summary, description, categoryId, status, tokenGoal, tokenRaised, llmProvider, llmModel, repoUrl, creatorId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "demo-project-1", "Open Source AI Code Reviewer",
      "Build an open-source AI-powered code review tool that runs locally. Multi-language support, actionable feedback.",
      "## About\n\nAn AI-powered code review tool that you can run locally on your own machine.\n\n## Features\n- Multi-language support\n- Security scanning\n- Performance detection\n\n## Token Budget\n~2M tokens needed.",
      "code-gen", "FUNDING", 2000000, 750000, "anthropic", "claude-sonnet-4-6",
      "https://github.com/demo/ai-code-reviewer", "demo",
    ],
  });

  await client.execute({
    sql: `INSERT OR IGNORE INTO Project (id, title, summary, description, categoryId, status, tokenGoal, tokenRaised, llmProvider, llmModel, repoUrl, creatorId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "demo-project-2", "Chinese Legal Document Analyzer",
      "An open-source tool for analyzing Chinese legal documents using LLMs, helping citizens understand complex legal jargon.",
      "## About\n\nUse LLMs to translate complex Chinese legal documents into plain language.\n\n## Features\n- Legal jargon → plain language\n- Case law search\n- Contract risk analysis\n\n## Token Budget\n~5M tokens needed.",
      "other", "FUNDING", 5000000, 1200000, "qwen", "qwen-max",
      "https://github.com/demo/legal-analyzer", "demo",
    ],
  });

  console.log("✅ Seed data inserted!");
  console.log("🎉 Turso database is ready!");
}

main().catch(console.error).finally(() => process.exit(0));
