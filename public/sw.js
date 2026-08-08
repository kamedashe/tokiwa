/**
 * Сервис-воркер TokiWa — нужен ровно за одним: принимать пуш-уведомления.
 * Кэширование и офлайн сюда сознательно не заводим: сайт живёт на свежих
 * данных о сериях, и устаревший кэш вредил бы больше, чем помогал.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "TokiWa", body: event.data.text(), url: "/my" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "TokiWa", {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Тег схлопывает несколько уведомлений об одном тайтле в одно —
      // человеку не нужен экран из пятнадцати одинаковых карточек.
      tag: payload.tag ?? "tokiwa",
      data: { url: payload.url ?? "/my" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/my";

  // Если вкладка с сайтом уже открыта — переиспользуем её, а не плодим новые.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
