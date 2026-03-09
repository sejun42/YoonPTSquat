import { ArrowRight, ShieldCheck } from "lucide-react";

import { loginAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasSupabaseEnv } from "@/lib/supabase/client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const supabaseReady = hasSupabaseEnv();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="relative w-full overflow-hidden p-6">
        <div className="grid-fade absolute inset-0 opacity-70" />
        <div className="relative space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">
              PT Screening
            </p>
            <h1 className="font-display text-[2.2rem] font-semibold tracking-[-0.06em] text-balance">
              현장에서 바로 쓰는 맨몸 스쿼트 스크리닝
            </h1>
            <p className="text-sm leading-6 text-muted">
              트레이너 전용 로그인입니다. 영상은 서버에 저장하지 않고, 분석 결과와 검사 기록만 보관합니다.
            </p>
          </div>

          <div className="rounded-3xl border border-line bg-white/70 p-4 text-sm text-muted">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4 text-accent" />
              {supabaseReady ? "Supabase 연결 준비됨" : "데모 로그인 모드"}
            </div>
            <p className="mt-2 leading-6">
              {supabaseReady
                ? "이메일 주소로 로그인 세션을 시작합니다. 운영 시에는 Supabase Auth 매직링크와 연결해 사용할 수 있습니다."
                : "환경변수가 없으면 파일 기반 데모 저장소로 동작합니다. 한 기기에서 전체 흐름 검증이 가능합니다."}
            </p>
          </div>

          <form action={loginAction} className="space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">트레이너 이메일</span>
              <Input
                name="email"
                type="email"
                placeholder="trainer@example.com"
                required
              />
            </label>
            {sent ? (
              <p className="text-sm text-success">
                매직링크를 전송했습니다. 이메일에서 로그인 링크를 열어 주세요.
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-danger">
                {error === "auth"
                  ? "인증 요청을 처리하지 못했습니다. Supabase 설정과 Redirect URL을 확인하세요."
                  : "이메일을 입력한 뒤 다시 시도하세요."}
              </p>
            ) : null}
            <Button className="w-full">
              {supabaseReady ? "매직링크 보내기" : "로그인 시작"}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
