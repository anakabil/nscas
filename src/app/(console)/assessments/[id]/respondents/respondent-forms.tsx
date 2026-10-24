"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { initialActionState, type ActionState } from "@/components/forms/action-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { IssuedLink } from "@/lib/respondents/service";
import {
  importRosterAction,
  issueLinksAction,
  queueInvitationsAction,
  reissueTokenAction,
  revokeTokenAction,
  setSurveyWindowAction,
  type ImportState,
  type LinksState,
} from "./actions";

const format = (n: number) => new Intl.NumberFormat("id-ID").format(n);

function ErrorAlert({ code }: { code?: string }) {
  const t = useTranslations("assessment.errors");
  return code ? <Alert variant="destructive">{t(code)}</Alert> : null;
}

// ---------------------------------------------------------------------------
// Jendela survei
// ---------------------------------------------------------------------------

export function SurveyWindowForm({ assessmentId, opensAt, closesAt }: { assessmentId: string; opensAt: string; closesAt: string }) {
  const t = useTranslations("respondents.window");
  const tA = useTranslations("assessment");
  const [state, formAction] = useActionState<ActionState, FormData>(setSurveyWindowAction.bind(null, assessmentId), initialActionState);
  return (
    <form action={formAction} className="space-y-4">
      <p className="text-muted-foreground text-sm">{t("intro")}</p>
      <ErrorAlert code={state.error} />
      {state.success ? <Alert variant="success">{tA("saved")}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="survey-opens">{t("opensAt")}</Label>
          <Input id="survey-opens" name="opensAt" type="datetime-local" defaultValue={opensAt} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="survey-closes">{t("closesAt")}</Label>
          <Input id="survey-closes" name="closesAt" type="datetime-local" defaultValue={closesAt} required />
        </div>
      </div>
      <SubmitButton pendingLabel={tA("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Impor daftar responden
// ---------------------------------------------------------------------------

export function ImportPanel({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("respondents");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportState | null>(null);
  const [pending, startTransition] = useTransition();
  const [intent, setIntent] = useState<"preview" | "commit">("preview");

  const run = (next: "preview" | "commit") => {
    if (!file) {
      setResult({ error: "FILE_EMPTY" });
      return;
    }
    setIntent(next);
    const data = new FormData();
    data.set("intent", next);
    data.set("file", file);
    startTransition(async () => {
      const state = await importRosterAction(assessmentId, data);
      setResult(state);
      if (state.imported) setFile(null);
    });
  };

  const preview = result?.preview;
  const ready = preview && !result?.error && !result?.imported && preview.validRows > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("import.title")}</CardTitle>
        <CardDescription>{t("import.intro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <a href={`/api/assessments/${assessmentId}/respondents/template`} className={buttonVariants({ variant: "outline" })} download>
          {t("import.template")}
        </a>
        <div className="space-y-2">
          <Label htmlFor="roster-file">{t("import.file")}</Label>
          <Input
            key={result?.imported ? "done" : "file"}
            id="roster-file"
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => run("preview")} disabled={pending}>
            {pending && intent === "preview" ? t("import.previewing") : t("import.preview")}
          </Button>
          {ready ? (
            <Button type="button" onClick={() => run("commit")} disabled={pending} data-testid="roster-commit">
              {pending && intent === "commit" ? t("import.committing") : t("import.commit", { count: format(preview.validRows) })}
            </Button>
          ) : null}
        </div>

        <ErrorAlert code={result?.error} />
        {result?.imported ? (
          <Alert variant="success" data-testid="roster-imported">
            {t("import.imported", { count: format(result.imported) })}
          </Alert>
        ) : null}
        {ready ? <Alert variant="info">{t("import.ready")}</Alert> : null}

        {preview ? <ImportPreview preview={preview} /> : null}
      </CardContent>
    </Card>
  );
}

function ImportPreview({ preview }: { preview: NonNullable<ImportState["preview"]> }) {
  const t = useTranslations("respondents");
  if (preview.missingColumns.length > 0) {
    return (
      <Alert variant="destructive">
        {t("import.missingColumns", { columns: preview.missingColumns.map((c) => t(`columns.${c}`)).join(", ") })}
      </Alert>
    );
  }
  if (preview.tooManyRows) return <Alert variant="destructive">{t("import.tooManyRows", { max: format(20_000) })}</Alert>;

  return (
    <div className="space-y-4" data-testid="roster-preview">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t("import.rows"), value: preview.totalRows, id: "preview-rows" },
          { label: t("import.valid"), value: preview.validRows, id: "preview-valid" },
          { label: t("import.errorCount"), value: preview.errorCount, id: "preview-errors" },
        ].map((s) => (
          <div key={s.id} className="border-border rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground text-sm">{s.label}</dt>
            <dd className="text-lg font-semibold tabular-nums" data-testid={s.id} data-value={s.value}>
              {format(s.value)}
            </dd>
          </div>
        ))}
      </dl>

      {preview.errorCount > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold">{t("import.errorsTitle")}</h3>
          <p className="text-muted-foreground text-sm">{t("import.fixAndRetry")}</p>
          {preview.errorCount > preview.errors.length ? (
            <p className="text-muted-foreground text-sm">{t("import.errorsTruncated", { shown: format(preview.errors.length), total: format(preview.errorCount) })}</p>
          ) : null}
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("import.rowNumber")}</TableHeaderCell>
                <TableHeaderCell>{t("import.column")}</TableHeaderCell>
                <TableHeaderCell>{t("import.problem")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {preview.errors.map((e, i) => (
                <TableRow key={`${e.rowNumber}-${e.column}-${i}`} data-testid="preview-error" data-code={e.code}>
                  <TableCell className="tabular-nums">{e.rowNumber}</TableCell>
                  <TableCell>{e.column ? t(`columns.${e.column}`) : ""}</TableCell>
                  <TableCell>{t(`rowErrors.${e.code}`)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>
      ) : null}

      {preview.validRows > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CountTable title={t("import.byUnit")} rows={preview.byUnit.map((u) => ({ key: u.name, label: u.name, count: u.count }))} />
          <CountTable title={t("import.byStratum")} rows={preview.byStratum.map((s) => ({ key: s.code, label: s.code, count: s.count }))} />
        </div>
      ) : null}
    </div>
  );
}

function CountTable({ title, rows }: { title: string; rows: { key: string; label: string; count: number }[] }) {
  const t = useTranslations("respondents.import");
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{title}</TableHeaderCell>
            <TableHeaderCell className="text-right">{t("count")}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <tbody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.label}</TableCell>
              <TableCell className="text-right tabular-nums">{format(r.count)}</TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distribusi token
// ---------------------------------------------------------------------------

/** Sel CSV aman: diberi kutip, dan awalan rumus (=, +, -, @) dinetralkan agar tidak dijalankan Excel. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadLinksCsv(links: IssuedLink[], headers: string[], fileName: string) {
  // Pemisah titik koma dan BOM agar langsung terbaca rapi oleh Excel berbahasa Indonesia.
  const lines = [headers, ...links.map((l) => [l.fullName, l.employeeNo ?? "", l.unitName, l.stratumCode, l.link])].map((row) => row.map(csvCell).join(";"));
  const blob = new Blob([`﻿${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function CopyButton({ value }: { value: string }) {
  const t = useTranslations("respondents.distribution.links");
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      }}
    >
      {copied ? t("copied") : t("copy")}
    </Button>
  );
}

export function LinksResult({ links }: { links: IssuedLink[] }) {
  const t = useTranslations("respondents");
  if (links.length === 0) return <Alert variant="info">{t("distribution.links.none")}</Alert>;
  const headers = [t("columns.name"), t("columns.employeeNo"), t("columns.unit"), t("columns.stratum"), t("distribution.links.link")];
  return (
    <div className="space-y-3" data-testid="issued-links" data-count={links.length}>
      <Alert variant="warning">
        {t("distribution.links.issued", { count: format(links.length) })} {t("distribution.links.once")}
      </Alert>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => downloadLinksCsv(links, headers, t("distribution.links.fileName"))} data-testid="download-links">
          {t("distribution.links.download")}
        </Button>
        <p className="text-muted-foreground text-sm">{t("distribution.links.warning")}</p>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t("columns.name")}</TableHeaderCell>
              <TableHeaderCell>{t("columns.unit")}</TableHeaderCell>
              <TableHeaderCell>{t("distribution.links.link")}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {links.map((l) => (
              <TableRow key={l.link}>
                <TableCell>{l.fullName}</TableCell>
                <TableCell>{l.unitName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="max-w-64 truncate text-xs" data-testid="issued-link">
                      {l.link}
                    </code>
                    <CopyButton value={l.link} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function UnitSelect({ id, units }: { id: string; units: { id: string; name: string }[] }) {
  const t = useTranslations("respondents.distribution");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("unitFilter")}</Label>
      <Select id={id} name="unitId" defaultValue="">
        <option value="">{t("allUnits")}</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function DistributionPanel({ assessmentId, units }: { assessmentId: string; units: { id: string; name: string }[] }) {
  const t = useTranslations("respondents.distribution");
  const [invite, inviteAction] = useActionState<LinksState, FormData>(queueInvitationsAction.bind(null, assessmentId), {});
  const [links, linksAction] = useActionState<LinksState, FormData>(issueLinksAction.bind(null, assessmentId), {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <form action={inviteAction} className="space-y-3">
          <h3 className="font-semibold">{t("invite.title")}</h3>
          <p className="text-muted-foreground text-sm">{t("invite.intro")}</p>
          <ErrorAlert code={invite.error} />
          {invite.queued !== undefined ? (
            <Alert variant={invite.queued > 0 ? "success" : "info"} data-testid="invitations-queued" data-count={invite.queued}>
              {invite.queued > 0 ? t("invite.queued", { count: format(invite.queued) }) : t("invite.none")}
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <UnitSelect id="invite-unit" units={units} />
          </div>
          <SubmitButton pendingLabel={t("invite.pending")}>{t("invite.submit")}</SubmitButton>
        </form>

        <form action={linksAction} className="space-y-3">
          <h3 className="font-semibold">{t("links.title")}</h3>
          <p className="text-muted-foreground text-sm">{t("links.intro")}</p>
          <ErrorAlert code={links.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <UnitSelect id="links-unit" units={units} />
            <label className="flex min-h-11 items-center gap-2 self-end text-sm">
              <input type="checkbox" name="onlyWithoutEmail" defaultChecked className="size-5" />
              {t("links.onlyWithoutEmail")}
            </label>
          </div>
          <SubmitButton pendingLabel={t("links.pending")}>{t("links.submit")}</SubmitButton>
          {links.links ? <LinksResult links={links.links} /> : null}
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tindakan per responden
// ---------------------------------------------------------------------------

export function RowActions({
  assessmentId,
  rosterEntryId,
  tokenState,
  hasEmail,
}: {
  assessmentId: string;
  rosterEntryId: string;
  tokenState: "NONE" | "ISSUED" | "REVOKED";
  hasEmail: boolean;
}) {
  const t = useTranslations("respondents.table");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string; link?: string } | null>(null);

  const revoke = () => {
    if (!window.confirm(t("confirmRevoke"))) return;
    startTransition(async () => {
      const state = await revokeTokenAction(assessmentId, rosterEntryId);
      setMessage(state.error ? { error: state.error } : { success: t("revoked") });
    });
  };
  const reissue = (channel: "link" | "email") =>
    startTransition(async () => {
      const state = await reissueTokenAction(assessmentId, rosterEntryId, channel);
      if (state.error) setMessage({ error: state.error });
      else if (state.links?.[0]) setMessage({ link: state.links[0].link });
      else setMessage({ success: t("reissueQueued") });
    });

  // Tindakan dilipat dalam satu tombol agar tinggi baris tabel tetap ringkas.
  return (
    <div className="space-y-2">
      <details className="group">
        <summary className={buttonVariants({ variant: "outline", size: "sm", className: "cursor-pointer list-none" })}>{t("manage")}</summary>
        <div className="mt-2 flex flex-col items-start gap-2">
          {tokenState === "ISSUED" ? (
            <Button type="button" size="sm" variant="outline" onClick={revoke} disabled={pending}>
              {t("revoke")}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => reissue("link")} disabled={pending}>
            {t("reissueLink")}
          </Button>
          {hasEmail ? (
            <Button type="button" size="sm" variant="outline" onClick={() => reissue("email")} disabled={pending}>
              {t("reissueEmail")}
            </Button>
          ) : null}
        </div>
      </details>
      {message?.error ? <ErrorAlert code={message.error} /> : null}
      {message?.success ? <p className="text-success text-sm">{message.success}</p> : null}
      {message?.link ? (
        <div className="flex items-center gap-2">
          <code className="max-w-48 truncate text-xs" data-testid="reissued-link">
            {message.link}
          </code>
          <CopyButton value={message.link} />
        </div>
      ) : null}
    </div>
  );
}
