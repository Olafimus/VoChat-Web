import { useState } from "react";
import "./chat.styles.scss";
import { IconButton } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useAppSelector } from "../../app/hooks";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import BasicModal from "../../components/general/basic-modal";
import ChatTextBox from "../../components/chat/text-box";
import { setEndFocus } from "../../utils/chatscripts";
import InputDiv from "../../components/chat/editable-input-div";

const ChatScreen = () => {
  const { activeConv } = useAppSelector((state) => state.conversations);
  const [trigger, setTrigger] = useState(false);
  const [msgTxt, setMsgTxt] = useState("");
  const [open, setOpen] = useState(false);
  const divId = "edit--div--input";

  const triggerSubmit = () => {
    setTrigger(!trigger);
  };

  const emojiHandler = (e: EmojiClickData) => {
    const textfeld = document.getElementById(divId);
    setOpen(false);
    if (!textfeld) return;
    textfeld.innerHTML = msgTxt + e.emoji;
    setMsgTxt(msgTxt + e.emoji);
    textfeld.focus();
    setEndFocus(divId);
  };

  if (activeConv === "") return <></>;

  return (
    <section className="chat-screen-section">
      <div>
        <ChatTextBox />
      </div>
      <div className="chat-text-input-container">
        <InputDiv trigger={trigger} type="newMsg" />
        <IconButton onClick={() => setOpen(true)}>
          <EmojiEmotionsIcon />
        </IconButton>

        <IconButton
          className="chat-send-icon"
          color="primary"
          onClick={triggerSubmit}
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
