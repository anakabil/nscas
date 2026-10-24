"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { putFile } from "@/components/upload/put-file";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteEvidenceAction, finalizeEvidenceUploadAction, requestEvidenceUploadAction, updateEvidenceLinksAction } from "./actions";

export interface CharacteristicOption {
  id: string;
  code: string;
  name: string;
  requirements: { id: string; description: string }[];
}

export type Links = { characteristicId: string; requirementIds: string[] }[];

/** Pemilih karakteristik dan butir daftar periksa yang dipenuhi sebuah bukti. */
export function MappingPicker({ characteristics, value, onChange, idPrefix }: { characteristics: CharacteristicOption[]; value: Links; onChange: (v: Links) => void; idPrefix: string }) {
  const toggle = (id: string) =>
    onChange(value.some((l) => l.characteristicId === id) ? value.filter((l) => l.characteristicId !== id) : [...value, { characteristicId: id, requirementIds: [] }]);
  const toggleRequirement = (characteristicId: string, requirementId: string) =>
    onChange(
      value.map((l) =>
        l.characteristicId !== characteristicId
          ? l
          : { ...l, requirementIds: l.requirementIds.includes(requirementId) ? l.requirementIds.filter((r) => r !== requirementId) : [...l.requirementIds, requirementId] },
      ),
    );
  return (
    <div className="border-border max-h-96 space-y-1 overflow-y-auto rounded-lg border p-3">
      {characteristics.map((c) => {
        const link = value.find((l) => l.characteristicId === c.id);
        return (
          <div key={c.id}>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={Boolean(link)} onChange={() => toggle(c.id)} data-testid={`${idPrefix}-${c.code}`} />
              <span className="font-mono">{c.code}</span> {c.name}
            </label>
            {link ? (
              <div className="mb-2 ml-8 space-y-1">
                {c.requirements.map((r) => (
                  <label key={r.id} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1 size-4" checked={link.requirementIds.includes(r.id)} onChange={() => toggleRequirement(c.id, r.id)} />
                    <span>{r.description}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function EvidenceUploadForm({
  assessmentId,
  units,
  allowOrganizationWide,
  characteristics,
  supersedes,
  onCancel,
}: {
  assessmentId: string;
  units: { id: string; name: string }[];
  allowOrganizationWide: boolean;
  characteristics: CharacteristicOption[];
  supersedes?: { id: string; title: string };
  onCancel?: () => void;
}) {
  const t = useTranslations("evidence.upload");
  const tErrors = useTranslations("assessment.errors");
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(supersedes?.title ?? "");
  const [description, setDescription] = useState("");
  const [unitId, setUnitId] = useState(allowOrganizationWide ? "" : (units[0]?.id ?? ""));
  const [links, setLinks] = useState<Links>([]);
  const [status, setStatus] = useState<{ phase: "idle" | "uploading" | "verifying" | "done" | "error"; percent?: number; message?: string }>({ phase: "idle" });
  const busy = status.phase === "uploading" || status.phase === "verifying";

  const submit = async () => {
    if (!file) return setStatus({ phase: "error", message: tErrors("FILE_EMPTY") });
    setStatus({ phase: "uploading", percent: 0 });
    const request = await requestEvidenceUploadAction(assessmentId, {
      fileName: file.name,
      size: file.size,
      contentType: file.type,
      title,
      description,
      unitId: supersedes ? null : unitId || null,
      supersedesId: supersedes?.id ?? null,
    });
    if (!request.grant) return setStatus({ phase: "error", message: tErrors(request.error ?? "INVALID_INPUT") });
    try {
      await putFile(request.grant.url, request.grant.headers, file, (percent) => setStatus({ phase: "uploading", percent }));
    } catch {
      return setStatus({ phase: "error", message: t("networkError") });
    }
    setStatus({ phase: "verifying" });
    const result = await finalizeEvidenceUploadAction(assessmentId, request.grant.ticket, supersedes && links.length === 0 ? null : links);
    if (!result.version) return setStatus({ phase: "error", message: tErrors(result.error ?? "INVALID_INPUT") });
    setStatus({ phase: "done", message: t("done", { version: result.version }) });
    setFile(null);
    setLinks([]);
    if (!supersedes) setTitle("");
    router.refresh();
  };

  const prefix = supersedes ? `v-${supersedes.id}` : "new";
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {status.phase === "error" ? <Alert variant="destructive">{status.message}</Alert> : null}
      {status.phase === "done" ? (
        <Alert variant="success" data-testid="evidence-uploaded">
          {status.message}
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-file`}>{t("file")}</Label>
          <Input
            key={status.phase === "done" ? "reset" : "file"}
            id={`${prefix}-file`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-title`}>{t("titleField")}</Label>
          <Input id={`${prefix}-title`} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={300} />
        </div>
        {!supersedes ? (
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-unit`}>{t("unit")}</Label>
            <Select id={`${prefix}-unit`} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {allowOrganizationWide ? <option value="">{t("organizationWide")}</option> : null}
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-description`}>{t("description")}</Label>
          <Input id={`${prefix}-description`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{t("mapping")}</p>
        <p className="text-muted-foreground text-sm">{supersedes ? t("keepMapping") : t("mappingHint")}</p>
        <MappingPicker characteristics={characteristics} value={links} onChange={setLinks} idPrefix={`${prefix}-map`} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {status.phase === "uploading" ? t("uploading", { percent: status.percent ?? 0 }) : status.phase === "verifying" ? t("verifying") : t("submit")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {t("cancelVersion")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function EvidenceItemActions({
  assessmentId,
  evidence,
  characteristics,
  units,
  canWrite,
}: {
  assessmentId: string;
  evidence: { id: string; title: string; links: Links };
  characteristics: CharacteristicOption[];
  units: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const t = useTranslations("evidence.list");
  const tErrors = useTranslations("assessment.errors");
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "version" | "mapping">("none");
  const [links, setLinks] = useState<Links>(evidence.links);
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href={`/api/assessments/${assessmentId}/evidence/${evidence.id}`} className="text-brand-navy inline-flex min-h-9 items-center text-sm font-semibold underline" data-testid="evidence-download">
          {t("download")}
        </a>
        {canWrite ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode(mode === "version" ? "none" : "version")}>
              {t("newVersion")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode(mode === "mapping" ? "none" : "mapping")}>
              {t("editMapping")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(t("confirmDelete"))) return;
                startTransition(async () => {
                  const result = await deleteEvidenceAction(assessmentId, evidence.id);
                  setMessage(result.error ? { error: tErrors(result.error) } : { success: t("deleted") });
                  router.refresh();
                });
              }}
            >
              {t("delete")}
            </Button>
          </>
        ) : null}
      </div>
      {message?.error ? <p className="text-danger text-sm">{message.error}</p> : null}
      {message?.success ? <p className="text-success text-sm">{message.success}</p> : null}
      {mode === "version" ? (
        <EvidenceUploadForm assessmentId={assessmentId} units={units} allowOrganizationWide characteristics={characteristics} supersedes={evidence} onCancel={() => setMode("none")} />
      ) : null}
      {mode === "mapping" ? (
        <div className="space-y-2">
          <MappingPicker characteristics={characteristics} value={links} onChange={setLinks} idPrefix={`edit-${evidence.id}`} />
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateEvidenceLinksAction(assessmentId, evidence.id, links);
                setMessage(result.error ? { error: tErrors(result.error) } : { success: t("mappingSaved") });
                if (!result.error) setMode("none");
                router.refresh();
              })
            }
          >
            {t("saveMapping")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
