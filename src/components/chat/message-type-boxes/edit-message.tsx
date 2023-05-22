import React from "react";
import { Message } from "../../../logic/types/message.types";

const EditedMsgBox = ({
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
  return <div>EditedMsgBox</div>;
};

export default EditedMsgBox;
