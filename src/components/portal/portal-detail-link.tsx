"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { buildHrefWithReturnTo } from "@/lib/portal-navigation";

type PortalDetailLinkProps = React.ComponentProps<typeof Link>;

function PortalDetailLinkInner({ href, ...props }: PortalDetailLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;
  const dest = typeof href === "string" ? buildHrefWithReturnTo(href, returnTo) : href;

  return <Link href={dest} {...props} />;
}

/** Detail page link that records the current list/filter URL for the Back control. */
export function PortalDetailLink({ href, children, ...props }: PortalDetailLinkProps) {
  const fallbackHref = typeof href === "string" ? href : "/";

  return (
    <Suspense
      fallback={
        <Link href={fallbackHref} {...props}>
          {children}
        </Link>
      }
    >
      <PortalDetailLinkInner href={href} {...props}>
        {children}
      </PortalDetailLinkInner>
    </Suspense>
  );
}
