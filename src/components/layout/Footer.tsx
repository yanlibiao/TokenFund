"use client";

import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border-color bg-bg-secondary mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-text-dim">
        <div className="flex flex-col items-center md:items-start gap-1">
          <p className="text-text-secondary">{t("builtWith")}</p>
          <p>{t("openSource")}</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-accent hover:no-underline transition-colors">
            {t("terms")}
          </a>
          <a href="#" className="hover:text-accent hover:no-underline transition-colors">
            {t("privacy")}
          </a>
        </div>
      </div>
    </footer>
  );
}
