import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { User } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
  };
}

export async function ensureTrainerProfile(
  userId: string,
  email: string,
  client?: SupabaseClient,
) {
  const supabase = client ?? (await createSupabaseServerClient());
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        id: userId,
        email: email.trim().toLowerCase(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single<UserRow>();

  if (error) {
    throw error;
  }

  return toUser(data);
}
