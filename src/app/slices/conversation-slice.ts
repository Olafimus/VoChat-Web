import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Conversation } from "../../logic/classes/conversation.class";
import { VocObj } from "../../logic/types/vocab.types";

interface conversation {
  conversations: Conversation[];
  activeConv: string;
}

const initialState: conversation = {
  conversations: [],
  activeConv: "",
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
    },
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      state.conversations = action.payload;
    },
    switchActiveConv: (state, action: PayloadAction<string>) => {
      state.activeConv = action.payload;
    },
  },
});

export const { addConversation, setConversations, switchActiveConv } =
  ConversationSlice.actions;

export default ConversationSlice.reducer;
