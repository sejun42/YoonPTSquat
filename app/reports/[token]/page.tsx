import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { VIEW_LABELS } from "@/lib/constants";
import { getReportByToken } from "@/lib/data/repository";
import { formatDate } from "@/lib/utils";

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getReportByToken(token);

  if (!report) {
    notFound();
  }

  const snapshot = report.reportSnapshotJson;
  const analyzedViews = snapshot.session.analyzedViews.length
    ? snapshot.session.analyzedViews.map((view) => VIEW_LABELS[view]).join(" · ")
    : VIEW_LABELS[snapshot.session.selectedView];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">Read Only Report</p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.06em]">
            {snapshot.client.name}님의 스쿼트 리포트
          </h1>
          <p className="text-sm text-muted">
            평가일 {formatDate(snapshot.session.recordedAt)} · {analyzedViews} 뷰
          </p>
        </div>
        <div className="rounded-3xl border border-line bg-white/75 p-4 text-sm leading-6 text-muted">
          영상은 저장되지 않았고, 이 페이지는 발행 시점의 읽기 전용 스냅샷으로만 제공됩니다.
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">핵심 요약</h2>
        <p className="text-sm leading-6 text-muted">{snapshot.summary.memberFriendlySummary}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">영상에서 관찰된 움직임 특징</h2>
        {snapshot.findings.length ? (
          snapshot.findings.map((finding) => (
            <div key={finding.id} className="rounded-3xl border border-line bg-white/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{finding.labelKo}</p>
                  <Badge tone="neutral">{VIEW_LABELS[finding.sourceView]}</Badge>
                </div>
                <Badge tone={finding.category === "hypothesis" ? "warn" : "default"}>
                  {finding.category === "hypothesis" ? "의심 패턴" : "관찰 결과"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{finding.descriptionKo}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">관찰 결과가 없습니다.</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">추가 검사 결과 요약</h2>
        <p className="text-sm leading-6 text-muted">{snapshot.summary.testSummary}</p>
        {snapshot.testResults.length ? (
          <div className="space-y-3">
            {snapshot.testResults.map((test) => (
              <div key={test.id} className="rounded-3xl border border-line bg-white/75 p-4">
                <p className="font-medium">
                  {test.testNameKo} ·{" "}
                  {test.side === "left"
                    ? "좌측"
                    : test.side === "right"
                      ? "우측"
                      : test.side === "bilateral"
                        ? "양측/전체"
                        : "기타"}
                </p>
                <p className="mt-1 text-sm text-muted">{test.resultLabel}</p>
                {test.memo ? (
                  <p className="mt-2 text-sm leading-6 text-muted">{test.memo}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">트레이너 종합 의견</h2>
        <p className="text-sm leading-6 text-muted">{snapshot.summary.coachOpinion}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">다음 세션에서 중점적으로 볼 항목</h2>
        <p className="text-sm leading-6 text-muted">{snapshot.summary.nextSessionFocus}</p>
      </Card>
    </div>
  );
}
