import { useState } from "react";
import "./chat.styles.scss";
import { IconButton, Box } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useAppSelector } from "../../app/hooks";
import { EmojiClickData } from "emoji-picker-react";
import ChatTextBox from "../../components/chat/text-box";
import InputDiv from "../../components/chat/editable-input-div";
import { setEndFocus } from "../../utils/text-scripts/set-focus-end";

const ChatScreen = ({ matches }: { matches: boolean }) => {
  const { activeConv } = useAppSelector((state) => state.conversations);
  const [trigger, setTrigger] = useState(false);
  const [open, setOpen] = useState(false);
  const divId = "main--edit--div--input";
  const { activeScreen } = useAppSelector((state) => state.settings);

  const triggerSubmit = () => {
    setTrigger(!trigger);
  };

  const emojiHandler = (e: EmojiClickData) => {
    const textfeld = document.getElementById(divId);
    setOpen(false);
    if (!textfeld) return;
    // textfeld.innerHTML = msgTxt + e.emoji;
    // setMsgTxt(msgTxt + e.emoji);
    textfeld.focus();
    setEndFocus(divId);
  };
  if (activeConv === "") return <></>;
  let screenCheck = false;
  if (!matches && activeScreen === "contacts") screenCheck = true;

  const hiddenStyle = { width: "0px", height: "0px", overflow: "hidden" };

  return (
    <section
      className="chat-screen-section"
      style={screenCheck ? hiddenStyle : {}}
    >
      <Box>
        <ChatTextBox matches={matches} />
      </Box>
      <div className="chat-text-input-container">
        <InputDiv trigger={trigger} type="newMsg" />
        {/* <IconButton onClick={() => setOpen(true)}>
          <EmojiEmotionsIcon />
        </IconButton> */}

        <IconButton
          className="chat-send-icon"
          color="primary"
          onClick={triggerSubmit}
        >
          <SendIcon />
        </IconButton>
      </div>
      {/* <BasicModal
        open={open}
        setOpen={setOpen}
        button={false}
        buttonText="Emoji"
      >
        <EmojiPicker onEmojiClick={emojiHandler} />
      </BasicModal> */}
    </section>
  );
};

export default ChatScreen;
