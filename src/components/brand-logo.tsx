import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo panjang Nusa Safety. Tulisan "nusa" pada public/brand/logo-long-color.png berwarna putih, sehingga logo
 * selalu tampil di atas bidang biru batu gelap: bidang kepala halaman konsol (framed=false), atau kotaknya
 * sendiri di latar terang (bawaan).
 */
export function BrandLogo({ alt, className, priority, framed = true }: { alt: string; className?: string; priority?: boolean; framed?: boolean }) {
  return (
    <span className={cn("inline-flex items-center", framed && "bg-brand-navy-deep rounded-lg px-3 py-2", className)}>
      <Image src="/brand/logo-long-color.png" alt={alt} width={914} height={137} priority={priority} className="h-full w-auto" />
    </span>
  );
}
