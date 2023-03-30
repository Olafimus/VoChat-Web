import React, { useState, useLayoutEffect } from "react";
import { Typography } from "@mui/material";

import { Message } from "../../logic/types/message.types";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

import { getFormatedDate } from "../../utils/getFormDate";

const ChatTextBox = () => {
  const dispatch = useAppDispatch();
  const { conversations, activeConv, newMsg } = useAppSelector(
    (state) => state.conversations
  );
  const { friends } = useAppSelector((state) => state.user);
  const { theme } = useAppSelector((state) => state.settings);
  const [messages, setMessages] = useState<Message[]>([]);
  const [range, setRange] = useState<{
    start: number;
    end: number;
    range: number;
  }>({ start: 0, end: 0, range: 50 });
  const [contacts, setContacts] = useState<string[]>([]);
  const { id } = useAppSelector((state) => state.user);

  useLayoutEffect(() => {
    const conv = conversations.find((conv) => conv.id === activeConv);
    if (!conv) return;
    const messages2 = conv.messages;
    const cIds = conv.users.filter((usr) => usr !== id);
    const contactNames: string[] = [];
    friends.forEach((fr) => {
      if (cIds.includes(fr.id) && fr.name) contactNames.push(fr.name);
    });
    const end = messages2.length;
    const start = end - range.range;
    setRange({ start, end, range: 50 });
    setContacts(contactNames);
    setMessages(messages2);
  }, [activeConv, conversations, newMsg]);

  useLayoutEffect(() => {
    const scrollBox = document.getElementById("chat--container");
    if (!scrollBox) return;
    scrollBox.scrollTop = scrollBox?.scrollHeight;
  }, [messages]);

  return (
    <>
      {" "}
      <h3 className="chat-title">{contacts.join(", ")}</h3>
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
          {messages.slice(range.start, range.end).map((msg) => (
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto auto",
                    gap: "1rem",
                  }}
                >
                  <Typography variant="body1" style={{ fontSize: "16px" }}>
                    {msg.messageHis[msg.messageHis.length - 1].message}
                  </Typography>
                  <Typography variant="caption">
                    {getFormatedDate(msg.time)}
                  </Typography>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default ChatTextBox;
