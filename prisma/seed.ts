import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Categories
  const categories = await Promise.all([
    prisma.category.create({
      data: { nameEn: "AI Agents", nameZh: "AI 智能体", slug: "ai-agents", icon: "🤖" },
    }),
    prisma.category.create({
      data: { nameEn: "Code Generation", nameZh: "代码生成", slug: "code-gen", icon: "💻" },
    }),
    prisma.category.create({
      data: { nameEn: "Data Analysis", nameZh: "数据分析", slug: "data-analysis", icon: "📊" },
    }),
    prisma.category.create({
      data: { nameEn: "Content Creation", nameZh: "内容创作", slug: "content", icon: "✍️" },
    }),
    prisma.category.create({
      data: { nameEn: "Education", nameZh: "教育", slug: "education", icon: "📚" },
    }),
    prisma.category.create({
      data: { nameEn: "Developer Tools", nameZh: "开发者工具", slug: "dev-tools", icon: "🔧" },
    }),
    prisma.category.create({
      data: { nameEn: "Research", nameZh: "学术研究", slug: "research", icon: "🔬" },
    }),
    prisma.category.create({
      data: { nameEn: "Other", nameZh: "其他", slug: "other", icon: "📦" },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // Demo user
  const demoUser = await prisma.user.create({
    data: {
      id: "demo",
      email: "demo@tokenfund.dev",
      username: "demo",
      bio: "Platform demo account",
    },
  });
  console.log("✅ Created demo user");

  // Demo projects
  await prisma.project.create({
    data: {
      title: "Open Source AI Code Reviewer",
      summary: "Build an open-source AI-powered code review tool that runs locally. Multi-language support, actionable feedback.",
      description: `## About\n\nAn AI-powered code review tool that you can run locally on your own machine.\n\n## Features\n- Multi-language support (TypeScript, Python, Rust, Go)\n- Security vulnerability scanning\n- Style guide enforcement\n- Performance bottleneck detection\n\n## Token Budget\nWe need ~2M tokens to run evaluations across multiple codebases and iterate on prompt engineering.`,
      categoryId: categories[1].id,
      status: "FUNDING",
      tokenGoal: 2000000,
      tokenRaised: 750000,
      llmProvider: "anthropic",
      llmModel: "claude-sonnet-4-6",
      repoUrl: "https://github.com/demo/ai-code-reviewer",
      creatorId: demoUser.id,
    },
  });

  await prisma.project.create({
    data: {
      title: "Chinese Legal Document Analyzer",
      summary: "An open-source tool for analyzing Chinese legal documents using LLMs, helping citizens understand complex legal jargon.",
      description: `## About\n\nUse LLMs to translate complex Chinese legal documents into plain language.\n\n## Features\n- Legal jargon → plain language translation\n- Case law similarity search\n- Contract risk analysis\n- Full bilingual support\n\n## Token Budget\nHeavy Chinese text processing — need ~5M tokens.`,
      categoryId: categories[7].id,
      status: "FUNDING",
      tokenGoal: 5000000,
      tokenRaised: 1200000,
      llmProvider: "qwen",
      llmModel: "qwen-max",
      repoUrl: "https://github.com/demo/legal-analyzer",
      creatorId: demoUser.id,
    },
  });

  console.log("✅ Created 2 demo projects");
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
