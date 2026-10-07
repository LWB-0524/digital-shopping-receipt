"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/", label: "小票", icon: ReceiptIcon },
  { href: "/scan", label: "拍小票", icon: CameraIcon, primary: true },
  { href: "/items", label: "品类", icon: ChartIcon },
];

export function AppShell({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
        <h1 className="text-lg font-semibold">{title}</h1>
        {action}
      </header>
      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-3">
          {TABS.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" || pathname.startsWith("/receipts") : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-accent" : "text-muted"}`}
              >
                {tab.primary ? (
                  <span className="-mt-5 flex size-12 items-center justify-center rounded-full bg-accent text-white shadow-md">
                    <Icon />
                  </span>
                ) : (
                  <Icon />
                )}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function ReceiptIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6M9 16h3" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4V8z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3a9 9 0 1 0 9 9h-9V3z" strokeLinejoin="round" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5z" strokeLinejoin="round" />
    </svg>
  );
}
