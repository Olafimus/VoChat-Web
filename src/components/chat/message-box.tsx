import { Typography } from "@mui/material";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import React, { useEffect, useState, useRef } from "react";
import { Message, MsgHisTypes } from "../../logic/types/message.types";
import { useAppSelector } from "../../app/hooks";
import { getFormatedDate } from "../../utils/getFormDate";
import "./message-box.style.scss";
import { sendResponse } from "../../utils/firebase";
import InputDiv from "./editable-input-div";
import { IconButton } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { urlRegex } from "../../utils/text-scripts/add-url";
import { formatInnerHTML } from "../../utils/text-scripts/html-formating";

type MsgProp = {
  msg: Message;
  contactName: string;
};

export type Response = {
  responded: boolean;
  responses: { senderId: string; response: string }[];
};

const style = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  // width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

const MessageBox: React.FC<MsgProp> = ({ msg, contactName }) => {
  const [responses, setResponses] = useState<string[]>([]);
  // const focus = useRef<HTMLInputElement>(null);
  const { id, name } = useAppSelector((state) => state.user);
  const { activeConv } = useAppSelector((state) => state.conversations);
  const [trigger, setTrigger] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [edited, setEdited] = useState(false);
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  // const [msgType, setMsgType] = useState<MsgHisTypes>("standard");

  const triggerSubmit = async () => {
    setTrigger(!trigger);
    await new Promise((resolve) => setTimeout(() => handleClose(), 1));
    handleClose();
  };

  let response: Response = {
    responded: false,
    responses: [],
  };
  let msgType = "standard";
  if (msg.messageHis.at(-1)?.type === "answer") msgType = "answer";
  if (msg.messageHis.at(-1)?.type === "edit") msgType = "edit";

  // formating URLs and too long words
  const text = msg.messageHis.at(-1)?.message || "";
  const formatMsg = (txt: string) => {
    const wordArr = txt.split(" ");
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
    return wordArr.join(" ");
  };

  const msgText = formatMsg(text);
  const msgHTML = formatInnerHTML(msgText) || msgText;

  const resetToolTip = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    const toolTip = e.currentTarget.closest("span");
    if (!toolTip || !e.currentTarget.textContent) return;
    toolTip.style.display = "none";
    await new Promise((resolve) =>
      setTimeout(() => (toolTip.style.display = "flex"), 1)
    );
  };

  const responseHandler = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    if (!e.currentTarget.textContent) return;
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
    sendResponse(activeConv, msg.id, response);
    resetToolTip(e);
  };

  const editHandler = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    setEdited(true);
    setAnswered(false);
    // setMsgType("answered");
    resetToolTip(e);
    handleOpen();
  };
  const answerHandler = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    setEdited(false);
    setAnswered(true);
    // setMsgType("answered");
    resetToolTip(e);
    handleOpen();
  };

  if (msg.response?.responded) response = msg.response;

  // loading responses from the DB
  useEffect(() => {
    const newResponses: string[] = [];
    response.responses.forEach((res) => newResponses.push(res.response));
    if (newResponses.length) setResponses(newResponses);
  }, [msg.response]);

  const StandardMsgBox = () => {
    return (
      <div
        className="chat-textbox-msg"
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto",
          gap: "1rem",
        }}
      >
        <Typography
          dangerouslySetInnerHTML={{ __html: msgHTML }}
          variant="body1"
          style={{ fontSize: "16px" }}
        ></Typography>
        <Typography variant="caption">{getFormatedDate(msg.time)}</Typography>
      </div>
    );
  };

  const AnsweredMsgBox = () => {
    const oldText = msg.messageHis.at(-2)?.message || "";
    const oldMsgtxt = formatMsg(oldText);
    let senderName = contactName;
    if (msg.messageHis.at(-2)?.editor === id) senderName = "you";
    const oldTime = msg.messageHis.at(-2)?.time || msg.time;

    const captionStyles = {
      fontSize: "12px",
      position: "absolute",
      top: "-1px",
      left: "20px",

      paddingLeft: "2px",
      paddingRight: "2px",
    };
    return (
      <>
        <div
          className="chat-textbox-msg"
          style={{
            display: "grid",
            gridTemplateColumns: "auto 40px",
            gap: "1rem",
            marginBottom: "0.5rem",
            borderStyle: "solid",
            borderRadius: "0.2rem",
            borderWidth: "2px",
            paddingTop: "5px",
          }}
        >
          <Typography
            dangerouslySetInnerHTML={{ __html: oldText }}
            variant="body1"
            style={{ fontSize: "16px" }}
          ></Typography>
          <Typography variant="caption" sx={{ paddingTop: "0.2rem" }}>
            {getFormatedDate(oldTime)}
          </Typography>
          <span
            className="sender-name-caption"
            style={{
              fontSize: "12px",
              position: "absolute",
              top: "-1px",
              left: "20px",
              backgroundColor: "#2c8a3c",
              paddingLeft: "2px",
              paddingRight: "2px",
            }}
          >
            {senderName}
          </span>
        </div>
        <span className="message-box-divider"></span>
        <div
          className="chat-textbox-msg"
          style={{
            display: "grid",
            gridTemplateColumns: "auto 30px",
            gap: "1rem",
          }}
        >
          <Typography
            dangerouslySetInnerHTML={{ __html: msgHTML }}
            variant="body1"
            style={{ fontSize: "16px" }}
          ></Typography>
          <Typography variant="caption">{getFormatedDate(msg.time)}</Typography>
        </div>
      </>
    );
  };

  const EditedMsgBox = () => {
    return <div>Edited</div>;
  };

  return (
    <>
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
          {msgType === "standard" && <StandardMsgBox />}
          {msgType === "answer" && <AnsweredMsgBox />}
          {msgType === "edit" && <EditedMsgBox />}
          <span
            className={
              msg.sender !== id
                ? "msg-tooltip msg-tooltip-left"
                : "msg-tooltip msg-tooltip-right"
            }
          >
            {["😊", "😂", "👍", "❤️", "☹️", "😢", "😮"].map((emoji) => (
              <button
                key={emoji}
                value={emoji}
                onClick={responseHandler}
                className="response-emoji-btn"
              >
                {emoji}
              </button>
            ))}
            <div className="response-divider"></div>
            <button onClick={editHandler} className="response-emoji-btn">
              🖊️
            </button>
            <button onClick={answerHandler} className="response-emoji-btn">
              ↩️
            </button>
          </span>
          <span
            className={
              response.responded
                ? "response-window responded"
                : "response-window"
            }
          >
            {responses.length > 0 && responses.join(" ")}
          </span>
        </div>
      </div>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <span className="answer-edit-wrapper">
            <Typography
              id="modal-modal-title"
              variant="h6"
              component="h2"
              dangerouslySetInnerHTML={{ __html: text }}
              style={{
                border: "solid 0.15rem #2756ef",
                padding: "0.5rem",
                // paddingLeft: "0.5rem",
                minWidth: "200px",
                marginBottom: "8px",
                borderRadius: "5px",
              }}
            ></Typography>
            <span className="msg-sender">{name}</span>
          </span>

          <div className="input-wraper" style={{ display: "flex" }}>
            <span
              className="chat-text-input-container"
              style={{ flex: "1", height: "10px" }}
            >
              <InputDiv
                focus={true}
                type="answer"
                trigger={trigger}
                oldMsg={msg}
              />
            </span>
            <IconButton
              className="chat-send-icon"
              color="primary"
              onClick={triggerSubmit}
            >
              <SendIcon />
            </IconButton>
          </div>
        </Box>
      </Modal>
    </>
  );
};

export default MessageBox;
