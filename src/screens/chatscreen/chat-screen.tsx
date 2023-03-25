import { useState, useEffect, useLayoutEffect } from "react";
import "./chat.styles.scss";
import { Typography, TextField, IconButton } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { Message } from "../../logic/types/message.types";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { $CombinedState, nanoid } from "@reduxjs/toolkit";
import { sendNewMessage } from "../../utils/firebase";
import { updateFriendInteraction } from "../../app/slices/user-slice";

const ChatScreen = () => {
  const dispatch = useAppDispatch();
  const { conversations, activeConv, newMsg } = useAppSelector(
    (state) => state.conversations
  );
  const { friends } = useAppSelector((state) => state.user);
  const { theme } = useAppSelector((state) => state.settings);

  // const [convIndex, setConvIndex] = useState<number>(-1);
  // const [messages, setMessages] = useState<Message[]>([]);
  const [msgTxt, setMsgTxt] = useState("");
  const [contactIds, setContactIds] = useState<string[]>([]);
  // const [contacts, setContacts] = useState<string[]>([]);
  const { currentUser, id } = useAppSelector((state) => state.user);

  const conv = conversations.find((conv) => conv.id === activeConv);
  if (!conv) return <></>;
  const messages2 = conv.messages;
  console.log("fire");
  const cIds = conv.users.filter((usr) => usr !== id);
  const contactNames: string[] = [];
  friends.forEach((fr) => {
    if (cIds.includes(fr.id) && fr.name) contactNames.push(fr.name);
  });

  // useLayoutEffect(() => {
  //   const conv = conversations.find((conv, i) => {
  //     if (conv.id === activeConv) {
  //       setConvIndex(i);
  //       return true;
  //     }
  //   });

  //   if (!conv) return;
  //   const cIds = conv.users.filter((usr) => usr !== id);
  //   const contactNames: string[] = [];
  //   friends.forEach((fr) => {
  //     if (cIds.includes(fr.id) && fr.name) contactNames.push(fr.name);
  //   });
  //   setMessages(conv.messages);
  //   setContactIds(cIds);
  //   setContacts(contactNames);
  //   console.log(contactNames, "new fired");
  // }, []);

  const handleSubmit = () => {
    if (id === "") return;
    const msg: Message = {
      time: Date.now(),
      sender: id,
      id: nanoid(),
      language: "farsi",
      read: false,
      messageHis: [
        {
          time: Date.now(),
          editor: id,
          message: msgTxt,
          read: false,
        },
      ],
    };
    const now = Date.now();
    dispatch(updateFriendInteraction({ ids: cIds, stamp: now }));
    sendNewMessage(activeConv, msg);
    setMsgTxt("");
    console.log(now);
  };

  useLayoutEffect(() => {
    const scrollBox = document.getElementById("chat--container");
    if (!scrollBox) return;
    scrollBox.scrollTop = scrollBox?.scrollHeight;
  }, []);

  return (
    <section className="chat-screen-section">
      <h3 className="chat-title">{contactNames.join(", ")}</h3>
      <div
        style={
          theme === "light"
            ? { backgroundColor: "rgb(200, 200, 200)", color: "white" }
            : { backgroundColor: "rgb(24, 24, 24)" }
        }
        className="chat-container"
        id="chat--container"
      >
        <div>
          {messages2.map((msg) => (
            <div
              key={msg.id}
              className="chat-text-box-wrapper"
              style={
                msg.sender !== id
                  ? { justifyContent: "flex-end" }
                  : { justifyContent: "flex-start" }
              }
            >
              <div
                className="chat-text-box"
                style={
                  msg.sender !== id
                    ? { backgroundColor: "#31206a" }
                    : { backgroundColor: "#2c8a3c" }
                }
              >
                <Typography variant="body1" style={{ fontSize: "16px" }}>
                  {msg.messageHis[msg.messageHis.length - 1].message}
                </Typography>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chat-text-input-container">
        <TextField
          fullWidth
          id="fullWidth"
          onChange={(e) => setMsgTxt(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            handleSubmit();
          }}
          value={msgTxt}
        />

        <IconButton
          className="chat-send-icon"
          color="primary"
          onClick={handleSubmit}
        >
          <SendIcon />
        </IconButton>
      </div>
    </section>
  );
};

export default ChatScreen;
