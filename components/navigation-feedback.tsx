"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";

type NavigationFeedbackContextValue = {
  beginPending: () => void;
  pending: boolean;
};

const NavigationFeedbackContext = createContext<NavigationFeedbackContextValue | null>(null);

function shouldIgnoreClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.button !== 0
  );
}

export function NavigationFeedbackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  const value = useMemo(
    () => ({
      beginPending: () => setPending(true),
      pending
    }),
    [pending]
  );

  return (
    <NavigationFeedbackContext.Provider value={value}>
      {children}
      <div className={`navigation-feedback${pending ? " navigation-feedback-visible" : ""}`} aria-hidden="true">
        <span className="navigation-feedback-bar" />
        <div className="navigation-feedback-card">
          <span className="loading-spinner" />
          <span>Loading the next view...</span>
        </div>
      </div>
    </NavigationFeedbackContext.Provider>
  );
}

export function useNavigationFeedback() {
  const context = useContext(NavigationFeedbackContext);

  if (!context) {
    return {
      beginPending: () => undefined,
      pending: false
    };
  }

  return context;
}

type PendingLinkProps = LinkProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    className?: string;
    children: ReactNode;
  };

export function PendingLink({ onClick, href, children, ...props }: PendingLinkProps) {
  const { beginPending } = useNavigationFeedback();

  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        if (shouldIgnoreClick(event)) {
          onClick?.(event);
          return;
        }

        beginPending();
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
