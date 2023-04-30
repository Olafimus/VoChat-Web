import { Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { Message } from "../../logic/types/message.types";
import { useAppSelector } from "../../app/hooks";
import { urlRegex } from "../../utils/chatscripts";
import { getFormatedDate } from "../../utils/getFormDate";
import "./message-box.style.scss";
import { sendResponse } from "../../utils/firebase";

type MsgProp = {
  msg: Message;
};

export type Response = {
  responded: boolean;
  responses: { senderId: string; response: string }[];
};

const MessageBox: React.FC<MsgProp> = ({ msg }) => {
  const [responses, setResponses] = useState<string[]>([]);
  const { id } = useAppSelector((state) => state.user);
  const { activeConv } = useAppSelector((state) => state.conversations);

  let response: Response = {
    responded: false,
    responses: [],
  };

  const text = msg.messageHis.at(-1)?.message || "";
  const wordArr = text.split(" ");
  wordArr.forEach((word, i) => {
    if (word.match(urlRegex)) {
      const url = word;
      let txt = word;
      if (word.length > 30) txt = txt.slice(8, 27) + "..."; // TODO usemedia query
      if (word.startsWith("www"))
        wordArr[i] = `<a href="https://${url}" target='_blank' >${txt}</a>`;
      else wordArr[i] = `<a href="${url}" target='_blank' >${txt}</a>`;
    } else if (word.length > 30) wordArr[i] = word.slice(0, 27) + "...";
    if (word.length > 40) wordArr[i] = word.slice(0, 23) + "...";
  });

  const responseHandler = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    const toolTip = e.currentTarget.closest("span");
    if (!toolTip || !e.currentTarget.textContent) return;
    toolTip.style.display = "none";
    const reset = async () => {
      await new Promise((resolve) =>
        setTimeout(() => (toolTip.style.display = "flex"), 1)
      );
    };
    const resMsg = e.currentTarget.textContent;
    // const newResponses =
    let newResponses: { senderId: string; response: string }[] = [];
    let response: Response = {
      responded: true,
      responses: [],
    };
    if (msg.response?.responded) {
      msg.response.responses.forEach((res) => newResponses.push({ ...res }));
      let myResponse = newResponses.find((res) => res.senderId === id);
      if (myResponse) {
        myResponse.response === resMsg
          ? (newResponses = newResponses.filter((el) => el.senderId !== id))
          : (myResponse.response = resMsg);
        if (!newResponses.length) response.responded = false;
        response.responses = newResponses;
      } else
        response.responses = [
          ...msg.response.responses,
          { senderId: id, response: resMsg },
        ];
    } else response.responses = [{ senderId: id, response: resMsg }];
    // response.responses = [{ senderId: id, response: resMsg }];
    if (response.responses.length < 1) response.responded = false;
    console.log(response, newResponses);
    sendResponse(activeConv, msg.id, response);
    reset();
  };

  if (msg.response?.responded) response = msg.response;
  // const responses: string[] = [];
  // console.log(responses, msg.response?.responses);
  useEffect(() => {
    const newResponses: string[] = [];
    response.responses.forEach((res) => newResponses.push(res.response));
    if (newResponses.length) setResponses(newResponses);
  }, [msg.response]);
  return (
    <div
      key={msg.id}
      className="chat-text-box-wrapper"
      style={
        msg.sender !== id
          ? response.responded
            ? { justifyContent: "flex-end", marginBottom: "10px" }
            : { justifyContent: "flex-end" }
          : response.responded
          ? { justifyContent: "flex-start", marginBottom: "10px" }
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
          className="chat-textbox-msg"
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto",
            gap: "1rem",
          }}
        >
          <Typography
            dangerouslySetInnerHTML={{ __html: wordArr.join(" ") }}
            variant="body1"
            style={{ fontSize: "16px" }}
          ></Typography>
          <Typography variant="caption">{getFormatedDate(msg.time)}</Typography>
        </div>
        <span
          className={
            msg.sender !== id
              ? "msg-tooltip msg-tooltip-left"
              : "msg-tooltip msg-tooltip-right"
          }
        >
          <button onClick={responseHandler} className="response-emoji-btn">
            😊
          </button>
          <button onClick={responseHandler} className="response-emoji-btn">
            😂
          </button>
          <button onClick={responseHandler} className="response-emoji-btn">
            👍
          </button>
          <button onClick={responseHandler} className="response-emoji-btn">
            ❤️
          </button>
          <button onClick={responseHandler} className="response-emoji-btn">
            ☹️
          </button>
          <button onClick={responseHandler} className="response-emoji-btn">
            😢
          </button>
          <button onClick={responseHandler} className="response-emoji-btn">
            😮
          </button>
        </span>
        <span
          className={
            response.responded ? "response-window responded" : "response-window"
          }
        >
          {responses.length > 0 && responses.join(" ")}
        </span>
      </div>
    </div>
  );
};

export default MessageBox;
