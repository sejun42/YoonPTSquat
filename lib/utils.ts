import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined, pattern = "yyyy.MM.dd") {
  if (!value) {
    return "-";
  }

  return format(new Date(value), pattern, { locale: ko });
}

export function formatDateTime(value: string | null | undefined) {
  return formatDate(value, "yyyy.MM.dd HH:mm");
}

export function sortByDateDesc<T>(
  items: T[],
  selector: (item: T) => string | null | undefined,
) {
  return [...items].sort((a, b) => {
    const left = selector(a) ? new Date(selector(a) as string).getTime() : 0;
    const right = selector(b) ? new Date(selector(b) as string).getTime() : 0;
    return right - left;
  });
}
