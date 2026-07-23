/** Бумажный самолётик Telegram — один путь на шапку, подвал и «Друзей». */
export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M21.9 4.3c.2-1-.7-1.7-1.6-1.3L2.7 9.9c-1 .4-1 1.9.1 2.2l4.5 1.4 1.7 5.5c.3.9 1.4 1.1 2 .4l2.5-2.6 4.6 3.4c.8.6 2 .2 2.2-.9l3-14.4-.4-.6zm-3.4 2.5-8.7 7.9-.3 3-1.3-4.3 10-6.9c.4-.3.8.1.3.3z" />
    </svg>
  );
}
