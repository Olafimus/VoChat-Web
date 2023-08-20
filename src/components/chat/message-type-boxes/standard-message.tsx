import { Typography } from "@mui/material";
import { getFormatedDate } from "../../../utils/getFormDate";
import { Message } from "../../../logic/types/message.types";
import { Interweave } from "interweave";
import { UrlMatcher } from "interweave-autolink";

export const StandardMsgBox = ({
  msg,
  msgHTML,
}: {
  msg: Message;
  msgHTML: string;
}) => {
  return (
    <div
      className="chat-textbox-msg"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto",
        gap: "1rem",
      }}
    >
      <Typography variant="body1" style={{ fontSize: "16px" }}>
        <Interweave content={msgHTML} />
      </Typography>
      <Typography variant="caption">{getFormatedDate(msg.time)}</Typography>
    </div>
  );
};
