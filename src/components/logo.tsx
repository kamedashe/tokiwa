/**
 * Знак TokiWa — песочные часы. «Toki» (時) значит «время», а весь трекер
 * построен вокруг подсчёта часов, так что форма работает сразу на два смысла.
 *
 * Градиент объявляется с уникальным id: на странице знак встречается дважды
 * (шапка и подвал), а одинаковые id ломают отрисовку в Safari.
 */
export function Logo({ size = 26, id = "logo" }: { size?: number; id?: string }) {
  const gradientId = `tokiwa-mark-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB020" />
          <stop offset="1" stopColor="#FF7A3D" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />

      <rect x="19" y="14" width="26" height="5" rx="2.5" fill="#050506" />
      <rect x="19" y="45" width="26" height="5" rx="2.5" fill="#050506" />

      <path d="M23 19h18l-8 12 8 13H23l8-13-8-12Z" fill="#050506" />
    </svg>
  );
}
