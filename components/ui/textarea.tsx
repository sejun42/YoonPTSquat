import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-3xl border border-line bg-white/80 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent/50 focus:bg-white",
        className,
      )}
      {...props}
    />
  );
}
