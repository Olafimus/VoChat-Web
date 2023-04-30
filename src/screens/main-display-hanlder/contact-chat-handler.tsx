import { useState } from "react";
import "./contac-and-chat.styles.scss";
import ChatScreen from "../chatscreen/chat-screen";
import ContactScreen from "../contacts/contacs-screen";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useAppSelector } from "../../app/hooks";
import AllAuthScreens from "../auth-screens/all-auth.screen";

const ContacChatScreen = () => {
  const { activeScreen } = useAppSelector((state) => state.settings);
  const { currentUser } = useAppSelector((state) => state.user);

  const matches = useMediaQuery("(min-width:800px)");

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
      {currentUser ? (
        <div className="screen-handler-container">
          <Content />
        </div>
      ) : (
        <AllAuthScreens />
      )}
    </>
  );
};

export default ContacChatScreen;
