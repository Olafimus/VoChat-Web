import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Conversation } from "../../logic/classes/conversation.class";
import { VocObj } from "../../logic/types/vocab.types";
import { Message } from "../../logic/types/message.types";
import {
  addMsgHis,
  createMsgObj,
} from "../../components/chat/editable-input-div";
import {
  helpBotKeywords,
  helpBotMsgs,
} from "../../utils/constants/help-bot-msgs";
import { Friend } from "../../logic/types/user.types";
import BotImage from "../../assets/images/Bot-Image.jpg";

export const chatBot: Friend = {
  id: "chatbot",
  name: "Chat Bot",
  lastInteraction: Date.now(),
  conversation: "chatConversation",
  lastMessage: "",
  imageURL: BotImage,
};

export interface OldMessages {
  ref: string;
  msgs: { [key: string]: Message[] };
}
const botWelcomeMsg = createMsgObj("helpBot");
addMsgHis(botWelcomeMsg, helpBotMsgs.first, "standard");
interface conversation {
  conversations: Conversation[];
  activeConv: string;
  newMsg: boolean;
  activeContact: string;
  unreadMsgs: number;
  oldMessages: OldMessages[];
  chatBotActive: boolean;
  helpBotChat: Message[];
  helpBot: Friend;
}

const initialState: conversation = {
  conversations: [],
  activeConv: "",
  activeContact: "",
  newMsg: false,
  unreadMsgs: 0,
  oldMessages: [],
  chatBotActive: false,
  helpBotChat: [botWelcomeMsg],
  helpBot: chatBot,
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
    setChatBotActive: (state, action: PayloadAction<boolean>) => {
      state.chatBotActive = action.payload;
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
    resetConversations: () => initialState,
    addOldMsg: (state, action: PayloadAction<OldMessages>) => {
      state.oldMessages.push(action.payload);
    },
    MutateOldMsg: (state, action: PayloadAction<OldMessages>) => {
      const refI = state.oldMessages.findIndex(
        (el) => el.ref === action.payload.ref
      );
      state.oldMessages[refI] = action.payload;
    },
    sendHelpMsg: (s, a: PayloadAction<Message>) => {
      s.helpBotChat.push(a.payload);
      const wordArr = a.payload.messageHis.at(-1)?.message.split(" ") || [];
      const keys = wordArr
        .filter((word) => helpBotKeywords.includes(word.toLowerCase()))
        .filter((word) => word != "first")
        .map((key) => key.toLowerCase()) as Array<keyof typeof helpBotMsgs>;

      const answer = createMsgObj(chatBot.id);
      if (keys.length > 0) addMsgHis(answer, helpBotMsgs[keys[0]], "standard");
      else addMsgHis(answer, helpBotMsgs.defaultMsg, "standard");
      s.helpBotChat.push(answer);
      s.helpBot.lastMessage = wordArr.join(" ");
      s.helpBot.lastInteraction = Date.now();
    },
  },
});

export const {
  addConversation,
  setConversations,
  setChatBotActive,
  switchActiveConv,
  switchActiveContact,
  newMsgReceived,
  resetConversations,
  setUnreadMsgConv,
  countUnreadMsgs,
  MutateOldMsg,
  addOldMsg,
  sendHelpMsg,
} = ConversationSlice.actions;

export default ConversationSlice.reducer;
