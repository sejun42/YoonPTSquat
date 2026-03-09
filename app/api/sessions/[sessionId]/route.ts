import { NextResponse } from "next/server";

import { requireTrainerSession } from "@/lib/auth";
import { saveSessionDraft } from "@/lib/data/repository";
import type { SessionDraftPayload } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await requireTrainerSession();
  const { sessionId } = await params;
  const payload = (await request.json()) as SessionDraftPayload;
  const detail = await saveSessionDraft(session.trainerId, sessionId, payload);
  return NextResponse.json(detail);
}
