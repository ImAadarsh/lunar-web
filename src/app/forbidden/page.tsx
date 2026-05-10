import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-lunar-600">Access denied</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">You do not have permission for this area</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account role does not include this route. Return to your workspace or sign in with a different account.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/" className="rounded-lg bg-lunar-700 px-4 py-2 text-sm font-medium text-white hover:bg-lunar-800">
            Go to workspace
          </Link>
          <Link href="/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Sign in again
          </Link>
        </div>
      </div>
    </div>
  );
}

