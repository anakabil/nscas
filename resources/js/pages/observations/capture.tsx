import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Camera, RotateCcw, Send, Square, Video } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NscasLockup } from '@/components/brand/nscas-mark';
import { formatWib } from '@/components/nscas/collection-shell';
import { InstallableApp } from '@/components/nscas/installable-app';
import { formatNumber } from '@/components/nscas/setup-shell';
import { Button } from '@/components/ui/button';
import { useLocale, useT } from '@/i18n';
import { postJson, sendFile, uploaded } from '@/lib/upload';
import type { Grant } from '@/lib/upload';

// Pengambilan observasi langsung dari kamera perangkat (docs/01 M6), dibawa dari v1 src/app/o/[windowId]/capture-app.tsx.
// Tidak ada isian berkas, sehingga berkas dari galeri tidak dapat dipilih. Foto diambil dari bingkai video kamera;
// video direkam tanpa suara paling lama 30 detik. Lokasi diminta dari peramban beserta akurasinya; waktu dicatat
// server.

type Props = {
    assessment: { id: string; name: string };
    organization: string;
    window: {
        id: string;
        title: string;
        unitName: string;
        opensAt: string;
        closesAt: string;
        open: boolean;
        radiusMeters: number;
    };
    checklist: { code: string; label: string; count: number }[];
    maxBytes: number;
    urls: { grant: string; finalize: string; back: string };
};
type Location = { latitude: number; longitude: number; accuracy: number } | null;
type Status =
    | { kind: 'idle' }
    | { kind: 'locating' }
    | { kind: 'sending'; percent: number }
    | { kind: 'sent'; text: string; warning: string | null }
    | { kind: 'error'; text: string };

const MAX_VIDEO_SECONDS = 30;

function currentLocation(): Promise<Location> {
    return new Promise((resolve) => {
        if (!('geolocation' in navigator)) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
        );
    });
}

function recorderType(): string | undefined {
    if (typeof MediaRecorder === 'undefined') {
        return undefined;
    }
    return ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
    );
}

