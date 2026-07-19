import Image from "next/image";
import { SCANLINES, makeGradient } from "@/lib/gradient";

/**
 * Арт тайтла: настоящий постер, если он есть, иначе градиент-заглушка из
 * макета. Диагональная штриховка ложится сверху в обоих случаях — это
 * фирменная деталь оформления.
 */
export function Artwork({
  src,
  alt,
  hue,
  deg = 150,
  mode = "poster",
  sizes,
  priority = false,
  scanlines = SCANLINES,
  quality = 85,
}: {
  src?: string | null;
  alt: string;
  hue: number;
  deg?: number;
  mode?: "poster" | "backdrop";
  sizes: string;
  priority?: boolean;
  scanlines?: string;
  quality?: number;
}) {
  return (
    <>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          quality={quality}
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: makeGradient(hue, deg, mode) }} />
      )}
      <div className="absolute inset-0" style={{ background: scanlines }} aria-hidden />
    </>
  );
}
