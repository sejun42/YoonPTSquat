import Link from "next/link";
import { ArrowRight, Clock3, FileText, Search, Users } from "lucide-react";

import { createClientAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireTrainerSession } from "@/lib/auth";
import { SESSION_STATUS_LABELS, VIEW_LABELS } from "@/lib/constants";
import { getDashboardData } from "@/lib/data/repository";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireTrainerSession();
  const { q = "" } = await searchParams;
  const dashboard = await getDashboardData(session.trainerId, q);

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="grid-fade h-18 w-full" />
        <div className="space-y-5 px-5 pb-5">
          <div className="-mt-8 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                Dashboard
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.05em]">
                최근 평가와 회원 흐름
              </h2>
            </div>
            <Button asChild size="sm">
              <Link href="/sessions/new">새 평가</Link>
            </Button>
          </div>

          <form className="relative" action="/">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              name="q"
              defaultValue={q}
              className="pl-10"
              placeholder="회원 이름 검색"
            />
          </form>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-line bg-white/75 p-4">
              <p className="text-xs text-muted">회원 수</p>
              <p className="mt-2 text-2xl font-semibold">{dashboard.stats.totalClients}</p>
            </div>
            <div className="rounded-3xl border border-line bg-white/75 p-4">
              <p className="text-xs text-muted">공유 리포트</p>
              <p className="mt-2 text-2xl font-semibold">{dashboard.stats.sharedReports}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-accent" />
          <h3 className="font-semibold">새 회원 추가</h3>
        </div>
        <form action={createClientAction} className="space-y-3">
          <Input name="name" placeholder="회원 이름" required />
          <Input name="phoneOrIdentifier" placeholder="연락처 또는 식별자 (선택)" />
          <Textarea name="memo" placeholder="메모 (선택)" className="min-h-20" />
          <Button className="w-full">회원 생성</Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">최근 회원</h3>
          <Button asChild variant="ghost" size="sm">
            <Link href="/clients">전체 보기</Link>
          </Button>
        </div>
        {dashboard.clients.length ? (
          <div className="space-y-3">
            {dashboard.clients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center justify-between rounded-3xl border border-line bg-white/70 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-xs text-muted">{formatDate(client.updatedAt)}</p>
                </div>
                <ArrowRight className="size-4 text-muted" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">아직 등록된 회원이 없습니다.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock3 className="size-4 text-accent" />
          <h3 className="font-semibold">최근 평가 세션</h3>
        </div>
        {dashboard.recentSessions.length ? (
          <div className="space-y-3">
            {dashboard.recentSessions.map((item) => (
              <Link
                key={item.session.id}
                href={`/sessions/${item.session.id}`}
                className="rounded-3xl border border-line bg-white/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.clientName}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(item.session.recordedAt)} · {VIEW_LABELS[item.session.selectedView]}
                    </p>
                  </div>
                  <Badge tone={item.hasActiveReport ? "success" : "neutral"}>
                    {SESSION_STATUS_LABELS[item.session.status]}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.visibleFindingLabels.length ? (
                    item.visibleFindingLabels.map((label) => <Badge key={label}>{label}</Badge>)
                  ) : (
                    <Badge tone="neutral">판단 유보 또는 입력 대기</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">최근 평가 세션이 없습니다.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-accent" />
          <h3 className="font-semibold">최근 공유 리포트</h3>
        </div>
        {dashboard.recentReports.length ? (
          <div className="space-y-3">
            {dashboard.recentReports.map(({ report, clientName }) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-3xl border border-line bg-white/70 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{clientName}</p>
                  <p className="text-xs text-muted">{formatDate(report.updatedAt)}</p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/reports/${report.shareToken}`} target="_blank">
                    미리보기
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">아직 발행된 리포트가 없습니다.</p>
        )}
      </Card>
    </>
  );
}
