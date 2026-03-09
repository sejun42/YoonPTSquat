import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { ensureTrainerProfile } from "@/lib/supabase/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildLoginErrorUrl(
  origin: string,
  params: {
    error?: string;
    message?: string;
    phase?: "send" | "callback";
  },
) {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.message) {
    searchParams.set("message", params.message);
  }

  if (params.phase) {
    searchParams.set("phase", params.phase);
  }

  const query = searchParams.toString();
  return `${origin}/login${query ? `?${query}` : ""}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) {
    next = "/";
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(
      buildLoginErrorUrl(origin, {
        error: "auth",
        phase: "callback",
        message: "Supabase 서버 클라이언트를 만들지 못했습니다.",
      }),
    );
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let error: Error | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    error = result.error;
  } else {
    error = new Error("인증 링크에 code 또는 token_hash가 없습니다.");
  }

  if (error) {
    console.error("Supabase auth callback failed", {
      origin,
      next,
      codePresent: Boolean(code),
      tokenHashPresent: Boolean(tokenHash),
      type,
      error,
    });
    return NextResponse.redirect(
      buildLoginErrorUrl(origin, {
        error: "auth",
        phase: "callback",
        message: error.message,
      }),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id && user.email) {
    await ensureTrainerProfile(user.id, user.email, supabase);
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    buildLoginErrorUrl(origin, {
      error: "auth",
      phase: "callback",
      message: "인증된 사용자 정보를 읽지 못했습니다.",
    }),
  );
}
