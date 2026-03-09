import Link from "next/link";
import { Search, UserPlus } from "lucide-react";

import { createClientAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireTrainerSession } from "@/lib/auth";
import { getClients } from "@/lib/data/repository";
import { formatDate } from "@/lib/utils";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireTrainerSession();
  const { q = "" } = await searchParams;
  const clients = await getClients(session.trainerId, q);

  return (
    <>
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-accent" />
          <h2 className="font-display text-2xl font-semibold tracking-[-0.05em]">
            회원 검색
          </h2>
        </div>
        <form action="/clients" className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            name="q"
            defaultValue={q}
            className="pl-10"
            placeholder="회원 이름으로 검색"
          />
        </form>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="size-4 text-accent" />
          <h3 className="font-semibold">회원 추가</h3>
        </div>
        <form action={createClientAction} className="space-y-3">
          <Input name="name" placeholder="회원 이름" required />
          <Input name="phoneOrIdentifier" placeholder="연락처 또는 식별자" />
          <Textarea name="memo" placeholder="메모" className="min-h-20" />
          <Button className="w-full">저장</Button>
        </form>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">회원 목록</h3>
        {clients.length ? (
          clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="rounded-3xl border border-line bg-white/70 p-4"
            >
              <p className="font-medium">{client.name}</p>
              <p className="mt-1 text-xs text-muted">
                최근 수정 {formatDate(client.updatedAt)}
              </p>
              {client.phoneOrIdentifier ? (
                <p className="mt-2 text-sm text-muted">{client.phoneOrIdentifier}</p>
              ) : null}
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted">검색 결과가 없습니다.</p>
        )}
      </Card>
    </>
  );
}
