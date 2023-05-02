import React, { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { Message, MsgHisTypes } from "../../logic/types/message.types";
import { nanoid } from "@reduxjs/toolkit";
import {
  addEmojis,
  addURL,
  emojiShortCuts,
  setEndFocus,
  textHighlightMarker,
} from "../../utils/chatscripts";
import { updateFriendInteraction } from "../../app/slices/user-slice";
import { sendNewMessage } from "../../utils/firebase";

type InputProps = {
  type: "newMsg" | "answer" | "edit";
  trigger: boolean;
  msgInput?: string;
  focus?: boolean;
  oldMsg?: Message;
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
  const { id } = useAppSelector((state) => state.user);
  const { conversations, activeConv, newMsg } = useAppSelector(
    (state) => state.conversations
  );
  const dispatch = useAppDispatch();
  const divId = nanoid();
  const userId = id;

  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    console.log(ref);
    if (ref.current && focus) {
      console.log("ref innen: ", ref);
      ref.current.focus();
      // setEndFocus(divId);
    }
  }, [ref]);

  const createMsgObj = (sender = userId, id = nanoid()) => {
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

  const addMsgHis = (msgObj: Message, message: string, type: MsgHisTypes) => {
    msgObj.messageHis.push({
      time: Date.now(),
      editor: id,
      message,
      read: false,
      type,
    });
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
    const newMsg = createMsgObj(userId, oldMsg.id);
    oldMsg.messageHis.forEach((msg) => newMsg.messageHis.push({ ...msg }));
    addMsgHis(newMsg, answer, "answer");
    newMsg.time = Date.now();
    newMsg.sender = id;

    sendNewMessage(activeConv, newMsg);
    setMsgTxt("");
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
        console.log(oldMsg);
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

  const formatInnerHTML = (
    params = textHighlightMarker,
    urls: string[] = []
  ) => {
    const textfeld = document.getElementById(divId);
    if (!textfeld || !ref.current) return;
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
    }
    if (render) {
      // setInnerHtml(newTxt);
      setMsgTxt(newTxt);
      // textfeld.innerHTML = newTxt;
      ref.current.innerHTML = newTxt;
      textfeld.focus();
      setEndFocus(divId);
    }
  };

  useEffect(() => {
    if (msgTxt === "") return;
    if (id === "") return;
    handleSubmit();
  }, [trigger]);

  const editFormating = (e: React.FormEvent<HTMLDivElement>) => {
    console.log(e.currentTarget.innerHTML);
    setMsgTxt(e.currentTarget.innerHTML || "");
    // useState innerHTML, marker ersetzen
    // addEmojis();
    let text = e.currentTarget.textContent;
    if (text) text = text.replaceAll("<3", "heart");
    formatInnerHTML(textHighlightMarker, addURL(divId));
  };

  return (
    <div
      ref={ref}
      className="edit--div--input"
      id={divId}
      style={{ paddingLeft: "0.5rem" }}
      onKeyDown={(e) => {
        // e.preventDefault();
        if (e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        }
      }}
      onInput={editFormating}
      contentEditable={true}
    ></div>
  );
};

export default InputDiv;
