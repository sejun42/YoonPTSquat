import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ensureTrainerProfile } from "@/lib/supabase/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface TrainerSession {
  trainerId: string;
  email: string;
}

const COOKIE_NAME = "trainer_session";

function encode(session: TrainerSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function decode(value: string): TrainerSession | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as TrainerSession;
  } catch {
    return null;
  }
}

export async function getTrainerSession() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id && user.email) {
      await ensureTrainerProfile(user.id, user.email, supabase);
      return {
        trainerId: user.id,
        email: user.email,
      } satisfies TrainerSession;
    }
  }

  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  return raw ? decode(raw) : null;
}

export async function requireTrainerSession() {
  const session = await getTrainerSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function setTrainerSession(session: TrainerSession) {
  const store = await cookies();
  store.set(COOKIE_NAME, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearTrainerSession() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();

  const store = await cookies();
  store.delete(COOKIE_NAME);
}
