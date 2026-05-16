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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-lunar-950 p-4 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 20% 0%, rgba(70,144,188,0.35), transparent 50%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(23,54,74,0.5), transparent 45%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-lunar-400/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-1/4 h-48 w-48 rounded-full bg-lunar-600/20 blur-3xl"
        aria-hidden
      />

      <div className="relative w-full max-w-[26rem] animate-fade-up">
        <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-8 flex items-center gap-4">
            <Image
              src="/api/assets/logo?variant=transparent"
              alt="Lunar Security Logo"
              width={56}
              height={56}
              unoptimized
              className="rounded-xl bg-white/10 p-1.5 ring-1 ring-white/20"
              priority
            />
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-lunar-200">
                Lunar Security
              </p>
              <h1 className="font-display text-2xl font-bold text-white">Control panel</h1>
            </div>
          </div>

          <p className="mb-6 text-sm leading-relaxed text-lunar-100/85">
            Sign in with your operations account. Access is scoped automatically to Admin, Manager, or Staff
            permissions.
          </p>

          <LoginForm redirectTo={params.next} />
        </div>

        <p className="mt-6 text-center text-xs text-lunar-300/70">
          Secure operations platform · Endeavour Digital
        </p>
      </div>
    </div>
  );
}
