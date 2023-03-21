import React, { useState, useEffect } from "react";
import "./chat.styles.scss";
import { Typography, TextField, IconButton } from "@mui/material";
import Button from "@mui/material/Button";
import SendIcon from "@mui/icons-material/Send";
import { Message } from "../../logic/types/message.types";
import { useAppSelector } from "../../app/hooks";
import { nanoid } from "@reduxjs/toolkit";
import { sendNewMessage } from "../../utils/firebase";

const ChatScreen = () => {
  const { conversations, activeConv, newMsg } = useAppSelector(
    (state) => state.conversations
  );

  const [convIndex, setConvIndex] = useState<number>(-1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgTxt, setMsgTxt] = useState("");
  const { currentUser } = useAppSelector((state) => state.user);

  useEffect(() => {
    console.log("new msg?", newMsg);
    const conv = conversations.find((conv, i) => {
      if (conv.id === activeConv) {
        setConvIndex(i);
        return true;
      }
    });

    if (!conv) return;
    setMessages(conv.messages);
  }, [activeConv, newMsg]);

  const handleSubmit = () => {
    console.log(msgTxt);
    if (!currentUser) return;
    const msg: Message = {
      time: Date.now(),
      sender: currentUser.uid,
      id: nanoid(),
      language: "farsi",
      messageHis: [
        {
          time: Date.now(),
          editor: currentUser.uid,
          message: msgTxt,
        },
      ],
    };
    sendNewMessage(activeConv, msg);
    setMessages((currentMessages) => [...currentMessages, msg]);
    setMsgTxt("");
  };

  useEffect(() => {
    const scrollBox = document.getElementById("chat--container");
    if (!scrollBox) return;
    scrollBox.scrollTop = scrollBox?.scrollHeight;
  }, [messages]);

  return (
    <section className="chat-screen-section">
      <h3 className="chat-title">Chat-Contact</h3>
      <div className="chat-container" id="chat--container">
        {messages.map((msg) => (
          <div
            className="chat-text-box-wrapper"
            style={
              msg.sender !== currentUser?.uid
                ? { justifyContent: "flex-end" }
                : { justifyContent: "flex-start" }
            }
          >
            <div
              className="chat-text-box"
              style={
                msg.sender !== currentUser?.uid
                  ? { backgroundColor: "#31206a" }
                  : { backgroundColor: "#2c8a3c" }
              }
            >
              <Typography variant="body1">
                {msg.messageHis[msg.messageHis.length - 1].message}
              </Typography>
            </div>
          </div>
        ))}
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
