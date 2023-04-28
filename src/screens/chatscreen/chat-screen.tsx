import { useState, useLayoutEffect, useEffect } from "react";
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
import {
  addEmojis,
  addURL,
  emojiShortCuts,
  setEndFocus,
  textHighlightMarker,
} from "../../utils/chatscripts";

const ChatScreen = () => {
  const dispatch = useAppDispatch();
  const { conversations, activeConv, newMsg } = useAppSelector(
    (state) => state.conversations
  );
  const [msgTxt, setMsgTxt] = useState("");
  const [innerHtml, setInnerHtml] = useState("");
  const { id } = useAppSelector((state) => state.user);
  const [open, setOpen] = useState(false);
  const divId = "edit--div--input";

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
    setInnerHtml("");
    const textfeld = document.getElementById(divId);
    if (!textfeld) return;
    textfeld.focus();
  };

  const handleInput = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const input = document.getElementById("text-input-field");
    if (!input) return;
    const newMsg = e.currentTarget.value
      .replace(":)", "😊")
      .replace(":D", "😂")
      .replace(":(", "☹️")
      .replace("(thu)", "👍");
    setMsgTxt(newMsg);
    input.focus();
  };
  console.log("render");

  const emojiHandler = (e: EmojiClickData) => {
    const textfeld = document.getElementById(divId);
    setOpen(false);
    if (!textfeld) return;
    textfeld.innerHTML = msgTxt + e.emoji;
    setMsgTxt(msgTxt + e.emoji);
    console.log(textfeld);
    textfeld.focus();
    setEndFocus(divId);
  };

  if (activeConv === "") return <></>;

  const formatInnerHTML = (
    params = textHighlightMarker,
    urls: string[] = []
  ) => {
    const textfeld = document.getElementById(divId);
    if (!textfeld) return;
    // const txt = textfeld.textContent;
    let newTxt = addEmojis(msgTxt, emojiShortCuts);
    let render = false;
    params.forEach((para) => {
      const check = () => {
        const firstIndex = newTxt.indexOf(para[0]);
        const lastIndex = newTxt.lastIndexOf(para[0]);
        if (lastIndex > firstIndex + 1) {
          newTxt = newTxt
            .replace(para[0], para[1])
            .replace(para[0], `${para[2]}&nbsp`);
          render = true;
          if (newTxt.includes(para[0])) check();
        }
      };

      if (newTxt.includes(para[0])) check();
    });
    if (urls.length) {
      urls.forEach((url) => {
        newTxt = newTxt.replace(
          url,
          `<a href="${url}" target='_blank'>${url}</a>&nbsp`
        );
      });
      // render = true;
    }
    if (render) {
      setInnerHtml(newTxt);
      setMsgTxt(newTxt);
      textfeld.innerHTML = newTxt;
      textfeld.focus();
      setEndFocus(divId);
    }
  };

  function editFormating(e: React.FormEvent<HTMLDivElement>) {
    setMsgTxt(e.currentTarget.innerHTML || "");
    // useState innerHTML, marker ersetzen
    // addEmojis();

    formatInnerHTML(textHighlightMarker, addURL(divId));
  }

  return (
    <section className="chat-screen-section">
      <div>
        <ChatTextBox />
      </div>
      <div className="chat-text-input-container">
        {/* <TextField
          fullWidth
          id="text-input-field"
          onChange={handleInput}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            handleSubmit();
          }}
          value={msgTxt}
        /> */}
        <div
          id="edit--div--input"
          onInput={editFormating}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            handleSubmit();
          }}
          contentEditable={true}
        ></div>
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
