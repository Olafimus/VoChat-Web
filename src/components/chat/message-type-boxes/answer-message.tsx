import { Typography, Box, Divider, Tooltip } from "@mui/material";
import { Message } from "../../../logic/types/message.types";

import { formatMsg } from "../../../utils/text-scripts/fortmat-message";
import { getFormatedDate } from "../../../utils/getFormDate";

const AnsweredMsgBox = ({
  msg,
  msgHTML,
  contactName,
  id,
}: {
  msg: Message;
  msgHTML: string;
  contactName: string;
  id: string;
}) => {
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
          style={{ fontSize: "16px", paddingLeft: "0.3rem" }}
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

export default AnsweredMsgBox;
