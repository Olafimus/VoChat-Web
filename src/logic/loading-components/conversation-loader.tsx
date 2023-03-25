import { doc } from "firebase/firestore";
import React, { useEffect } from "react";
import { useDocument } from "react-firebase-hooks/firestore";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  addConversation,
  countUnreadMsgs,
  newMsgReceived,
  setUnreadMsgConv,
} from "../../app/slices/conversation-slice";
import {
  addFriend,
  changeFrLastMsg,
  updateFriendInteraction,
} from "../../app/slices/user-slice";
import { db } from "../../utils/firebase";
import { Conversation } from "../classes/conversation.class";
import { Friend } from "../types/user.types";

type Prop = {
  conversation: string;
};

const ConversationLoader: React.FC<Prop> = ({ conversation }) => {
  const { conversations, activeContact, activeConv } = useAppSelector(
    (state) => state.conversations
  );
  const { friends, id } = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();

  if (conversation === "")
    return <div style={{ display: "none" }}>ConversationLoader</div>;

  const [value, loading, error] = useDocument(
    doc(db, "conversations", conversation),
    {
      snapshotListenOptions: { includeMetadataChanges: true },
    }
  );

  useEffect(() => {
    if (!value?.data()) return;

    const conv: Conversation = {
      id: value.data()?.id ?? "",
      users: value.data()?.users,
      languages: value.data()?.languages,
      messages: value.data()?.messages,
      corrections: value.data()?.corrections,
      vocabs: value.data()?.vocabs,
      unreadMsgs: value.data()?.unreadMsgs,
    };
    const frIdArr: string[] = [];
    friends.forEach((fr) => frIdArr.push(fr.id));

    const filtUsers = conv.users.filter((usr) => {
      if (!frIdArr.includes(usr) || usr !== id) return true;
    });

    if (filtUsers)
      filtUsers.forEach((usr) => {
        const newFriend: Friend = {
          id: usr,
          lastInteraction: Date.now(),
          conversation,
          name: "",
          lastMessage: "",
        };
        dispatch(addFriend(newFriend));
      });

    dispatch(addConversation(conv));
    const frId = conv.users.filter((fr) => fr !== id)[0];
    const friend = friends.find((fr) => fr.id === frId);
    const now = Date.now();

    let unreadMsgs: number = 0;
    let lastMsg = conv.messages.at(-1)?.messageHis.at(-1)?.message;
    if (friend)
      conv.messages.forEach((msg) => {
        if (
          msg.sender !== id &&
          friend.lastInteraction < now &&
          activeConv !== conversation &&
          !document.hidden
        )
          unreadMsgs++;
      });
    // conv.unreadMsgs = unreadMsgs;
    dispatch(setUnreadMsgConv({ id: conversation, count: unreadMsgs }));
    if (lastMsg) dispatch(changeFrLastMsg({ frId, lastMsg }));
    if (unreadMsgs > 0) {
      const stamp = Date.now();
      dispatch(newMsgReceived());
      dispatch(countUnreadMsgs());
      dispatch(updateFriendInteraction({ ids: [frId], stamp }));
    }
  }, [value]);

  return <div style={{ display: "none" }}>ConversationLoader</div>;
};

export default ConversationLoader;
