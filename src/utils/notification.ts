export const notifyUser = async (
  user = "username",
  message = "last message"
) => {
  if (!("Notification" in window)) {
    alert("Browser does not support notifications");
  } else if (Notification.permission === "granted") {
    const notification = new Notification(user, {
      body: message,
    });
  } else if (Notification.permission !== "denied") {
    await Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        const notification = new Notification(user, {
          body: message,
        });
      }
    });
  }
};

// export function notifyUser(title = "username", body = "message") {
//   if ("serviceWorker" in navigator)
//     if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
//       // Hier die Daten für die Push-Benachrichtigung festlegen
//       const notificationData = {
//         title,
//         body,
//       };

//       // Nachricht an Service Worker senden
//       navigator.serviceWorker.controller.postMessage({
//         type: "SEND_PUSH_NOTIFICATION",
//         data: notificationData,
//       });
//     }
// }
