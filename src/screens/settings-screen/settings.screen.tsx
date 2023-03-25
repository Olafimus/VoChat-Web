import React from "react";

import { notifyUser } from "../../utils/notification";

const SettingsScreen = () => {
  return (
    <div>
      SettingsScreen
      <p>teest</p>
      <p>teest</p>
      <p>teest</p>
      <p>teest</p>
      <button onClick={() => notifyUser()}>push</button>
    </div>
  );
};

export default SettingsScreen;
