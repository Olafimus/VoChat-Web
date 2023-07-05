import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Conversation } from "../../logic/classes/conversation.class";
import { VocObj } from "../../logic/types/vocab.types";
import { Message } from "../../logic/types/message.types";

export interface OldMessages {
  ref: string;
  msgs: { [key: string]: Message[] };
}

interface conversation {
  conversations: Conversation[];
  activeConv: string;
  newMsg: boolean;
  activeContact: string;
  unreadMsgs: number;
  oldMessages: OldMessages[];
}

const initialState: conversation = {
  conversations: [],
  activeConv: "",
  activeContact: "",
  newMsg: false,
  unreadMsgs: 0,
  oldMessages: [],
};

export const ConversationSlice = createSlice({
  name: "Conversation State",
  initialState,
  reducers: {
    addConversation: (state, action: PayloadAction<Conversation>) => {
      const i = state.conversations.findIndex(
        (conv) => conv.id === action.payload.id
      );
      const conv = state.conversations.find(
        (conv) => conv.id === action.payload.id
      );

      if (!conv) state.conversations.push(action.payload);
      else state.conversations[i] = action.payload;
      state.conversations = [...new Set(state.conversations)];
    },
    countUnreadMsgs: (state) => {
      let allUnread = 0;
      state.conversations.forEach(
        (conv) => (allUnread = allUnread + conv.unreadMsgs)
      );
      if (!allUnread) allUnread = 0;
      state.unreadMsgs = allUnread;
    },
    setUnreadMsgConv: (
      state,
      action: PayloadAction<{ id: string; count: number }>
    ) => {
      const conv = state.conversations.find(
        (conv) => conv.id === action.payload.id
      );
      if (!conv) return;
      conv.unreadMsgs = action.payload.count;
    },
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      state.conversations = action.payload;
    },
    switchActiveConv: (state, action: PayloadAction<string>) => {
      state.activeConv = action.payload;
    },
    switchActiveContact: (state, action: PayloadAction<string>) => {
      state.activeContact = action.payload;
    },
    newMsgReceived: (state) => {
      state.newMsg = !state.newMsg;
    },
    resetConversations: (state) => {
      return initialState;
    },
    addOldMsg: (state, action: PayloadAction<OldMessages>) => {
      state.oldMessages.push(action.payload);
    },
    MutateOldMsg: (state, action: PayloadAction<OldMessages>) => {
      const refI = state.oldMessages.findIndex(
        (el) => el.ref === action.payload.ref
      );
      state.oldMessages[refI] = action.payload;
    },
  },
});

export const {
  addConversation,
  setConversations,
  switchActiveConv,
  switchActiveContact,
  newMsgReceived,
  resetConversations,
  setUnreadMsgConv,
  countUnreadMsgs,
  MutateOldMsg,
  addOldMsg,
} = ConversationSlice.actions;

export default ConversationSlice.reducer;
