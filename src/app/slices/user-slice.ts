import { createSlice, nanoid, PayloadAction } from "@reduxjs/toolkit";
import { User } from "firebase/auth";
import { AppUser, CurrentUser, Friend } from "../../logic/types/user.types";
import { addFriendToDb, updateFriendsData } from "../../utils/firebase";

interface UserState {
  currentUser: CurrentUser | null;
  name: string;
  email: string;
  id: string;
  lastActive: number;
  createdAt: number;
  conversations: string[];
  teachLanguages: string[];
  learnLanguages: string[];
  friends: Friend[];
}

const initialState: UserState = {
  currentUser: null,
  name: "",
  email: "",
  id: "",
  lastActive: 0,
  createdAt: 0,
  conversations: [],
  teachLanguages: [],
  learnLanguages: [],
  friends: [],
};

export const UserSlice = createSlice({
  name: "User State",
  initialState,
  reducers: {
    setCurrentUser: (state, { payload }) => {
      state.currentUser = payload;
    },
    setFriends: (state, action: PayloadAction<Friend[]>) => {
      state.friends = action.payload;
    },
    setUserId: (state, action: PayloadAction<string>) => {
      state.id = action.payload;
    },
    setUserData: (state, action: PayloadAction<AppUser>) => {
      state.conversations = action.payload.conversations;
      state.name = action.payload.name;
      state.email = action.payload.email;

      state.lastActive = action.payload.lastActive;
      state.createdAt = action.payload.createdAt;
      state.teachLanguages = action.payload.teachLanguages;
      state.learnLanguages = action.payload.learnLanguages;
    },
    changeFriendName: (
      state,
      action: PayloadAction<{ frId: string; name: string }>
    ) => {
      const i = state.friends.findIndex((fr) => fr.id === action.payload.frId);
      state.friends[i].name = action.payload.name;
    },
    changeFrLastMsg: (
      state,
      action: PayloadAction<{ frId: string; lastMsg: string }>
    ) => {
      const i = state.friends.findIndex((fr) => fr.id === action.payload.frId);
      state.friends[i].lastMessage = action.payload.lastMsg;
    },
    addFriend: (state, action: PayloadAction<Friend>) => {
      if (!state.currentUser) return;
      if (
        action.payload.id === state.id ||
        action.payload.id === state.currentUser.uid
      )
        return;
      const frIdArr: string[] = [];
      state.friends.forEach((fr) => frIdArr.push(fr.id));
      if (frIdArr.includes(action.payload.id)) return;
      state.friends.push(action.payload);
      addFriendToDb(state.currentUser.uid, action.payload);
    },
    updateFriendLastMsg: (
      state,
      action: PayloadAction<{ frId: string; msg: string }>
    ) => {
      const friendIndex = state.friends.findIndex(
        (fr) => fr.id === action.payload.frId
      );
      if (state.friends[friendIndex].lastMessage === action.payload.msg) return;
      state.friends[friendIndex].lastMessage = action.payload.msg;
    },
    updateFriendInteraction: (
      state,
      action: PayloadAction<{ ids: string[]; stamp: number }>
    ) => {
      action.payload.ids.forEach((id) => {
        const friendIndex = state.friends.findIndex((fr) => fr.id === id);
        state.friends[friendIndex] = {
          ...state.friends[friendIndex],
          lastInteraction: action.payload.stamp,
        };
      });
    },
    addConvRef: (state, action: PayloadAction<string>) => {
      state.conversations.push(action.payload);
    },
    addConvToFriendUser: (
      state,
      action: PayloadAction<{ fid: string; convId: string }>
    ) => {
      const friend = state.friends.find((f) => f.id === action.payload.fid);
      if (friend) {
        friend.conversation = action.payload.convId;
        updateFriendsData(state.id, state.friends);
      }
    },
    removeFriend: (state, action: PayloadAction<string>) => {
      state.friends = state.friends.filter(
        (friend) => friend.id !== action.payload
      );
    },
  },
});

export const {
  setCurrentUser,
  setFriends,
  setUserData,
  changeFriendName,
  changeFrLastMsg,
  addFriend,
  updateFriendLastMsg,
  updateFriendInteraction,
  removeFriend,
  addConvRef,
  addConvToFriendUser,
  setUserId,
} = UserSlice.actions;

export default UserSlice.reducer;
