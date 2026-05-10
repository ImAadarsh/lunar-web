"use client";

import { useState } from "react";

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

  return (
    <form onSubmit={submit} className="space-y-4">
      {!isTwoFactor ? (
        <>
          <div className="space-y-1">
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
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 outline-none transition focus:border-lunar-300 focus:ring-2 focus:ring-lunar-300/40"
              placeholder="admin@lunarsecurity.com"
            />
          </div>

          <div className="space-y-1">
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
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 outline-none transition focus:border-lunar-300 focus:ring-2 focus:ring-lunar-300/40"
              placeholder="Enter your password"
            />
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <label className="text-sm font-medium text-white/90" htmlFor="token">
            Two-factor token
          </label>
          <input
            id="token"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 outline-none transition focus:border-lunar-300 focus:ring-2 focus:ring-lunar-300/40"
            placeholder="123456"
          />
          <p className="text-xs text-lunar-100/80">
            Two-factor authentication is enabled for this account.
          </p>
        </div>
      )}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-lunar-400 px-4 py-2.5 font-semibold text-lunar-950 transition hover:bg-lunar-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Signing in..." : isTwoFactor ? "Verify & continue" : "Sign in"}
      </button>
    </form>
  );
}

