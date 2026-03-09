"use server";

import { redirect } from "next/navigation";

import { clearTrainerSession, requireTrainerSession, setTrainerSession } from "@/lib/auth";
import {
  createAssessmentSession,
  createClient,
  upsertTrainer,
} from "@/lib/data/repository";
import { clientInputSchema, createSessionSchema } from "@/lib/validation";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/login?error=empty");
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
