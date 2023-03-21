import React from "react";
import ChatScreen from "../chatscreen/chat-screen";
import ContactScreen from "../contacts/contacs-screen";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useAppSelector } from "../../app/hooks";

const ContacChatScreen = () => {
  const { activeScreen } = useAppSelector((state) => state.settings);
  const matches = useMediaQuery("(min-width:800px)");
  console.log("matches", matches);

  const Content = () => {
    if (matches)
      return (
        <>
          <ContactScreen />
          <ChatScreen />
        </>
      );
    if (!matches) {
      if (activeScreen === "chat") return <ChatScreen />;
      if (activeScreen === "contacts") return <ContactScreen />;
    }
    return <ChatScreen />;
  };
  return (
    <>
      <div
        className="screen-handler-container"
        style={{ display: "flex", height: "100%", gap: "1rem" }}
      >
        <Content />
      </div>
    </>
  );
};

export default ContacChatScreen;
