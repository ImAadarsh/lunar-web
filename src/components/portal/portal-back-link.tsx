"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/cn";
import {
  canUseBrowserBack,
  clearSessionReturnPath,
  readReturnToFromSearch,
  sessionReturnPath,
} from "@/lib/portal-navigation";

type PortalBackLinkProps = {
  /** Used when there is no prior in-app navigation (new tab, direct URL). */
  fallbackHref: string;
  children: React.ReactNode;
  className?: string;
};

export function PortalBackLink({ fallbackHref, children, className }: PortalBackLinkProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const resolveTarget = useCallback(() => {
    return (
      readReturnToFromSearch(searchParams) ??
      sessionReturnPath() ??
      null
    );
  }, [searchParams]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const explicit = resolveTarget();
      if (explicit) {
        e.preventDefault();
        clearSessionReturnPath();
        router.push(explicit);
        return;
      }
      if (canUseBrowserBack()) {
        e.preventDefault();
        router.back();
        return;
      }
      // Let the Link navigate to fallbackHref
    },
    [resolveTarget, router],
  );

  return (
    <Link href={fallbackHref} onClick={handleClick} className={cn(className)}>
      {children}
    </Link>
  );
}
