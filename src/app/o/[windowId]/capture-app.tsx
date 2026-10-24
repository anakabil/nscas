"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NextIntlClientProvider, useTranslations, type AbstractIntlMessages } from "next-intl";
import { putFile } from "@/components/upload/put-file";
import { finalizeCaptureAction, requestCaptureAction } from "./actions";

// Pengambilan observasi langsung dari kamera perangkat (docs/01 M6). Tidak ada <input type="file">, sehingga
// berkas dari galeri tidak dapat dipilih. Foto diambil dari bingkai video kamera; video direkam dengan
// MediaRecorder tanpa suara. Lokasi diminta dari peramban beserta akurasinya; waktu dicatat server.

interface Props {
  windowId: string;
  locale: "id" | "en";
  messages: AbstractIntlMessages;
  organizationName: string;
  unitName: string;
  title: string;
  open: boolean;
  period: { opens: string; closes: string };
  checklist: { code: string; label: string; count: number }[];
}

export function CaptureApp(props: Props) {
  return (
    <NextIntlClientProvider locale={props.locale} messages={{ observeApp: props.messages }} timeZone="Asia/Jakarta">
      <Capture {...props} />
    </NextIntlClientProvider>
  );
}

const MAX_VIDEO_SECONDS = 30;
type Location = { latitude: number; longitude: number; accuracy: number } | null;

function currentLocation(): Promise<Location> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

function recorderType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
}

