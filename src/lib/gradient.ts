/**
 * Градиент-заглушка вместо арта — один в один формула из макета Главная.dc.html.
 * Используется, когда у тайтла нет постера/баннера.
 */
export function makeGradient(
  hue: number,
  deg = 150,
  mode: "poster" | "backdrop" = "poster",
): string {
  const l1 = mode === "backdrop" ? 0.3 : 0.34;
  const l2 = mode === "backdrop" ? 0.09 : 0.1;
  const c1 = mode === "backdrop" ? 0.07 : 0.085;
  return `linear-gradient(${deg}deg, oklch(${l1} ${c1} ${hue}), oklch(${l2} 0.02 ${hue}))`;
}

/** Диагональная штриховка поверх арта — фирменная деталь макета. */
export const SCANLINES =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 9px)";

export const SCANLINES_WIDE =
  "repeating-linear-gradient(125deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 11px)";
