import { Typography } from "@mui/material";
import { getFormatedDate } from "../../../utils/getFormDate";
import { Message } from "../../../logic/types/message.types";

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
      <Typography
        dangerouslySetInnerHTML={{ __html: msgHTML }}
        variant="body1"
        style={{ fontSize: "16px" }}
      ></Typography>
      <Typography variant="caption">{getFormatedDate(msg.time)}</Typography>
    </div>
  );
};
