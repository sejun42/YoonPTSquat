import { NextResponse } from "next/server";

import { requireTrainerSession } from "@/lib/auth";
import { publishReport } from "@/lib/data/repository";
import { publishReportSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await requireTrainerSession();
  const { sessionId } = await params;
  const payload = publishReportSchema.parse(await request.json());
  const report = await publishReport(session.trainerId, sessionId, payload);
  return NextResponse.json(report);
}
