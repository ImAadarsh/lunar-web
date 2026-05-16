"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type LoginFormProps = {
  redirectTo?: string;
};

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isTwoFactor = preAuthToken !== null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = isTwoFactor
        ? { preAuthToken, token }
        : { email: email.trim(), password };
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        requiresTwoFactor?: boolean;
        preAuthToken?: string;
      };

      if (!res.ok) {
        setError(json.error ?? "Login failed. Please try again.");
        return;
      }

      if (json.requiresTwoFactor && json.preAuthToken) {
        setPreAuthToken(json.preAuthToken);
        return;
      }

      window.location.href = redirectTo || "/";
    } catch {
      setError("Unable to reach server. Check backend connection.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition duration-200 hover:border-white/25 focus:border-lunar-300 focus:bg-white/10 focus:ring-2 focus:ring-lunar-300/30";

  return (
    <form onSubmit={submit} className="space-y-4">
      {!isTwoFactor ? (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/90" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              placeholder="admin@lunarsecurity.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/90" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              placeholder="Enter your password"
            />
          </div>
        </>
      ) : (
        <div className="space-y-1.5 animate-fade-in">
          <label className="text-sm font-medium text-white/90" htmlFor="token">
            Two-factor code
          </label>
          <input
            id="token"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className={cn(fieldClass, "text-center text-lg tracking-[0.3em]")}
            placeholder="• • • • • •"
          />
          <p className="text-xs text-lunar-100/75">Enter the code from your authenticator app.</p>
        </div>
      )}

      {error ? (
        <p className="animate-fade-in rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className={cn(
          "lunar-btn w-full bg-lunar-400 text-lunar-950 hover:bg-lunar-300 hover:shadow-glow",
          loading && "lunar-shimmer",
        )}
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-lunar-800/30 border-t-lunar-950" />
            {isTwoFactor ? "Verifying…" : "Signing in…"}
          </>
        ) : isTwoFactor ? (
          "Verify & continue"
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
