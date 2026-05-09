"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PainelIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/painel/conta");
  }, [router]);

  return (
    <main className="rounded-xl border border-border bg-surface p-6 text-muted-foreground">Redirecionando...</main>
  );
}
