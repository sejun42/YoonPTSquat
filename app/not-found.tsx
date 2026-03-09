import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <Card className="w-full space-y-4 text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-muted">Not Found</p>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.05em]">
          요청한 화면을 찾지 못했습니다.
        </h1>
        <p className="text-sm text-muted">
          링크가 만료되었거나, 비활성화된 리포트일 수 있습니다.
        </p>
        <Button asChild className="w-full">
          <Link href="/">대시보드로 이동</Link>
        </Button>
      </Card>
    </div>
  );
}
