"use client";

import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const percent = (value: number) => `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
const day = (iso: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Tingkat partisipasi harian dalam persen; titik yang disembunyikan (kurang dari ambang sel) bernilai null. */
export function TrendChart({ points, minParticipation }: { points: { date: string; rate: number | null }[]; minParticipation: number }) {
  const t = useTranslations("participation.trend");
  return (
    <div className="h-64 w-full" role="img" aria-label={t("title")}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={day} fontSize={12} />
          <YAxis domain={[0, 100]} tickFormatter={percent} fontSize={12} width={48} />
          <Tooltip formatter={(v) => [percent(Number(v)), t("rate")]} labelFormatter={(label) => day(String(label))} />
          <ReferenceLine y={minParticipation} stroke="var(--warning)" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="rate" stroke="var(--brand-navy)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
