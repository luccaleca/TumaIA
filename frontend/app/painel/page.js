"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PainelIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/painel/conta");
  }, [router]);

  return <main className="rounded-xl border border-zinc-200 bg-white p-6">Redirecionando...</main>;
}
