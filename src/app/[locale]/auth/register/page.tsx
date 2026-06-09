"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError(
        locale === "zh" ? "Passwords do not match" : "Passwords do not match"
      );
      return;
    }

    if (form.password.length < 8) {
      setError(
        locale === "zh"
          ? "Password must be at least 8 characters"
          : "Password must be at least 8 characters"
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error ||
            (locale === "zh" ? "婵炲鍔岄崬鑺ュ緞鏉堫偉袝" : "Registration failed")
        );
        setLoading(false);
        return;
      }

      // Auto-login after successful registration
      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      setLoading(false);

      if (signInResult?.ok) {
        router.push(`/${locale}/dashboard`);
        router.refresh();
      } else {
        // Registration succeeded but auto-login failed; redirect to login
        router.push(`/${locale}/auth/login`);
      }
    } catch {
      setLoading(false);
      setError(locale === "zh" ? "缂傚啯鍨圭划鍫曟煥濞嗘帩鍤栭柨娑樼焷椤曨剟鏌屽鍫㈡Ц" : "Network error, please retry");
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="terminal-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-accent mb-6 text-center glow-text">
          &gt; {t("register")}
        </h1>

        {error && (
          <div className="border border-text-error text-text-error px-4 py-2 rounded text-sm mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-text-dim mb-1">
              {t("username")}
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => handleChange("username", e.target.value)}
              required
              className="w-full"
              placeholder="your-handle"
              minLength={2}
              maxLength={30}
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">
              {t("email")}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
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
              onChange={(e) => handleChange("password", e.target.value)}
              required
              className="w-full"
              placeholder="password"
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
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              required
              className="w-full"
              placeholder="password"
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
          <Link
            href={`/${locale}/auth/login`}
            className="text-accent hover:underline"
          >
            {t("loginNow")}
          </Link>
        </p>
      </div>
    </div>
  );
}

