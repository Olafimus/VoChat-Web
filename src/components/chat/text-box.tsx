import React, { useState, useLayoutEffect } from "react";
import { Typography } from "@mui/material";

import { Message } from "../../logic/types/message.types";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

import { getFormatedDate } from "../../utils/getFormDate";
import InnerTextBox from "./text-box-formater";
import { urlRegex } from "../../utils/chatscripts";
import MessageBox from "./message-box";

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
    let start = end - range.range;
    if (start < 0) start = 0;
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
          {messages.slice(range.start, range.end).map(
            (msg) => (
              <MessageBox msg={msg} />
            )
            // {
            //   const text = msg.messageHis.at(-1)?.message || "";
            //   const wordArr = text.split(" ");
            //   wordArr.forEach((word, i) => {
            //     if (word.match(urlRegex)) {
            //       const url = word;
            //       let txt = word;
            //       if (word.length > 100) txt = txt.slice(0, 100) + "...";
            //       if (word.startsWith("www"))
            //         wordArr[
            //           i
            //         ] = `<a href="https://${url}" target='_blank' >${txt}</a>`;
            //       else
            //         wordArr[i] = `<a href="${url}" target='_blank' >${txt}</a>`;
            //     }
            //   });
            //   return (
            //     <div
            //       key={msg.id}
            //       className="chat-text-box-wrapper"
            //       style={
            //         msg.sender !== id
            //           ? { justifyContent: "flex-end" }
            //           : { justifyContent: "flex-start" }
            //       }
            //     >
            //       <div
            //         className="chat-text-box"
            //         style={
            //           msg.sender !== id
            //             ? { backgroundColor: "#31206a" }
            //             : { backgroundColor: "#2c8a3c" }
            //         }
            //       >
            //         <div
            //           style={{
            //             display: "grid",
            //             gridTemplateColumns: "auto auto",
            //             gap: "1rem",
            //           }}
            //         >
            //           <Typography
            //             dangerouslySetInnerHTML={{ __html: wordArr.join(" ") }}
            //             variant="body1"
            //             style={{ fontSize: "16px" }}
            //           ></Typography>
            //           <Typography variant="caption">
            //             {getFormatedDate(msg.time)}
            //           </Typography>
            //         </div>
            //       </div>
            //     </div>
            //   );
            // }
          )}
        </div>
      </div>
    </>
  );
};

export default ChatTextBox;
