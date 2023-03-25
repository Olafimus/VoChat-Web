export const notifyUser = (text = "Here is a Notification!") => {
  if (!("Notification" in window)) {
    alert("Browser does not support notifications");
  } else if (Notification.permission === "granted") {
    const notification = new Notification(text);
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        const notification = new Notification(text);
      }
    });
  }
};
