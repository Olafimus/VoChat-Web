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
      let index: number = -1;
      const conv = state.conversations.find((conv, i) => {
        if (conv.id === action.payload.id) {
          index = i;
          return true;
        }
      });

      if (conv && index >= 0) state.conversations[index] = action.payload;
      else state.conversations.push(action.payload);

      state.unreadMsgs = 0;
      state.conversations.forEach((conv) => state.unreadMsgs + conv.unreadMsgs);
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
} = ConversationSlice.actions;

export default ConversationSlice.reducer;
