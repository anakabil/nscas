import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo panjang Nusa Safety. Berkas public/brand/logo-long-color.png memakai tulisan "nusa" berwarna putih,
 * sehingga ditempatkan di atas bidang navy merek agar terbaca utuh di latar terang.
 */
export function BrandLogo({ alt, className, priority }: { alt: string; className?: string; priority?: boolean }) {
  return (
    <span className={cn("bg-brand-navy inline-flex items-center rounded-lg px-3 py-2", className)}>
      <Image src="/brand/logo-long-color.png" alt={alt} width={914} height={137} priority={priority} className="h-full w-auto" />
    </span>
  );
}
