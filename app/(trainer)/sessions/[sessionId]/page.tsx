import { SessionWorkbench } from "@/components/session-workbench";
import { requireTrainerSession } from "@/lib/auth";
import { getSessionDetail } from "@/lib/data/repository";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const trainer = await requireTrainerSession();
  const { sessionId } = await params;
  const detail = await getSessionDetail(trainer.trainerId, sessionId);

  return <SessionWorkbench initialDetail={detail} />;
}
