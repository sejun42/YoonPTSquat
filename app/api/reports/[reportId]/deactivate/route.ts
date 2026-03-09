import { NextResponse } from "next/server";

import { requireTrainerSession } from "@/lib/auth";
import { deactivateReport } from "@/lib/data/repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await requireTrainerSession();
  const { reportId } = await params;
  const report = await deactivateReport(session.trainerId, reportId);
  return NextResponse.json(report);
}
