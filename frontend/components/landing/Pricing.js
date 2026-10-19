"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { landingCopy } from "../../content/landing-copy";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Reveal from "../ui/Reveal";
import Section from "../ui/Section";
import SectionHeader from "../ui/SectionHeader";

function planFeatures(planId, rows) {
  const col = planId === "starter" ? 1 : planId === "pro" ? 2 : 3;
  return rows.map((row) => ({ label: row[0], value: row[col] }));
}

export default function Pricing() {
  const copy = landingCopy.pricing;
  const [mobilePlan, setMobilePlan] = useState("pro");
  const mobileRows = useMemo(
    () => planFeatures(mobilePlan, copy.tableRows),
    [mobilePlan, copy.tableRows],
  );

  return (
    <Section id="planos" tone="surface" className="border-y border-[var(--line)]">
      <Reveal>
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-stretch">
        {copy.plans.map((plan, i) => {
          const features = planFeatures(plan.id, copy.tableRows);
          return (
            <Reveal key={plan.id} delay={i * 90} className="h-full">
              <Card
                variant={plan.featured ? "spotlight" : "elevated"}
                className={`relative flex h-full flex-col bg-[var(--surface-elevated)] p-7 ${
                  plan.featured
                    ? "border-2 border-[var(--brand-500)] shadow-[var(--glow)] lg:-translate-y-2 lg:scale-[1.02]"
                    : ""
                }`}
              >
                {plan.badge ? (
                  <div className="absolute right-5 top-5">
                    <Badge>{plan.badge}</Badge>
                  </div>
                ) : null}
                <p className={`text-sm font-medium ${plan.featured ? "text-[var(--brand-700)]" : "text-[var(--muted)]"}`}>
                  Plano
                </p>
                <h3 className="mt-1 text-2xl font-bold text-[var(--text)]">{plan.name}</h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--muted)]">{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {features.map((f) => (
                    <li key={f.label} className="flex gap-2 text-sm text-[var(--text)]">
                      <Check size={16} className="mt-0.5 shrink-0 text-[var(--brand-700)]" aria-hidden />
                      <span>
                        <span className="font-medium">{f.label}:</span>{" "}
                        <span className="text-[var(--muted)]">{f.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <Button
                    href={plan.href}
                    variant={plan.featured ? "primary" : plan.id === "business" ? "dark" : "secondary"}
                    className="w-full"
                  >
                    {plan.cta}
                  </Button>
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={120}>
        <div className="mt-10 overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-6 py-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">{copy.tableTitle}</h3>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left text-[0.9375rem]">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr>
                  {copy.tableHeaders.map((h, idx) => (
                    <th
                      key={h}
                      className={`border-b border-[var(--line)] px-5 py-3.5 font-semibold text-[var(--text)] ${
                        idx === 2 ? "bg-[var(--accent-muted)]" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {copy.tableRows.map((row) => (
                  <tr key={row[0]} className="even:bg-[var(--surface-elevated)]/80 hover:bg-[var(--accent-muted)]/50">
                    {row.map((cell, idx) => (
                      <td
                        key={`${row[0]}-${idx}`}
                        className={`border-b border-[var(--line)] px-5 py-3.5 ${
                          idx === 0 ? "font-medium text-[var(--text)]" : "text-[var(--muted)]"
                        } ${idx === 2 ? "bg-[var(--accent-muted)]/40" : ""}`}
                      >
                        {idx > 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Check size={14} className="text-[var(--brand-700)]" aria-hidden />
                            {cell}
                          </span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 p-4 md:hidden">
            <div className="grid grid-cols-3 gap-1 rounded-full bg-[var(--surface-elevated)] p-1">
              {copy.plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setMobilePlan(plan.id)}
                  className={`rounded-full px-2 py-2 text-xs font-semibold transition ${
                    mobilePlan === plan.id
                      ? "bg-[var(--brand-500)] text-[var(--ink-950)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {plan.name}
                </button>
              ))}
            </div>
            <ul className="space-y-3">
              {mobileRows.map((row) => (
                <li
                  key={row.label}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3"
                >
                  <span className="text-sm font-medium text-[var(--text)]">{row.label}</span>
                  <span className="text-right text-sm text-[var(--muted)]">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
