import { doc } from "firebase/firestore";
import React, { useEffect } from "react";
import { useDocument } from "react-firebase-hooks/firestore";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { addConversation } from "../../app/slices/conversation-slice";
import { addFriend } from "../../app/slices/user-slice";
import { db } from "../../utils/firebase";
import { Conversation } from "../classes/conversation.class";
import { Friend } from "../types/user.types";

type Prop = {
  conversation: string;
};

const ConversationLoader: React.FC<Prop> = ({ conversation }) => {
  const { conversations } = useAppSelector((state) => state.conversations);
  const { friends, id } = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();

  // console.log("fr conv: ", friend.conversation);

  if (conversation === "") return;

  const [value, loading, error] = useDocument(
    doc(db, "conversations", conversation),
    {
      snapshotListenOptions: { includeMetadataChanges: true },
    }
  );

  useEffect(() => {
    console.log(conversation);
    console.log(value?.data());
    if (!value?.data()) return;
    console.log("fired2");
    const conv: Conversation = {
      id: value.data()?.id ?? "",
      users: value.data()?.users,
      languages: value.data()?.languages,
      messages: value.data()?.messages,
      corrections: value.data()?.corrections,
      vocabs: value.data()?.vocabs,
    };
    const frIdArr: string[] = [];
    friends.forEach((fr) => frIdArr.push(fr.id));

    const filtUsers = conv.users.filter((usr) => {
      if (!frIdArr.includes(usr) || usr !== id) return true;
    });

    console.log(filtUsers);

    if (filtUsers)
      filtUsers.forEach((usr) => {
        const newFriend: Friend = {
          id: usr,
          lastInteraction: Date.now(),
          conversation,
        };
        dispatch(addFriend(newFriend));
      });

    dispatch(addConversation(conv));
    console.log("fired");
  }, [value]);

  return <div style={{ display: "none" }}>ConversationLoader</div>;
};

export default ConversationLoader;