function Capture({ windowId, organizationName, unitName, title, open, period, checklist: initialChecklist }: Props) {
  const t = useTranslations("observeApp");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [item, setItem] = useState(initialChecklist[0]?.code ?? "");
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(0);
  const [capture, setCapture] = useState<{ blob: Blob; url: string } | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "locating" | "sending" | "sent" | "error"; text?: string; percent?: number; warning?: string }>({ kind: "idle" });
  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false });
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play().catch(() => undefined);
      }
      setCameraOn(true);
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", text: t("cameraError") });
    }
  };

  const keep = (blob: Blob) => {
    if (capture) URL.revokeObjectURL(capture.url);
    setCapture({ blob, url: URL.createObjectURL(blob) });
  };

  const takePhoto = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob((blob) => blob && keep(blob), "image/jpeg", 0.85);
  };

  const startRecording = () => {
    if (!stream.current) return;
    const type = recorderType();
    const rec = new MediaRecorder(stream.current, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 1_500_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      keep(new Blob(chunks, { type: (rec.mimeType || type || "video/webm").split(";")[0] }));
      setRecording(0);
    };
    rec.start(1000);
    recorder.current = rec;
    let seconds = 0;
    setRecording(1);
    const timer = setInterval(() => {
      seconds += 1;
      setRecording(seconds + 1);
      if (seconds >= MAX_VIDEO_SECONDS || rec.state !== "recording") {
        clearInterval(timer);
        if (rec.state === "recording") rec.stop();
      }
    }, 1000);
  };

  const send = async () => {
    if (!capture) return;
    setStatus({ kind: "locating", text: t("locating") });
    const location = await currentLocation();
    setStatus({ kind: "sending", percent: 0 });
    const request = await requestCaptureAction(windowId, {
      checklistItemCode: item,
      contentType: capture.blob.type,
      size: capture.blob.size,
      location,
    }).catch(() => ({ grant: undefined, error: "NETWORK" }));
    if (!request.grant) return setStatus({ kind: "error", text: t(`errors.${request.error ?? "NETWORK"}`) });
    try {
      await putFile(request.grant.url, request.grant.headers, capture.blob, (percent) => setStatus({ kind: "sending", percent }));
    } catch {
      return setStatus({ kind: "error", text: t("errors.NETWORK") });
    }
    const done = await finalizeCaptureAction(windowId, request.grant.ticket, note).catch(() => ({ result: undefined, error: "NETWORK" }));
    if (!done.result) return setStatus({ kind: "error", text: t(`errors.${done.error ?? "NETWORK"}`) });
    const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(new Date(done.result.serverCapturedAt));
    setStatus({
      kind: "sent",
      text: done.result.outsideRadius ? t("sentOutside", { meters: done.result.distanceMeters ?? 0 }) : `${t("sent", { time: `${time} WIB` })}`,
      warning: location ? undefined : t("noLocation"),
    });
    setChecklist((list) => list.map((c) => (c.code === item ? { ...c, count: c.count + 1 } : c)));
    URL.revokeObjectURL(capture.url);
    setCapture(null);
    setNote("");
  };

  const busy = status.kind === "locating" || status.kind === "sending";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground text-sm font-semibold">
          {organizationName} · {unitName}
        </p>
        <h1 className="text-brand-navy text-xl font-bold">{title}</h1>
        <p className="text-sm">{t("period", { opens: period.opens, closes: period.closes })}</p>
      </div>
      <p className="bg-tint rounded-lg px-3 py-2 text-sm">{t("identified")}</p>
      {!open ? (
        <p className="bg-heat-mid text-warning rounded-lg px-3 py-2" data-testid="observe-closed">
          {t("notOpen")}
        </p>
      ) : null}
      {!supported ? <p className="text-danger">{t("unsupported")}</p> : null}

      <label className="block space-y-1">
        <span className="text-sm font-semibold">{t("item")}</span>
        <select className="border-input bg-card h-12 w-full rounded-md border px-3" value={item} onChange={(e) => setItem(e.target.value)} disabled={busy}>
          {checklist.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} {c.label} ({t("captured", { count: c.count })})
            </option>
          ))}
        </select>
      </label>

      <p className="text-muted-foreground text-sm">{t("cameraOnly")}</p>
      <div className="bg-foreground/90 relative overflow-hidden rounded-xl">
        <video ref={video} className={`aspect-[3/4] w-full object-cover ${cameraOn && !capture ? "" : "hidden"}`} playsInline muted data-testid="observe-video" />
        {capture ? (
          capture.blob.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element -- pratinjau blob lokal
            <img src={capture.url} alt="" className="aspect-[3/4] w-full object-cover" data-testid="observe-preview" />
          ) : (
            <video src={capture.url} className="aspect-[3/4] w-full object-cover" controls playsInline data-testid="observe-preview" />
          )
        ) : null}
        {recording > 0 ? <p className="bg-danger absolute top-2 left-2 rounded px-2 py-1 text-sm text-white">{t("recording", { seconds: recording })}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!cameraOn ? (
          <button type="button" className="survey-primary col-span-2" onClick={() => void startCamera()} disabled={!supported || !open}>
            {t("startCamera")}
          </button>
        ) : capture ? (
          <button type="button" className="survey-secondary col-span-2" onClick={() => setCapture(null)} disabled={busy}>
            {t("retake")}
          </button>
        ) : recording > 0 ? (
          <button type="button" className="survey-primary col-span-2" onClick={() => recorder.current?.stop()}>
            {t("stopRecording")}
          </button>
        ) : (
          <>
            <button type="button" className="survey-primary" onClick={takePhoto} disabled={!open}>
              {t("photo")}
            </button>
            <button type="button" className="survey-secondary" onClick={startRecording} disabled={!open || !recorderType()}>
              {t("video")}
            </button>
          </>
        )}
      </div>

      {capture ? (
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">{t("note")}</span>
            <textarea className="border-input bg-card min-h-20 w-full rounded-md border p-3" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className="survey-primary w-full" onClick={() => void send()} disabled={busy || !open} data-testid="observe-send">
            {status.kind === "sending" ? t("sending", { percent: status.percent ?? 0 }) : status.kind === "locating" ? t("locating") : t("send")}
          </button>
        </div>
      ) : null}

      {status.kind === "sent" ? (
        <p role="status" className="bg-heat-good text-success rounded-lg px-3 py-2" data-testid="observe-sent">
          {status.text}
        </p>
      ) : null}
      {status.warning ? <p className="text-warning text-sm">{status.warning}</p> : null}
      {status.kind === "error" ? (
        <p role="alert" data-slot="alert" className="bg-heat-low text-danger rounded-lg px-3 py-2">
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
