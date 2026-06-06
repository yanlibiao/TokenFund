import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TokenFund — Crowdfund Tokens, Build Open Source",
  description:
    "A geek platform for crowdfunding LLM tokens. Post your project, get token contributions, and build open-source software together.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg-primary text-text-secondary font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
