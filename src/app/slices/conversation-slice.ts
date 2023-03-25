import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Conversation } from "../../logic/classes/conversation.class";
import { VocObj } from "../../logic/types/vocab.types";

interface conversation {
  conversations: Conversation[];
  activeConv: string;
  newMsg: boolean;
  activeContact: string;
  unreadMsgs: number;
}

const initialState: conversation = {
  conversations: [],
  activeConv: "",
  activeContact: "",
  newMsg: false,
  unreadMsgs: 0,
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
      state.unreadMsgs = allUnread;
    },
    setUnreadMsgConv: (
      state,
      action: PayloadAction<{ id: string; count: number }>
    ) => {
      // const conv = state.conversations.find(
      //   (conv) => (conv.id = action.payload.id)
      // );
      // if (!conv) return;
      // conv.unreadMsgs = action.payload.count;
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
  },
});

export const {
  addConversation,
  setConversations,
  switchActiveConv,
  switchActiveContact,
  newMsgReceived,
  // setMsgsRead,
  setUnreadMsgConv,
  countUnreadMsgs,
} = ConversationSlice.actions;

export default ConversationSlice.reducer;
