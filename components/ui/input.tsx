import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-line bg-white/80 px-4 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent/50 focus:bg-white",
        className,
      )}
      {...props}
    />
  );
}
