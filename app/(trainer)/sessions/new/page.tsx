import { Camera, Film, UserRound } from "lucide-react";

import { createSessionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireTrainerSession } from "@/lib/auth";
import { CAPTURE_GUIDE, VIEW_LABELS } from "@/lib/constants";
import { getClients } from "@/lib/data/repository";

const viewOptions = ["front", "side", "rear"] as const;

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const session = await requireTrainerSession();
  const clients = await getClients(session.trainerId);
  const { clientId } = await searchParams;

  return (
    <>
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Camera className="size-4 text-accent" />
          <h2 className="font-display text-2xl font-semibold tracking-[-0.05em]">
            새 평가 시작
          </h2>
        </div>
        <p className="text-sm leading-6 text-muted">
          운동 종목은 맨몸 스쿼트로 고정됩니다. 세션을 만든 뒤 해당 화면에서 촬영 또는 갤러리 영상을 분석합니다.
        </p>
      </Card>

      <Card className="space-y-4">
        <form action={createSessionAction} className="space-y-4">
          <label className="block space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <UserRound className="size-4 text-accent" />
              회원 선택
            </span>
            <select
              name="clientId"
              defaultValue={clientId}
              className="h-12 w-full rounded-2xl border border-line bg-white/80 px-4 text-sm outline-none"
              required
            >
              <option value="" disabled>
                회원을 선택하세요
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium">촬영 뷰 선택</span>
            <div className="grid grid-cols-3 gap-2">
              {viewOptions.map((view, index) => (
                <label
                  key={view}
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-3xl border border-line bg-white/70 px-3 py-4 text-sm"
                >
                  <input
                    type="radio"
                    name="selectedView"
                    value={view}
                    defaultChecked={index === 0}
                    className="accent-[var(--accent)]"
                  />
                  {VIEW_LABELS[view]}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-white/70 p-4 text-sm leading-6 text-muted">
            <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <Film className="size-4 text-accent" />
              촬영 가이드
            </div>
            <ul className="space-y-1">
              {CAPTURE_GUIDE.map((guide) => (
                <li key={guide}>• {guide}</li>
              ))}
            </ul>
          </div>

          <Button className="w-full" disabled={!clients.length}>
            세션 생성 후 촬영 시작
          </Button>
        </form>
      </Card>
    </>
  );
}
