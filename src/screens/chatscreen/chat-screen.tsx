import { useState, useLayoutEffect } from "react";
import "./chat.styles.scss";
import { Typography, TextField, IconButton } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { Message } from "../../logic/types/message.types";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { nanoid } from "@reduxjs/toolkit";
import { sendNewMessage } from "../../utils/firebase";
import { updateFriendInteraction } from "../../app/slices/user-slice";
import { getFormatedDate } from "../../utils/getFormDate";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import BasicModal from "../../components/general/basic-modal";

const ChatScreen = () => {
  const dispatch = useAppDispatch();
  const { conversations, activeConv, newMsg } = useAppSelector(
    (state) => state.conversations
  );
  const user = useAppSelector((state) => state.user);
  const { friends } = useAppSelector((state) => state.user);
  const { theme } = useAppSelector((state) => state.settings);

  const [messages, setMessages] = useState<Message[]>([]);
  const [msgTxt, setMsgTxt] = useState("");
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<string[]>([]);
  const { id } = useAppSelector((state) => state.user);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const conv = conversations.find((conv) => conv.id === activeConv);
    console.log("oha", activeConv, conversations);
    if (!conv) return;
    const messages2 = conv.messages;
    console.log("fire");
    const cIds = conv.users.filter((usr) => usr !== id);
    const contactNames: string[] = [];
    friends.forEach((fr) => {
      if (cIds.includes(fr.id) && fr.name) contactNames.push(fr.name);
    });
    setContacts(contactNames);
    setMessages(messages2);
    setContactIds(cIds);
  }, [activeConv, messages]);

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

    dispatch(updateFriendInteraction({ ids: contactIds, stamp: now }));
    sendNewMessage(activeConv, msg);
    setMsgTxt("");
    console.log(now);
  };

  const emojiHandler = (e: EmojiClickData) => {
    setOpen(false);
    console.log(e.emoji);
    setMsgTxt((curMsg) => curMsg + e.emoji);
  };

  useLayoutEffect(() => {
    const scrollBox = document.getElementById("chat--container");
    if (!scrollBox) return;
    scrollBox.scrollTop = scrollBox?.scrollHeight;
    console.log("oha 2");
  }, [messages]);
  console.log("reload", activeConv);

  return (
    <section className="chat-screen-section">
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
          {messages.map((msg) => (
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
        <IconButton onClick={() => setOpen(true)}>
          <EmojiEmotionsIcon />
        </IconButton>

        <IconButton
          className="chat-send-icon"
          color="primary"
          onClick={handleSubmit}
        >
          <SendIcon />
        </IconButton>
      </div>
      <BasicModal
        open={open}
        setOpen={setOpen}
        button={false}
        buttonText="Emoji"
      >
        <EmojiPicker onEmojiClick={emojiHandler} />
      </BasicModal>
    </section>
  );
};

export default ChatScreen;
