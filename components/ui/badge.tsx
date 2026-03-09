import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const toneClasses = {
  default: "bg-accent-soft text-accent-strong",
  neutral: "bg-white/80 text-muted",
  success: "bg-success/12 text-success",
  warn: "bg-warn/12 text-warn",
  danger: "bg-danger/12 text-danger",
} as const;

export function Badge({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof toneClasses;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
