export type HealthComponent = "database" | "storage";

export interface ComponentHealth {
  component: HealthComponent;
  ok: boolean;
  latencyMs: number;
  // Hanya kode galat ringkas, tanpa pesan mentah, agar alamat koneksi atau
  // kredensial tidak pernah tampil di halaman.
  errorCode?: string;
}

export interface HealthReport {
  ok: boolean;
  checkedAt: Date;
  components: ComponentHealth[];
}

export type Probe = () => Promise<void>;

export const DEFAULT_TIMEOUT_MS = 3000;

export class ProbeTimeoutError extends Error {
  constructor() {
    super("Health probe timed out");
    this.name = "ProbeTimeoutError";
  }
}

export function errorCodeOf(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { code?: unknown; name?: unknown; Code?: unknown };
    if (typeof e.code === "string" && e.code) return e.code;
    if (typeof e.Code === "string" && e.Code) return e.Code;
    if (typeof e.name === "string" && e.name && e.name !== "Error") return e.name;
  }
  return "UNKNOWN";
}

export async function runProbe(
  component: HealthComponent,
  probe: Probe,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  now: () => number = () => performance.now(),
): Promise<ComponentHealth> {
  const started = now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProbeTimeoutError()), timeoutMs);
      }),
    ]);
    return { component, ok: true, latencyMs: now() - started };
  } catch (error) {
    return { component, ok: false, latencyMs: now() - started, errorCode: errorCodeOf(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkHealth(
  probes: Record<HealthComponent, Probe>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<HealthReport> {
  const components = await Promise.all(
    (Object.keys(probes) as HealthComponent[]).map((component) =>
      runProbe(component, probes[component], timeoutMs),
    ),
  );
  return { ok: components.every((c) => c.ok), checkedAt: new Date(), components };
}
