import type { JSX, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "ref"> {
  /** Lebar dan tinggi; bawaan 24. Ukuran di antarmuka biasanya diatur lewat kelas, misalnya size-4. */
  size?: number | string;
}

export type Icon = ((props: IconProps) => JSX.Element) & { displayName?: string };

/**
 * Pembungkus simbol NSCAS. Garis, ujung, dan sambungan diatur di akar agar seragam dan dapat diubah lewat
 * strokeWidth; warna mengikuti teks (currentColor). Simbol bersifat hiasan (aria-hidden) kecuali diberi
 * aria-label; nama halaman tetap ada di teks tautan.
 */
export function createIcon(name: string, children: ReactNode): Icon {
  function NscasIcon({ size = 24, strokeWidth = 2, className, ...props }: IconProps) {
    const labelled = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={labelled ? undefined : true}
        role={labelled ? "img" : undefined}
        focusable="false"
        data-icon={name}
        className={cn("nscas-icon shrink-0", className)}
        {...props}
      >
        {children}
      </svg>
    );
  }
  NscasIcon.displayName = `Icon(${name})`;
  return NscasIcon;
}
