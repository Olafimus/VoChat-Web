import { useState, useLayoutEffect } from "react";
import { Message } from "../../logic/types/message.types";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import MessageBox from "./message-box";

const ChatTextBox = () => {
  const { conversations, activeConv, newMsg } = useAppSelector(
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
  const [contacts, setContacts] = useState<string[]>([]);
  const { id } = useAppSelector((state) => state.user);

  useLayoutEffect(() => {
    const conv = conversations.find((conv) => conv.id === activeConv);
    if (!conv) return;
    const messages2 = conv.messages;
    const cIds = conv.users.filter((usr) => usr !== id);
    const contactNames: string[] = [];
    friends.forEach((fr) => {
      if (cIds.includes(fr.id) && fr.name) contactNames.push(fr.name);
    });
    const end = messages2.length;
    let start = end - range.range;
    if (start < 0) start = 0;
    setRange({ start, end, range: 50 });
    setContacts(contactNames);
    setMessages(messages2);
  }, [activeConv, conversations, newMsg]);

  useLayoutEffect(() => {
    const scrollBox = document.getElementById("chat--container");
    if (!scrollBox) return;
    scrollBox.scrollTop = scrollBox?.scrollHeight;
  }, [messages]);

  return (
    <>
      {" "}
      <h3 className="chat-title">{contacts.join(", ")}</h3>
      <div
        style={
          theme === "light"
            ? { backgroundColor: "rgb(200, 200, 200)", color: "white" }
            : { backgroundColor: "rgb(24, 24, 24)" }
        }
        className="chat-container"
        id="chat--container"
      >
        <div>
          {messages.slice(range.start, range.end).map((msg) => (
            <MessageBox
              key={msg.time}
              msg={msg}
              contactName={contacts.join(", ")}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default ChatTextBox;
