import { doc } from "firebase/firestore";
import Push from "push.js";
import React, { useEffect } from "react";
import { useDocument } from "react-firebase-hooks/firestore";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  MutateOldMsg,
  addConversation,
  addOldMsg,
  countUnreadMsgs,
  newMsgReceived,
  setUnreadMsgConv,
} from "../../app/slices/conversation-slice";
import {
  addFriend,
  changeFrLastMsg,
  updateFriendInteraction,
} from "../../app/slices/user-slice";
import { db, getOldMessages } from "../../utils/firebase";
import { notifyUser } from "../../utils/notification";
import { Conversation } from "../classes/conversation.class";
import { Friend } from "../types/user.types";
import { VocObj } from "../types/vocab.types";
import Logo from "../../assets/images/logo.svg";

type Prop = {
  conversation: string;
};

const ConversationLoader: React.FC<Prop> = ({ conversation }) => {
  const { conversations, activeContact, activeConv, oldMessages } =
    useAppSelector((state) => state.conversations);
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

  const checkIfNewOldKey = async (ref: string, count: number) => {
    if (ref === "none") return;
    const thisOldMessages = oldMessages.find((el) => el.ref === ref);
    const msgs = await getOldMessages(ref);
    if (!msgs) return;
    if (!thisOldMessages) return dispatch(addOldMsg({ ref, msgs }));
    const dbKeys = Object.keys(msgs);
    dispatch(MutateOldMsg({ ref, msgs }));
  };

  const loadOldMsgs = async (ref: string) => {
    // const oldMsgs = getOldMsgs(ref); // in firebase bauen
    // dipsatch() // adding missing ones
  };

  useEffect(() => {
    if (!value?.data()) return;
    // const oldConv = conversations.find((conv) => conv.id === conversation);
    // if (!oldConv) return;
    if (!value.data()) return;
    const conv: Conversation = {
      id: value.data()?.id ?? "",
      users: value.data()?.users,
      languages: value.data()?.languages,
      messages: value.data()?.messages,
      corrections: value.data()?.corrections,
      vocabs: value.data()?.vocabs,
      unreadMsgs: value.data()?.unreadMsgs,
      leftUsers: value.data()?.leftUsers,
    };
    if (conv.leftUsers?.some((el) => el.user === id))
      if (value.data()?.longTermRef)
        conv.longTermRef = value.data()?.longTermRef;
    if (value.data()?.longTermCount)
      conv.longTermCount = value.data()?.longTermCount;
    const count = conv.longTermCount || 0;
    if (value.data()?.longTermCount > 1) {
      const ref = value.data()?.longTermRef || "none";

      checkIfNewOldKey(ref, count);
    }
    // if (conv.messages.length === oldConv.messages.length) return;

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
    let newInteraction = false;
    let unreadMsgs = 0;
    let lastMsg = conv.messages.at(-1)?.messageHis.at(-1)?.message;
    if (friend)
      conv.messages.forEach((msg) => {
        if (msg.sender !== id && msg.time > friend.lastInteraction) {
          newInteraction = true;
          if (activeConv !== conv.id || document.hidden) unreadMsgs++;
        }
      });

    if (lastMsg) dispatch(changeFrLastMsg({ frId, lastMsg }));

    if (unreadMsgs > 0) {
      dispatch(setUnreadMsgConv({ id: conversation, count: unreadMsgs }));
      dispatch(newMsgReceived());
      dispatch(countUnreadMsgs());
      // notifyUser(friend?.name, lastMsg);
      Push.create(friend?.name || "user", {
        body: lastMsg || "New Message",
        icon: Logo,
      });
    }
    if (newInteraction) {
      const stamp = Date.now();
      dispatch(updateFriendInteraction({ ids: [frId], stamp }));
    }
  }, [value]);

  return <></>;
};

export default ConversationLoader;
