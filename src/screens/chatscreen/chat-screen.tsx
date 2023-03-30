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
import ChatTextBox from "../../components/chat/text-box";

const ChatScreen = () => {
  const dispatch = useAppDispatch();
  const { conversations, activeConv, newMsg } = useAppSelector(
    (state) => state.conversations
  );
  // const { friends } = useAppSelector((state) => state.user);
  // const { theme } = useAppSelector((state) => state.settings);
  const [msgTxt, setMsgTxt] = useState("");
  // const [messages, setMessages] = useState<Message[]>([]);

  // const [contactIds, setContactIds] = useState<string[]>([]);
  // const [contacts, setContacts] = useState<string[]>([]);
  const { id } = useAppSelector((state) => state.user);
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (msgTxt === "") return;
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
    const conv = conversations.find((conv) => conv.id === activeConv);
    if (!conv) return;
    const contactIds = conv.users.filter((usr) => usr !== id);

    dispatch(updateFriendInteraction({ ids: contactIds, stamp: now }));
    sendNewMessage(activeConv, msg);
    setMsgTxt("");
  };

  const emojiHandler = (e: EmojiClickData) => {
    setOpen(false);
    setMsgTxt(msgTxt + e.emoji);
  };

  return (
    <section className="chat-screen-section">
      <div>
        <ChatTextBox />
      </div>
      <div className="chat-text-input-container">
        <TextField
          fullWidth
          id="text-input-field"
          onChange={(e) => {
            const input = document.getElementById("text-input-field");
            if (!input) return;
            setMsgTxt(e.currentTarget.value);
            input.focus();
          }}
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
