"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/layout/ThemeProvider";

export default function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { data: session } = useSession();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const otherLocale = locale === "en" ? "zh" : "en";
  const langLabel = locale === "en" ? "中文" : "English";
  const isLoggedIn = !!session?.user;
  const username = session?.user?.username || session?.user?.name || "user";
  const themeLabel = theme === "dark"
    ? locale === "zh" ? "浅色" : "Light"
    : locale === "zh" ? "深色" : "Dark";

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    await signOut({ callbackUrl: `/${locale}` });
  };

  return (
    <header className="border-b border-border-color bg-bg-secondary/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href={`/${locale}`}
          className="text-accent font-bold text-lg tracking-tight hover:no-underline hover:text-accent-dim transition-colors"
        >
          &gt; TokenFund_<span className="cursor-blink" />
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm">
          <Link href={`/${locale}/projects`} className="text-text-secondary hover:text-accent transition-colors hover:no-underline">
            {t("projects")}
          </Link>

          {isLoggedIn && (
            <Link href={`/${locale}/dashboard`} className="text-text-secondary hover:text-accent transition-colors hover:no-underline">
              {t("dashboard")}
            </Link>
          )}

          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            {themeLabel}
          </button>

          <Link href={`/${otherLocale}`} className="text-text-dim hover:text-accent transition-colors text-xs hover:no-underline">
            {langLabel}
          </Link>

          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 text-text-primary hover:text-accent transition-colors"
              >
                <span className="w-6 h-6 rounded bg-bg-tertiary border border-border-color flex items-center justify-center text-accent text-xs font-bold">
                  {username[0]?.toUpperCase() || "?"}
                </span>
                <span className="text-xs">@{username}</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 terminal-card py-1 z-50">
                  <Link
                    href={`/${locale}/dashboard`}
                    className="block px-4 py-2 text-xs text-text-secondary hover:text-accent hover:bg-bg-tertiary transition-colors hover:no-underline"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    {t("dashboard")}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-xs text-text-secondary hover:text-text-error hover:bg-bg-tertiary transition-colors"
                  >
                    {t("logout")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href={`/${locale}/auth/login`} className="text-text-secondary hover:text-accent transition-colors hover:no-underline">
                {t("login")}
              </Link>
              <Link href={`/${locale}/auth/register`} className="btn btn-primary text-sm">
                {t("register")}
              </Link>
            </>
          )}
        </nav>

        <button
          className="md:hidden text-text-primary p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-border-color bg-bg-secondary px-4 py-3 flex flex-col gap-3 text-sm">
          <Link href={`/${locale}/projects`} className="text-text-secondary hover:text-accent hover:no-underline" onClick={() => setMobileOpen(false)}>
            {t("projects")}
          </Link>

          {isLoggedIn ? (
            <>
              <Link href={`/${locale}/dashboard`} className="text-text-secondary hover:text-accent hover:no-underline" onClick={() => setMobileOpen(false)}>
                {t("dashboard")}
              </Link>
              <button onClick={handleSignOut} className="text-left text-text-secondary hover:text-text-error transition-colors">
                {t("logout")}
              </button>
            </>
          ) : (
            <>
              <Link href={`/${locale}/auth/login`} className="text-text-secondary hover:text-accent hover:no-underline" onClick={() => setMobileOpen(false)}>
                {t("login")}
              </Link>
              <Link href={`/${locale}/auth/register`} className="btn btn-primary text-center" onClick={() => setMobileOpen(false)}>
                {t("register")}
              </Link>
            </>
          )}

          <div className="pt-2 border-t border-border-color flex items-center justify-between">
            <button onClick={toggleTheme} className="theme-toggle">
              {themeLabel}
            </button>
            <Link href={`/${otherLocale}`} className="text-text-dim hover:text-accent text-xs hover:no-underline" onClick={() => setMobileOpen(false)}>
              {langLabel}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
