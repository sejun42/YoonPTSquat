import { AppShell } from "@/components/app-shell";
import { requireTrainerSession } from "@/lib/auth";

export default async function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireTrainerSession();
  return <AppShell email={session.email}>{children}</AppShell>;
}
