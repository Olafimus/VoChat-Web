import React from "react";

import { notifyUser } from "../../utils/notification";

const SettingsScreen = () => {
  const handleClick = async () => {
    await notifyUser();
  };
  return (
    <div>
      SettingsScreen
      <p>teest</p>
      <p>teest</p>
      <p>teest</p>
      <p>teest</p>
      <button onClick={handleClick}>push</button>
    </div>
  );
};

export default SettingsScreen;
