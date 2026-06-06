"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";

export default function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  const otherLocale = locale === "en" ? "zh" : "en";
  const langLabel = locale === "en" ? "中文" : "English";

  return (
    <header className="border-b border-border-color bg-bg-secondary/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="text-accent font-bold text-lg tracking-tight hover:no-underline hover:text-accent-dim transition-colors"
        >
          &gt; TokenFund_
          <span className="cursor-blink" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link
            href={`/${locale}/projects`}
            className="text-text-secondary hover:text-accent transition-colors hover:no-underline"
          >
            {t("projects")}
          </Link>
          <Link
            href={`/${otherLocale}`}
            className="text-text-dim hover:text-accent transition-colors text-xs hover:no-underline"
          >
            {langLabel}
          </Link>
          <Link
            href={`/${locale}/auth/login`}
            className="text-text-secondary hover:text-accent transition-colors hover:no-underline"
          >
            {t("login")}
          </Link>
          <Link
            href={`/${locale}/auth/register`}
            className="btn btn-primary text-sm"
          >
            {t("register")}
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-text-primary p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border-color bg-bg-secondary px-4 py-3 flex flex-col gap-3 text-sm">
          <Link
            href={`/${locale}/projects`}
            className="text-text-secondary hover:text-accent hover:no-underline"
            onClick={() => setMobileOpen(false)}
          >
            {t("projects")}
          </Link>
          <Link
            href={`/${locale}/auth/login`}
            className="text-text-secondary hover:text-accent hover:no-underline"
            onClick={() => setMobileOpen(false)}
          >
            {t("login")}
          </Link>
          <Link
            href={`/${locale}/auth/register`}
            className="btn btn-primary text-center"
            onClick={() => setMobileOpen(false)}
          >
            {t("register")}
          </Link>
          <Link
            href={`/${otherLocale}`}
            className="text-text-dim hover:text-accent text-xs hover:no-underline"
            onClick={() => setMobileOpen(false)}
          >
            {langLabel}
          </Link>
        </nav>
      )}
    </header>
  );
}
