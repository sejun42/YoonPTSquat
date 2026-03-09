"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clearTrainerSession, requireTrainerSession, setTrainerSession } from "@/lib/auth";
import {
  createAssessmentSession,
  createClient,
  upsertTrainer,
} from "@/lib/data/repository";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clientInputSchema, createSessionSchema } from "@/lib/validation";

async function resolveSiteUrl() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) {
    return origin;
  }

  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");

  if (host) {
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/login?error=empty");
  }

  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      redirect("/login?error=auth");
    }

    const callbackUrl = new URL("/auth/callback", await resolveSiteUrl()).toString();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      redirect("/login?error=auth");
    }

    redirect("/login?sent=1");
  }

  const trainer = await upsertTrainer(email);
  await setTrainerSession({ trainerId: trainer.id, email: trainer.email });
  redirect("/");
}

export async function logoutAction() {
  await clearTrainerSession();
  redirect("/login");
}

export async function createClientAction(formData: FormData) {
  const session = await requireTrainerSession();
  const parsed = clientInputSchema.parse({
    name: formData.get("name"),
    phoneOrIdentifier: formData.get("phoneOrIdentifier"),
    memo: formData.get("memo"),
  });
  const client = await createClient(session.trainerId, parsed);
  const redirectTo = String(formData.get("redirectTo") ?? `/clients/${client.id}`);
  redirect(redirectTo === "stay" ? `/clients/${client.id}` : redirectTo);
}

export async function createSessionAction(formData: FormData) {
  const session = await requireTrainerSession();
  const parsed = createSessionSchema.parse({
    clientId: formData.get("clientId"),
    selectedView: formData.get("selectedView"),
    recordedAt: formData.get("recordedAt") || undefined,
  });

  const created = await createAssessmentSession(session.trainerId, parsed);
  redirect(`/sessions/${created.id}`);
}
