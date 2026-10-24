import { getTranslations } from "next-intl/server";
import type { Heatmap } from "@/lib/dashboard/analytics";
import { heatLevel } from "@/lib/dashboard/analytics";
import { formatNumber } from "@/lib/format";

const LEVEL_CLASS = { good: "bg-heat-good", mid: "bg-heat-mid", low: "bg-heat-low" } as const;

/** Peta warna aspek terhadap strata atau unit. Sel tersembunyi diarsir tanpa nilai dan tanpa jumlah responden. */
export async function HeatmapTable({ heatmap, testId }: { heatmap: Heatmap; testId: string }) {
  const t = await getTranslations("dashboard.heatmap");
  if (heatmap.columns.length === 0) return <p className="text-muted-foreground text-sm">{t("noData")}</p>;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-sm" data-testid={testId}>
          <thead>
            <tr>
              <th scope="col" className="text-muted-foreground px-2 py-1 text-left font-semibold">
                {t("aspect")}
              </th>
              {heatmap.columns.map((c) => (
                <th key={c.key} scope="col" className="text-muted-foreground min-w-24 px-2 py-1 text-center font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((row) => (
              <tr key={row.aspectCode}>
                <th scope="row" className="px-2 py-1 text-left font-normal whitespace-nowrap">
                  <span className="font-mono font-semibold">{row.aspectCode}</span> {row.aspectName}
                </th>
                {row.cells.map((cell, i) => {
                  const column = heatmap.columns[i]?.label ?? "";
                  if (cell.state === "visible" && cell.value !== null) {
                    return (
                      <td key={cell.key} className={`${LEVEL_CLASS[heatLevel(cell.value)]} rounded-md px-2 py-2 text-center`} data-testid="heat-cell" data-state="visible" data-n={cell.n ?? ""}>
                        <span className="block font-semibold tabular-nums">{formatNumber(cell.value, 2)}</span>
                        <span className="text-muted-foreground block text-xs">{t("respondents", { n: formatNumber(cell.n ?? 0) })}</span>
                      </td>
                    );
                  }
                  if (cell.state === "empty") {
                    return (
                      <td key={cell.key} className="text-muted-foreground rounded-md px-2 py-2 text-center text-xs" data-testid="heat-cell" data-state="empty">
                        {t("empty")}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={cell.key}
                      className="heat-hatched text-muted-foreground rounded-md px-2 py-2 text-center text-xs"
                      data-testid="heat-cell"
                      data-state={cell.state}
                      title={cell.state === "suppressed" ? t("hiddenNote") : t("secondaryNote")}
                      aria-label={`${row.aspectCode} ${column}: ${t("hidden")}`}
                    >
                      {t("hidden")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        <li className="flex items-center gap-1">
          <span className="bg-heat-good inline-block size-3 rounded-sm" aria-hidden /> {t("legendGood")}
        </li>
        <li className="flex items-center gap-1">
          <span className="bg-heat-mid inline-block size-3 rounded-sm" aria-hidden /> {t("legendMid")}
        </li>
        <li className="flex items-center gap-1">
          <span className="bg-heat-low inline-block size-3 rounded-sm" aria-hidden /> {t("legendLow")}
        </li>
        <li className="flex items-center gap-1">
          <span className="heat-hatched inline-block size-3 rounded-sm" aria-hidden /> {t("legendHidden")}
        </li>
      </ul>
    </div>
  );
}
