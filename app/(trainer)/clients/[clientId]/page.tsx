import Link from "next/link";
import { FileText, Plus, ScanLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireTrainerSession } from "@/lib/auth";
import { SESSION_STATUS_LABELS, VIEW_LABELS } from "@/lib/constants";
import { getClientDetail } from "@/lib/data/repository";
import { formatDate } from "@/lib/utils";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await requireTrainerSession();
  const { clientId } = await params;
  const { client, sessions, reports } = await getClientDetail(session.trainerId, clientId);

  return (
    <>
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Client</p>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.06em]">
              {client.name}
            </h2>
          </div>
          <Button asChild size="sm">
            <Link href={`/sessions/new?clientId=${client.id}`}>
              <Plus className="mr-1.5 size-4" />
              새 평가
            </Link>
          </Button>
        </div>
        {client.phoneOrIdentifier ? (
          <p className="text-sm text-muted">{client.phoneOrIdentifier}</p>
        ) : null}
        {client.memo ? (
          <div className="rounded-3xl border border-line bg-white/70 p-4 text-sm leading-6 text-muted">
            {client.memo}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <ScanLine className="size-4 text-accent" />
          <h3 className="font-semibold">평가 세션</h3>
        </div>
        {sessions.length ? (
          sessions.map((assessment) => (
            <Link
              key={assessment.id}
              href={`/sessions/${assessment.id}`}
              className="rounded-3xl border border-line bg-white/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{formatDate(assessment.recordedAt)}</p>
                  <p className="text-xs text-muted">
                    {VIEW_LABELS[assessment.selectedView]} · 맨몸 스쿼트
                  </p>
                </div>
                <Badge tone={assessment.status === "shared" ? "success" : "neutral"}>
                  {SESSION_STATUS_LABELS[assessment.status]}
                </Badge>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted">아직 평가 세션이 없습니다.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-accent" />
          <h3 className="font-semibold">리포트 발행 이력</h3>
        </div>
        {reports.length ? (
          reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between rounded-3xl border border-line bg-white/70 px-4 py-3"
            >
              <div>
                <p className="font-medium">{formatDate(report.createdAt)}</p>
                <p className="text-xs text-muted">
                  {report.isActive ? "링크 활성" : "링크 비활성"}
                </p>
              </div>
              {report.isActive ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/reports/${report.shareToken}`} target="_blank">
                    보기
                  </Link>
                </Button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">아직 발행 이력이 없습니다.</p>
        )}
      </Card>
    </>
  );
}
