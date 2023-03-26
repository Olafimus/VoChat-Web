import React from "react";
import Push from "push.js";

import { notifyUser } from "../../utils/notification";

const SettingsScreen = () => {
  const handleClick = async () => {
    Push.create("a push");
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
