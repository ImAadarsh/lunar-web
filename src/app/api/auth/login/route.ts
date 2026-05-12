import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendApi } from "@/lib/backend";
import { getSessionCookieStoreOptions, SESSION_COOKIE_NAME, type SessionData } from "@/lib/session";

type LoginBody = {
  email?: string;
  password?: string;
  preAuthToken?: string;
  token?: string;
};

type LoginData = {
  requiresTwoFactor?: boolean;
  preAuthToken?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { id: number; email: string; role: "admin" | "supervisor" | "guard" };
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as LoginBody;
  const store = await cookies();

  if (body.preAuthToken) {
    if (!body.token) return badRequest("2FA token is required.");
    const twoFa = await backendApi<LoginData>("/auth/login/2fa", {
      method: "POST",
      body: { preAuthToken: body.preAuthToken, token: body.token },
    });
    if (!twoFa.ok || !twoFa.data?.accessToken || !twoFa.data?.refreshToken || !twoFa.data.user) {
      return NextResponse.json(
        { error: twoFa.error?.message ?? "Two-factor verification failed." },
        { status: twoFa.status || 401 },
      );
    }
    const session: SessionData = {
      accessToken: twoFa.data.accessToken,
      refreshToken: twoFa.data.refreshToken,
      user: twoFa.data.user,
    };
    store.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
      ...getSessionCookieStoreOptions(),
    });
    return NextResponse.json({ success: true, user: session.user });
  }

  if (!body.email || !body.password) return badRequest("Email and password are required.");
  const login = await backendApi<LoginData>("/auth/login", {
    method: "POST",
    body: { email: body.email, password: body.password },
  });

  if (!login.ok || !login.data) {
    return NextResponse.json(
      { error: login.error?.message ?? "Login failed." },
      { status: login.status || 401 },
    );
  }

  if (login.data.requiresTwoFactor && login.data.preAuthToken) {
    return NextResponse.json({
      requiresTwoFactor: true,
      preAuthToken: login.data.preAuthToken,
      user: login.data.user ?? null,
    });
  }

  if (!login.data.accessToken || !login.data.refreshToken || !login.data.user) {
    return NextResponse.json({ error: "Unexpected login response." }, { status: 500 });
  }

  const session: SessionData = {
    accessToken: login.data.accessToken,
    refreshToken: login.data.refreshToken,
    user: login.data.user,
  };
  store.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    ...getSessionCookieStoreOptions(),
  });

  return NextResponse.json({ success: true, user: session.user });
}

