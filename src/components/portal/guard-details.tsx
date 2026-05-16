type GuardDetailsProps = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  className?: string;
};

export function GuardDetails({ name, email, phone, className }: GuardDetailsProps) {
  const displayName = name?.trim() || email?.trim() || "Unknown guard";
  const hasContact = Boolean(email?.trim() || phone?.trim());

  return (
    <div className={className}>
      <p className="font-medium text-slate-900">{displayName}</p>
      {hasContact ? (
        <dl className="mt-1 grid gap-0.5 text-xs text-slate-600 sm:grid-cols-[auto_1fr] sm:gap-x-3">
          {phone?.trim() ? (
            <>
              <dt className="text-slate-500">Mobile</dt>
              <dd>
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-lunar-700 hover:underline">
                  {phone}
                </a>
              </dd>
            </>
          ) : null}
          {email?.trim() ? (
            <>
              <dt className="text-slate-500">Email</dt>
              <dd>
                <a href={`mailto:${email}`} className="break-all hover:text-lunar-700 hover:underline">
                  {email}
                </a>
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
