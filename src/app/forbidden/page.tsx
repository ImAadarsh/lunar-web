import Image from "next/image";
import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="lunar-page-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-card sm:p-10">
        <Image
          src="/api/assets/logo?variant=transparent"
          alt=""
          width={48}
          height={48}
          unoptimized
          className="mx-auto rounded-xl bg-lunar-50 p-2"
          aria-hidden
        />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-lunar-600">Access denied</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">
          You don&apos;t have permission for this area
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Your account role doesn&apos;t include this route. Return to your workspace or sign in with a different
          account.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="lunar-btn-primary">
            Go to workspace
          </Link>
          <Link href="/login" className="lunar-btn-secondary">
            Sign in again
          </Link>
        </div>
      </div>
    </div>
  );
}
