import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionFromCookies } from "@/lib/server-session";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSessionFromCookies();
  if (session) redirect("/");
  const params = await searchParams;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-lunar-950 p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(70,144,188,0.35),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(23,54,74,0.45),transparent_45%)]" />

      <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/api/assets/logo?variant=transparent"
            alt="Lunar Security Logo"
            width={56}
            height={56}
            unoptimized
            className="rounded-xl bg-white/10 p-1.5"
            priority
          />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-lunar-100">Lunar Security</p>
            <h1 className="text-xl font-bold text-white">Web Control Panel</h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-lunar-100/90">
          Sign in with your backend account. Access is automatically scoped to Admin, Manager, or Staff permissions.
        </p>

        <LoginForm redirectTo={params.next} />
      </div>
    </div>
  );
}

