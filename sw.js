const CACHE_NAME = "my-pwa-cache";

// self.addEventListener("install", (event) => {
//   try {
//     event.waitUntil(
//       caches.open(CACHE_NAME).then((cache) => {
//         return cache.addAll([
//           "/",
//           "/index.html",
//           "/styles.css",
//           // Hier weitere Ressourcen hinzufügen, die du cachen möchtest
//         ]);
//       })
//     );
//   } catch (error) {}
// });

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SEND_PUSH_NOTIFICATION") {
    const notificationData = event.data.data;
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      // Weitere Optionen für die Benachrichtigung konfigurieren
    });
  }
});
