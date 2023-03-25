export const notifyUser = async (
  user = "username",
  message = "last message"
) => {
  if (!("Notification" in window)) {
    alert("Browser does not support notifications");
  } else if (Notification.permission === "granted") {
    const notification = new Notification(user, {
      icon: "https://cdn-icons-png.flaticon.com/512/733/733585.png",
      body: message,
    });
  } else if (Notification.permission !== "denied") {
    await Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        const notification = new Notification(user, {
          icon: "https://cdn-icons-png.flaticon.com/512/733/733585.png",
          body: message,
        });
      }
    });
  }
};
