import { Alert } from "@/components/ui/alert";

type ApiErrorNoticeProps = {
  errors: Array<string | null | undefined>;
};

export function ApiErrorNotice({ errors }: ApiErrorNoticeProps) {
  const visibleErrors = errors.filter((error): error is string => Boolean(error));
  if (visibleErrors.length === 0) return null;

  return (
    <Alert title="Some data could not be loaded" variant="error">
      <ul className="list-disc space-y-1 pl-5">
        {visibleErrors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </Alert>
  );
}
