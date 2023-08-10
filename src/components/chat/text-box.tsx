import { useState, useLayoutEffect, useRef, useEffect, useMemo } from "react";
import { Button, Box } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Message, MsgHisTypes } from "../../logic/types/message.types";
import { useAppSelector } from "../../app/hooks";
import MessageBox from "./message-box";
import { Conversation } from "../../logic/classes/conversation.class";
import ChatBoxHeader from "./text-box-header";

const ChatTextBox = ({ matches }: { matches: boolean }) => {
  const { conversations, activeConv, oldMessages } = useAppSelector(
    (state) => state.conversations
  );
  const { friends } = useAppSelector((state) => state.user);
  const { theme } = useAppSelector((state) => state.settings);
  const [messages, setMessages] = useState<Message[]>([]);
  const [range, setRange] = useState<{
    start: number;
    end: number;
    range: number;
  }>({ start: 0, end: 0, range: 50 });
  const [scroll, setScroll] = useState(false);
  const [firstLoad, setFirstLoad] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollType, setScrollType] = useState<"up" | "down">("up");
  const [filterSet, setFilterSet] = useState<{
    lang: string;
    msgTypes: MsgHisTypes[];
  }>({ lang: "all", msgTypes: ["answer", "edit", "vocab", "wb", "standard"] });
  const [contacts, setContacts] = useState<string[]>([]);
  const [newMsg, setNewMsg] = useState(false);
  const { id } = useAppSelector((state) => state.user);
  const containerRef = useRef<HTMLDivElement>(null);
  const container = containerRef.current;

  const loadOldMsgs = (ref: string, count: number) => {
    const oldMsgs = oldMessages.find((el) => el.ref === ref)?.msgs;
    const oldMsgArr: Message[] = [];
    console.log(ref);
    if (oldMsgs) {
      let num = 1;
      if (count > 10) num = count - 10; // state einfügen mit thereIsMore = true

      for (let i = num; i < count; i++) {
        if (oldMsgs[i]) oldMsgArr.push(...oldMsgs[i]);
      }
    }
    return oldMsgArr;
  };
  const conv = conversations.find((conv) => conv.id === activeConv);
  const cIds = conv?.users.filter((usr) => usr !== id) || [];

  const defaultLoad = () => {
    if (!conv) return;
    // if (scrolled && !firstLoad) return setNewMsg(true);
    const newMessages = conv.messages;
    const oldMsgArr = loadOldMsgs(
      conv.longTermRef || "none",
      conv.longTermCount || 0
    );

    const allMsgs = [...oldMsgArr, ...newMessages];
    const end = allMsgs.length;
    let start = end - range.range;
    if (start < 0) start = 0;
    setRange({ start, end, range: 50 });
    const filteredAllMsgs = allMsgs.filter((msg) => {
      const type = msg.messageHis.at(-1)?.type;
      if (!type) return false;
      return filterSet.msgTypes.includes(type);
    });

    setMessages(filteredAllMsgs);
  };

  useEffect(() => {
    if (!conv) return;
    const contactNames: string[] = [];
    friends.forEach((fr) => {
      if (cIds.includes(fr.id) && fr.name) contactNames.push(fr.name);
    });
    setContacts(contactNames);

    setFirstLoad(false);
  }, [activeConv]);

  useLayoutEffect(() => {
    defaultLoad();
  }, [activeConv, conversations, filterSet]);

  useLayoutEffect(() => {
    const scrollBox = document.getElementById("chat--container");
    if (!scrollBox) return;
    scrollBox.scrollTop = scrollBox?.scrollHeight;
  }, [messages]);

  const backToContacts = () => {};

  const handleScroll = () => {
    if (!container) return;
    if (container?.scrollTop === 0) scrollUpHandler(container.scrollHeight);
    if (
      Math.ceil(container.scrollTop) + container.clientHeight ===
      container.scrollHeight
    )
      scrollDownHandler();
  };
  useEffect(() => {
    if (range.end !== messages.length) return;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [range]);

  const scrollUpHandler = (height: number) => {
    if (!container) return;
    if (range.start === 0) return;
    let start = range.start - 5;
    let end = range.end - 5;
    if (start < 0) start = 0;
    // if (start === 0) end = range.range;
    setRange({ start, end, range: range.range });
    //container.scrollTop = height;
    setScroll(true);
    setScrollType("up");
    setScrolled(true);
  };
  const scrollDownHandler = () => {
    if (!container) return;
    if (range.end === messages.length) return;
    let start = range.start + range.range / 2;
    let end = range.end + range.range / 2;
    if (end > messages.length) {
      end = messages.length;
      setScrolled(false);
    }
    if (end === messages.length) start = end - range.range;
    setRange({ start, end, range: range.range });
    setScroll(true);
    setScrollType("down");
  };

  useEffect(() => {
    if (!scroll) return;
    if (!container) return;
    if (scrollType === "up") container.scrollTop = 100;
    // if (scrollType === "down") container.scrollTop = container.scrollHeight - 5;
    setScroll(false);
  }, [scroll]);

  const searchFunc = (search: string) => {
    console.log(messages);
    const filteredMsgs = messages.filter((msg) =>
      msg.messageHis.at(-1)?.message.includes(search)
    );
    console.log(filteredMsgs);
    setMessages(filteredMsgs);
  };

  const resetSearch = () => {
    defaultLoad();
  };

  return (
    <>
      <ChatBoxHeader
        names={contacts.join(", ")}
        searchFunc={searchFunc}
        resetSearch={resetSearch}
        cIds={cIds}
        setFilterSet={setFilterSet}
        filterSet={filterSet}
      />
      <div
        style={
          theme === "light"
            ? { backgroundColor: "rgb(200, 200, 200)", color: "white" }
            : { backgroundColor: "rgb(24, 24, 24)" }
        }
        className="chat-container"
        id="chat--container"
        ref={containerRef}
        onScroll={handleScroll}
      >
        <Box sx={{ minHeight: "67vh" }}>
          {messages.slice(range.start, range.end).map((msg) => (
            <MessageBox
              key={msg.time}
              msg={msg}
              contactName={contacts.join(", ")}
            />
          ))}
          <Button
            sx={
              scrolled
                ? {
                    position: "absolute",
                    top: "80%",
                    right: "8%",
                  }
                : { display: "none" }
            }
            color="primary"
            variant={newMsg ? "contained" : "outlined"}
            endIcon={<ExpandMoreIcon />}
            onClick={() => {
              setRange({
                start: messages.length - range.range,
                end: messages.length,
                range: range.range,
              });
              setNewMsg(false);
              setScrolled(false);
              // if (!container) return;
              // container.scrollTop = container.scrollHeight;
            }}
          >
            {newMsg ? "New Messages" : "Back to Bottom"}
          </Button>
        </Box>
      </div>
    </>
  );
};

export default ChatTextBox;