export default function ObservationCapture(props: Props) {
    const t = useT();
    const locale = useLocale();
    const video = useRef<HTMLVideoElement>(null);
    const stream = useRef<MediaStream | null>(null);
    const recorder = useRef<MediaRecorder | null>(null);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const [checklist, setChecklist] = useState(props.checklist);
    const [item, setItem] = useState(props.checklist[0]?.code ?? '');
    const [cameraOn, setCameraOn] = useState(false);
    const [recording, setRecording] = useState(0);
    const [capture, setCapture] = useState<{ blob: Blob; url: string } | null>(null);
    const [note, setNote] = useState('');
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    const supported = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
    const busy = status.kind === 'locating' || status.kind === 'sending';
    const open = props.window.open;

    const stopCamera = useCallback(() => {
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        setCameraOn(false);
    }, []);

    useEffect(
        () => () => {
            stopCamera();
            if (timer.current) {
                clearInterval(timer.current);
            }
        },
        [stopCamera],
    );

    const startCamera = async () => {
        try {
            const media = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
                audio: false,
            });
            stream.current = media;
            if (video.current) {
                video.current.srcObject = media;
                await video.current.play().catch(() => undefined);
            }
            setCameraOn(true);
            setStatus({ kind: 'idle' });
        } catch {
            setStatus({ kind: 'error', text: t('observeApp.cameraError') });
        }
    };

    const keep = (blob: Blob) => {
        if (capture) {
            URL.revokeObjectURL(capture.url);
        }
        if (blob.size > props.maxBytes) {
            setStatus({ kind: 'error', text: t('observeApp.tooLarge') });
            return;
        }
        setCapture({ blob, url: URL.createObjectURL(blob) });
        setStatus({ kind: 'idle' });
    };

    const takePhoto = () => {
        const v = video.current;
        if (!v || !v.videoWidth) {
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        canvas.getContext('2d')?.drawImage(v, 0, 0);
        canvas.toBlob((blob) => blob && keep(blob), 'image/jpeg', 0.85);
    };

    const startRecording = () => {
        if (!stream.current) {
            return;
        }
        const type = recorderType();
        const rec = new MediaRecorder(stream.current, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 1_500_000 });
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => {
            if (e.data.size) {
                chunks.push(e.data);
            }
        };
        rec.onstop = () => {
            keep(new Blob(chunks, { type: (rec.mimeType || type || 'video/webm').split(';')[0] }));
            setRecording(0);
        };
        rec.start(1000);
        recorder.current = rec;
        let seconds = 0;
        setRecording(1);
        timer.current = setInterval(() => {
            seconds += 1;
            setRecording(seconds + 1);
            if (seconds >= MAX_VIDEO_SECONDS || rec.state !== 'recording') {
                if (timer.current) {
                    clearInterval(timer.current);
                }
                if (rec.state === 'recording') {
                    rec.stop();
                }
            }
        }, 1000);
    };

    const discard = () => {
        if (capture) {
            URL.revokeObjectURL(capture.url);
        }
        setCapture(null);
    };

    const send = async () => {
        if (!capture) {
            return;
        }
        setStatus({ kind: 'locating' });
        const location = await currentLocation();
        setStatus({ kind: 'sending', percent: 0 });
        const granted = await postJson<Grant>(props.urls.grant, {
            checklistItemCode: item,
            contentType: capture.blob.type,
            size: capture.blob.size,
            location,
        });
        if (!granted.ok) {
            setStatus({ kind: 'error', text: granted.message ?? t('observeApp.network') });
            return;
        }
        const sent = await sendFile(granted.data.upload, capture.blob, (fraction) =>
            setStatus({ kind: 'sending', percent: Math.round(fraction * 100) }),
        );
        if (!uploaded(sent)) {
            setStatus({ kind: 'error', text: sent === 413 ? t('observeApp.tooLarge') : t('observeApp.network') });
            return;
        }
        const done = await postJson<{ serverCapturedAt: string; outsideRadius: boolean; distanceMeters: number | null }>(
            props.urls.finalize,
            {
                ticket: granted.data.ticket,
                note,
            },
        );
        if (!done.ok) {
            setStatus({ kind: 'error', text: done.message ?? t('observeApp.network') });
            return;
        }
        const time = formatWib(done.data.serverCapturedAt, locale);
        setStatus({
            kind: 'sent',
            text: done.data.outsideRadius
                ? t('observeApp.sentOutside', {
                      time,
                      meters: formatNumber(done.data.distanceMeters ?? 0, locale),
                      radius: formatNumber(props.window.radiusMeters, locale),
                  })
                : t('observeApp.sent', { time }),
            warning: location ? null : t('observeApp.noLocation'),
        });
        setChecklist((list) => list.map((c) => (c.code === item ? { ...c, count: c.count + 1 } : c)));
        discard();
        setNote('');
    };

    return (
        <>
            <Head title={`${t('observeApp.title')} · ${props.window.title}`} />
            <InstallableApp />
            <div className="min-h-dvh bg-background">
                <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <NscasLockup label="NSCAS" className="w-28" />
                    <Link
                        href={props.urls.back}
                        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-maroon"
                    >
                        <ArrowLeft aria-hidden className="size-4" />
                        {t('observeApp.back')}
                    </Link>
                </header>
                <main className="mx-auto max-w-xl space-y-4 px-4 py-5" data-testid="observe-page">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-wide text-gold-deep">
                            {props.organization} · {props.window.unitName}
                        </p>
                        <h1 className="font-display text-2xl leading-tight text-ink">{props.window.title}</h1>
                        <p className="text-sm text-charcoal">
                            {t('observations.windows.period', {
                                opens: formatWib(props.window.opensAt, locale),
                                closes: formatWib(props.window.closesAt, locale),
                            })}
                        </p>
                    </div>
                    <p className="rounded-md bg-muted px-3 py-2 text-sm text-charcoal">{t('observeApp.identified')}</p>
                    {!open ? (
                        <p
                            className="rounded-md border border-gold/60 bg-gold/10 px-3 py-2 text-sm text-ink"
                            data-testid="observe-closed"
                        >
                            {t('observeApp.notOpen')}
                        </p>
                    ) : null}
                    {!supported ? <p className="text-sm text-destructive">{t('observeApp.unsupported')}</p> : null}

                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-foreground">{t('observeApp.item')}</span>
                        <select
                            className="h-12 w-full rounded-md border border-input bg-card px-3 text-base text-foreground"
                            value={item}
                            onChange={(e) => setItem(e.target.value)}
                            disabled={busy}
                            data-testid="observe-item"
                        >
                            {checklist.map((c) => (
                                <option key={c.code} value={c.code}>
                                    {c.code} {c.label} ({t('observeApp.captured', { count: c.count })})
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="relative overflow-hidden rounded-xl bg-ink">
                        <video
                            ref={video}
                            className={cameraOn && !capture ? 'aspect-[3/4] w-full object-cover' : 'hidden'}
                            playsInline
                            muted
                            data-testid="observe-video"
                        />
                        {capture ? (
                            capture.blob.type.startsWith('image/') ? (
                                <img
                                    src={capture.url}
                                    alt=""
                                    className="aspect-[3/4] w-full object-cover"
                                    data-testid="observe-preview"
                                />
                            ) : (
                                <video
                                    src={capture.url}
                                    className="aspect-[3/4] w-full object-cover"
                                    controls
                                    playsInline
                                    data-testid="observe-preview"
                                />
                            )
                        ) : null}
                        {!cameraOn && !capture ? (
                            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-parchment/80">
                                <Camera aria-hidden className="size-8" />
                                {t('observeApp.cameraOnly')}
                            </div>
                        ) : null}
                        {recording > 0 ? (
                            <p
                                className="absolute top-2 left-2 rounded bg-destructive px-2 py-1 text-sm text-white"
                                role="status"
                            >
                                {t('observeApp.recording', { seconds: recording, max: MAX_VIDEO_SECONDS })}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {!cameraOn ? (
                            <Button
                                size="lg"
                                className="col-span-2 h-12"
                                onClick={() => void startCamera()}
                                disabled={!supported || !open}
                                data-testid="observe-start"
                            >
                                <Camera aria-hidden />
                                {t('observeApp.startCamera')}
                            </Button>
                        ) : capture ? (
                            <Button size="lg" variant="outline" className="col-span-2 h-12" onClick={discard} disabled={busy}>
                                <RotateCcw aria-hidden />
                                {t('observeApp.retake')}
                            </Button>
                        ) : recording > 0 ? (
                            <Button size="lg" className="col-span-2 h-12" onClick={() => recorder.current?.stop()}>
                                <Square aria-hidden />
                                {t('observeApp.stopRecording')}
                            </Button>
                        ) : (
                            <>
                                <Button
                                    size="lg"
                                    className="h-12"
                                    onClick={takePhoto}
                                    disabled={!open}
                                    data-testid="observe-photo"
                                >
                                    <Camera aria-hidden />
                                    {t('observeApp.photo')}
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="h-12"
                                    onClick={startRecording}
                                    disabled={!open || !recorderType()}
                                >
                                    <Video aria-hidden />
                                    {t('observeApp.video')}
                                </Button>
                            </>
                        )}
                    </div>

                    {capture ? (
                        <div className="space-y-3">
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-foreground">{t('observeApp.note')}</span>
                                <textarea
                                    className="min-h-20 w-full rounded-md border border-input bg-card p-3 text-base"
                                    value={note}
                                    maxLength={1000}
                                    onChange={(e) => setNote(e.target.value)}
                                    disabled={busy}
                                />
                            </label>
                            <Button
                                size="lg"
                                className="h-12 w-full"
                                onClick={() => void send()}
                                disabled={busy || !open}
                                data-testid="observe-send"
                            >
                                <Send aria-hidden />
                                {status.kind === 'sending'
                                    ? t('observeApp.sending', { percent: status.percent })
                                    : status.kind === 'locating'
                                      ? t('observeApp.locating')
                                      : t('observeApp.send')}
                            </Button>
                        </div>
                    ) : null}

                    {status.kind === 'sent' ? (
                        <div className="space-y-1" data-testid="observe-sent">
                            <p
                                role="status"
                                className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
                            >
                                {status.text}
                            </p>
                            {status.warning ? <p className="text-sm text-gold-deep">{status.warning}</p> : null}
                        </div>
                    ) : null}
                    {status.kind === 'error' ? (
                        <p
                            role="alert"
                            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                            data-testid="observe-error"
                        >
                            {status.text}
                        </p>
                    ) : null}
                </main>
            </div>
        </>
    );
}
