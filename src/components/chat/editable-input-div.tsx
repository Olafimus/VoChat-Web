import React, { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  Message,
  MessageHisItem,
  MsgHisTypes,
} from "../../logic/types/message.types";
import { nanoid } from "@reduxjs/toolkit";

import { updateFriendInteraction } from "../../app/slices/user-slice";
import { sendNewMessage } from "../../utils/firebase";
import { IconButton } from "@mui/material";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import BasicModal from "../general/basic-modal";
import { setEndFocus } from "../../utils/text-scripts/set-focus-end";
import { textHighlightMarker } from "../../utils/text-scripts/emoji-and-chat-highlighter";
import {
  formatInnerHTML,
  reformatHTMLtoTxt,
} from "../../utils/text-scripts/html-formating";
import { VocObj } from "../../logic/types/vocab.types";

type InputProps = {
  type: "newMsg" | "answer" | "edit";
  trigger: boolean;
  msgInput?: string;
  focus?: boolean;
  oldMsg?: Message;
};

export const createMsgObj = (sender: string) => {
  const msgObj: Message = {
    time: Date.now(),
    sender,
    id,
    language: "farsi",
    read: false,
    messageHis: [],
  };

  return msgObj;
};
const id = nanoid();
export const addMsgHis = (
  msgObj: Message,
  message: string,
  type: MsgHisTypes,
  vocab?: VocObj
) => {
  const HisItem: MessageHisItem = {
    time: Date.now(),
    editor: id,
    message,
    read: false,
    type,
  };
  if (type === "vocab") HisItem.vocab = vocab;
  msgObj.messageHis.push(HisItem);
};

const InputDiv: React.FC<InputProps> = ({
  msgInput = "",
  type,
  trigger,
  focus = false,
  oldMsg,
}) => {
  const [msgTxt, setMsgTxt] = useState(msgInput);
  const [innerHtml, setInnerHtml] = useState("");
  const [active, setActive] = useState(false);
  const { id } = useAppSelector((state) => state.user);
  const { conversations, activeConv, newMsg } = useAppSelector(
    (state) => state.conversations
  );
  const dispatch = useAppDispatch();
  const divId = nanoid();
  const userId = id;
  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current && focus) {
      ref.current.focus();
      // setEndFocus(divId);
    }
  }, [ref]);

  const emojiHandler = async (e: EmojiClickData) => {
    const textfeld = document.getElementById(divId);
    setOpen(false);
    if (!textfeld) return;
    textfeld.innerHTML = msgTxt + e.emoji;
    setMsgTxt(msgTxt + e.emoji);
    await new Promise((resolve) =>
      setTimeout(() => {
        textfeld.focus();
        setEndFocus(divId);
      }, 1)
    );
    await new Promise((resolve) =>
      setTimeout(() => {
        setEndFocus(divId);
      }, 5)
    );
  };

  const sendNewMsgHandler = (newMsg = msgTxt) => {
    const msg = createMsgObj(id);
    addMsgHis(msg, msgTxt, "standard");

    const now = Date.now();
    const conv = conversations.find((conv) => conv.id === activeConv);
    if (!conv) return;
    const contactIds = conv.users.filter((usr) => usr !== id);

    dispatch(updateFriendInteraction({ ids: contactIds, stamp: now }));
    sendNewMessage(activeConv, msg);

    setMsgTxt("");
    const textfeld = document.getElementById(divId);
    if (!textfeld) return;
    textfeld.focus();
  };

  const sendAnswerHandler = (oldMsg: Message, answer: string) => {
    const newMsg = createMsgObj(userId);
    oldMsg.messageHis.forEach((msg) => newMsg.messageHis.push({ ...msg }));
    addMsgHis(newMsg, answer, "answer");
    newMsg.time = Date.now();
    newMsg.sender = id;

    sendNewMessage(activeConv, newMsg);
    // setMsgTxt("");
  };
  const sendEditHandler = () => {};

  const handleSubmit = () => {
    if (msgTxt === "") return;
    if (id === "") return;
    if (!ref.current) return;

    switch (type) {
      case "newMsg":
        sendNewMsgHandler();
        setMsgTxt("");
        ref.current.innerHTML = "";
        break;
      case "answer":
        if (!oldMsg) return;
        sendAnswerHandler(oldMsg, msgTxt);
        setMsgTxt("");
        ref.current.innerHTML = "";
        break;
      case "edit":
        sendEditHandler();
        setMsgTxt("");
        ref.current.innerHTML = "";
        break;
      default:
        return;
        setMsgTxt("");
    }
    // sendNewMsgHandler();
  };

  useEffect(() => {
    if (msgTxt === "") return;
    if (id === "") return;
    if (active) handleSubmit();
  }, [trigger]);

  const editFormating = (e: React.FormEvent<HTMLDivElement>) => {
    const editDiv = document.getElementById(divId);
    if (!editDiv) return;
    const curHTML = e.currentTarget.innerHTML;
    const curTxt = e.currentTarget.textContent;
    if (!curHTML || !curTxt) return;
    setActive(true);
    const newInnerHTML = formatInnerHTML(curHTML);
    let newMsgTxt: string | undefined;
    if (newInnerHTML) newMsgTxt = reformatHTMLtoTxt(newInnerHTML);

    if (newMsgTxt) {
      setMsgTxt(newMsgTxt);
    } else setMsgTxt(reformatHTMLtoTxt(curHTML)); // <- diesen Schritt erst am Ende
    if (newInnerHTML) {
      editDiv.innerHTML = "";
      editDiv.focus();
      editDiv.innerHTML = newInnerHTML;
      setEndFocus(divId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const editDiv = document.getElementById(divId);
    if (!editDiv?.textContent) return;
    if (e.key === "Backspace" && editDiv.textContent.length <= 1) {
      editDiv.innerHTML = "";
    }

    if (e.key === "Enter" && !e.ctrlKey) {
      e.preventDefault();
    }
    if (e.ctrlKey && e.key === "Enter") {
      editDiv.innerHTML = editDiv.innerHTML + "<br>";
      setEndFocus(divId);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      <div
        ref={ref}
        className="edit--div--input"
        id={divId}
        style={{ paddingLeft: "0.5rem" }}
        onKeyDown={handleKeyDown}
        onInput={editFormating}
        contentEditable={true}
      ></div>

      <IconButton onClick={() => setOpen(true)}>
        <EmojiEmotionsIcon />
      </IconButton>
      <BasicModal
        open={open}
        setOpen={setOpen}
        button={false}
        buttonText="Emoji"
      >
        <EmojiPicker onEmojiClick={emojiHandler} />
      </BasicModal>
    </>
  );
};

export default InputDiv;
