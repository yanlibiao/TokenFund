"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    setLoading(true);
    // TODO: Implement registration
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="terminal-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-accent mb-6 text-center glow-text">
          &gt; {t("register")}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-text-dim mb-1">
              {t("username")}
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              className="w-full"
              placeholder="your-handle"
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">
              {t("email")}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">
              {t("password")}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full"
              placeholder="••••••••"
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">
              {t("confirmPassword")}
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              required
              className="w-full"
              placeholder="••••••••"
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? "..." : t("register")}
          </button>
        </form>

        <p className="text-center text-xs text-text-dim mt-6">
          {t("hasAccount")}{" "}
          <Link href={`/${locale}/auth/login`} className="text-accent hover:underline">
            {t("loginNow")}
          </Link>
        </p>
      </div>
    </div>
  );
}
