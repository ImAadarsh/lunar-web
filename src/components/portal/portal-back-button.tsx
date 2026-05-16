import Link from "next/link";
import { Suspense } from "react";
import { PortalBackLink } from "@/components/portal/portal-back-link";

type PortalBackButtonProps = {
  fallbackHref: string;
  children: React.ReactNode;
  className?: string;
};

/** Server-safe back control: returns to previous portal page when possible. */
export function PortalBackButton({ fallbackHref, children, className }: PortalBackButtonProps) {
  return (
    <Suspense
      fallback={
        <Link href={fallbackHref} className={className}>
          {children}
        </Link>
      }
    >
      <PortalBackLink fallbackHref={fallbackHref} className={className}>
        {children}
      </PortalBackLink>
    </Suspense>
  );
}
