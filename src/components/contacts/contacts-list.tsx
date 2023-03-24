import { useState, useEffect } from "react";
import List from "@mui/material/List";
import ContactItem from "./contact-item";
import { useAppSelector } from "../../app/hooks";
import { Friend } from "../../logic/types/user.types";

export default function ContactsList() {
  const [contacts, setContacts] = useState<Friend[]>([]);
  const [sortedContacts, setSortedContacts] = useState<Friend[]>([]);
  const { friends } = useAppSelector((state) => state.user);
  const { conversations } = useAppSelector((state) => state.conversations);

  useEffect(() => {
    setContacts(friends);
  }, [friends]);

  useEffect(() => {
    const conts = [...contacts];
    const sortCont = conts.sort(
      (a, b) => b.lastInteraction - a.lastInteraction
    );
    setSortedContacts(sortCont);
  }, [contacts]);

  return (
    <List
      sx={{
        width: "100%",
        maxWidth: 660,
        maxHeight: "75vh",
        overflow: "auto",
        scrollbarColor: "background.paper",
        bgcolor: "background.paper",
        marginBottom: "0.5rem",
      }}
    >
      {sortedContacts.map((contact) => (
        <ContactItem key={contact.id} friend={contact} />
      ))}
    </List>
  );
}
