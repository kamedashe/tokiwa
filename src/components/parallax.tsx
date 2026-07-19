"use client";

import { useCallback, useRef } from "react";

/**
 * Сцена с параллаксом: дети с атрибутом data-depth смещаются за курсором.
 * Отрицательная глубина двигает слой в противоположную сторону — так в макете
 * текст «отстаёт» от фона.
 */
export function Parallax({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const layers = useCallback(
    () => ref.current?.querySelectorAll<HTMLElement>("[data-depth]") ?? [],
    [],
  );

  const onMove = (ev: React.MouseEvent<HTMLDivElement>) => {
    const scene = ref.current;
    if (!scene) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const r = scene.getBoundingClientRect();
    const dx = (ev.clientX - r.left) / r.width - 0.5;
    const dy = (ev.clientY - r.top) / r.height - 0.5;

    layers().forEach((layer) => {
      const depth = parseFloat(layer.dataset.depth ?? "0");
      layer.style.transition = "transform .25s cubic-bezier(.2,.7,.2,1)";
      layer.style.transform = `translate(${dx * depth}px, ${dy * depth}px)`;
    });
  };

  const onLeave = () => {
    layers().forEach((layer) => {
      layer.style.transform = "none";
    });
  };

  return (
    <div ref={ref} className={className} style={style} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}
