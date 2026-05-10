type ApiErrorNoticeProps = {
  errors: Array<string | null | undefined>;
};

export function ApiErrorNotice({ errors }: ApiErrorNoticeProps) {
  const visibleErrors = errors.filter((error): error is string => Boolean(error));
  if (visibleErrors.length === 0) return null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
      <p className="font-semibold">Some dashboard data could not load.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {visibleErrors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
