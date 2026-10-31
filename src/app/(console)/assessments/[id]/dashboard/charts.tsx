"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Grafik dasbor (docs/05): batang biru batu untuk nilai yang mencapai sasaran, oker lembut untuk di bawah sasaran,
// hijau toska redup untuk karakteristik kontekstual. Angka memakai format Indonesia.

const MET = "var(--level-4)";
const BELOW = "var(--highlight)";
const CONTEXTUAL = "var(--series-2)";
const TARGET = "var(--danger)";
const decimal = (v: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const tick = (v: number) => new Intl.NumberFormat("id-ID").format(v);

export function AspectChart({ data, target }: { data: { code: string; name: string; index: number | null }[]; target: number }) {
  const t = useTranslations("dashboard.charts");
  return (
    <div className="h-72 w-full" role="img" aria-label={t("aspects")} data-testid="chart-aspects">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="code" fontSize={12} />
          <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickFormatter={tick} fontSize={12} width={32} />
          <Tooltip formatter={(v) => [decimal(Number(v)), t("index")]} labelFormatter={(code) => `${code} ${data.find((d) => d.code === code)?.name ?? ""}`} />
          <ReferenceLine y={target} stroke={TARGET} strokeDasharray="4 4" label={{ value: t("target"), position: "insideTopRight", fontSize: 12 }} />
          <Bar dataKey="index" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.code} fill={d.index !== null && d.index < target ? BELOW : MET} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CharacteristicChart({ data, target }: { data: { code: string; name: string; value: number | null; isContextual: boolean; adjusted: boolean }[]; target: number }) {
  const t = useTranslations("dashboard.charts");
  const rows = data.map((d) => ({ ...d, label: d.adjusted ? `${d.code}*` : d.code }));
  return (
    <div className="w-full" style={{ height: Math.max(240, rows.length * 28 + 48) }} role="img" aria-label={t("characteristics")} data-testid="chart-characteristics">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickFormatter={tick} fontSize={12} />
          <YAxis type="category" dataKey="label" fontSize={12} width={48} />
          <Tooltip formatter={(v) => [decimal(Number(v)), t("index")]} labelFormatter={(label) => rows.find((r) => r.label === label)?.name ?? String(label)} />
          <ReferenceLine x={target} stroke={TARGET} strokeDasharray="4 4" />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {rows.map((d) => (
              <Cell key={d.code} fill={d.isContextual ? CONTEXTUAL : d.value !== null && d.value < target ? BELOW : MET} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComparisonChart({ data, labels }: { data: { code: string; previous: number | null; current: number | null }[]; labels: { previous: string; current: string } }) {
  const t = useTranslations("dashboard.comparison");
  return (
    <div className="h-72 w-full" role="img" aria-label={t("title")} data-testid="chart-comparison">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="code" fontSize={12} />
          <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickFormatter={tick} fontSize={12} width={32} />
          <Tooltip formatter={(v, name) => [decimal(Number(v)), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="previous" name={labels.previous} fill={CONTEXTUAL} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="current" name={labels.current} fill={MET} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
