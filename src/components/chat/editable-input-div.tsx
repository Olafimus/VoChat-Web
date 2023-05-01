import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { Message } from "../../logic/types/message.types";
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
  msgInput?: string;
  type: "newMsg" | "answer" | "edit";
  trigger: boolean;
};

const InputDiv: React.FC<InputProps> = ({ msgInput = "", type, trigger }) => {
  const [msgTxt, setMsgTxt] = useState(msgInput);
  const [innerHtml, setInnerHtml] = useState("");
  const { id } = useAppSelector((state) => state.user);
  const { conversations, activeConv, newMsg } = useAppSelector(
    (state) => state.conversations
  );
  const dispatch = useAppDispatch();
  const divId = "edit--div--input";

  const sendNewMsgHandler = (newMsg = msgTxt) => {
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
          message: newMsg,
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
    const textfeld = document.getElementById(divId);
    if (!textfeld) return;
    textfeld.focus();
  };

  const handleSubmit = () => {
    if (msgTxt === "") return;
    if (id === "") return;
    sendNewMsgHandler();
  };

  const formatInnerHTML = (
    params = textHighlightMarker,
    urls: string[] = []
  ) => {
    const textfeld = document.getElementById(divId);
    if (!textfeld) return;
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
      textfeld.innerHTML = newTxt;
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
    setMsgTxt(e.currentTarget.innerHTML || "");
    // useState innerHTML, marker ersetzen
    // addEmojis();
    let text = e.currentTarget.textContent;
    if (text) text = text.replaceAll("<3", "heart");
    formatInnerHTML(textHighlightMarker, addURL(divId));
  };

  return (
    <div
      id="edit--div--input"
      onInput={editFormating}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        handleSubmit();
      }}
      contentEditable={true}
    ></div>
  );
};

export default InputDiv;
