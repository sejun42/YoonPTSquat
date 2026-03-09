import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, LayoutDashboard, LogOut, ScanLine, Users } from "lucide-react";

import { logoutAction } from "@/app/actions";
import { APP_NAME } from "@/lib/constants";

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const navItems = [
    { href: "/", label: "대시보드", icon: LayoutDashboard },
    { href: "/clients", label: "회원", icon: Users },
    { href: "/sessions/new", label: "새 평가", icon: ScanLine },
  ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-5">
      <header className="glass-card relative overflow-hidden rounded-[32px] px-5 py-4">
        <div className="grid-fade absolute inset-0 opacity-60" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">
              Trainer Tool
            </p>
            <h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.04em]">
              {APP_NAME}
            </h1>
            <p className="mt-1 text-sm text-muted">{email}</p>
          </div>
          <form action={logoutAction}>
            <button
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-white/70 text-muted transition hover:text-foreground"
              type="submit"
              aria-label="로그아웃"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </header>

      <nav className="mt-4 grid grid-cols-3 gap-2 rounded-[26px] border border-line bg-white/50 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-medium text-muted transition hover:bg-white/80 hover:text-foreground"
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="mt-5 flex flex-1 flex-col gap-4">{children}</main>
      <footer className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
        <Activity className="size-3.5" />
        로컬 영상 처리 · 공유 링크 읽기 전용
      </footer>
    </div>
  );
}
