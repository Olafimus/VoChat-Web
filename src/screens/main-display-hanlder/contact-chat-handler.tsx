import { useState } from "react";
import "./contac-and-chat.styles.scss";
import ChatScreen from "../chatscreen/chat-screen";
import ContactScreen from "../contacts/contacs-screen";
import { useAppSelector } from "../../app/hooks";
import { useMediaQuery } from "@mui/material";
import LogInScreen from "../auth-screens/login.screen";

const ContacChatScreen = () => {
  const { activeScreen } = useAppSelector((state) => state.settings);
  const { currentUser } = useAppSelector((state) => state.user);
  const matches = useMediaQuery("(min-width:800px)");

  return (
    <>
      {currentUser ? (
        <div className="screen-handler-container">
          <span className="contact-section-wrapper">
            <ContactScreen type="big" matches={matches} />
          </span>
          <span
            className="chat-section-wrapper"
            // style={{ width: "0px", overflow: "hidden" }}
          >
            <ChatScreen matches={matches} />
          </span>
        </div>
      ) : (
        <LogInScreen />
      )}
    </>
  );
};

export default ContacChatScreen;
