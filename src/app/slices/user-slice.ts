import { createSlice, nanoid, PayloadAction } from "@reduxjs/toolkit";
import { User } from "firebase/auth";
import { AppUser, CurrentUser, Friend } from "../../logic/types/user.types";
import {
  addFriendToDb,
  reAddFriendToDb,
  updateFriendsData,
} from "../../utils/firebase";
import { dbLangObj } from "../../assets/constants/db-lang-obj";

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
  deletedFriends: Friend[];
  friendsSet: boolean;
  imageURL: string | null;
  joinedAt?: Date;
  addedDataVocsRefs: { [key: string]: string };
}

const initialState: UserState = {
  currentUser: null,
  name: "",
  email: "",
  id: "",
  lastActive: 0,
  createdAt: 0,
  imageURL: null,
  conversations: [],
  teachLanguages: [],
  learnLanguages: [],
  friends: [],
  deletedFriends: [],
  friendsSet: false,
  addedDataVocsRefs: {},
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
      state.friendsSet = true;
    },
    setUserId: (state, action: PayloadAction<string>) => {
      state.id = action.payload;
    },
    setUserData: (state, action: PayloadAction<AppUser>) => {
      state.conversations = action.payload.conversations;
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.imageURL = action.payload.imageURL;
      state.lastActive = action.payload.lastActive;
      state.createdAt = action.payload.createdAt;
      state.teachLanguages = action.payload.teachLanguages;
      state.learnLanguages = action.payload.learnLanguages;
      if (action.payload.deletedFriends)
        state.deletedFriends = action.payload.deletedFriends;
    },
    changeFriendName: (
      state,
      action: PayloadAction<{
        frId: string;
        name: string;
        imageURL: string | null;
      }>
    ) => {
      const i = state.friends.findIndex((fr) => fr.id === action.payload.frId);
      state.friends[i].name = action.payload.name;
      state.friends[i].imageURL = action.payload.imageURL;
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
    reAddFriend: (state, action: PayloadAction<Friend>) => {
      if (!state.currentUser) return;
      state.friends.push(action.payload);
      state.deletedFriends = state.deletedFriends.filter(
        (el) => el.id !== action.payload.id
      );
      reAddFriendToDb(
        state.currentUser.uid,
        action.payload,
        state.deletedFriends
      );
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
        updateFriendsData(state.id, state.friends);
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
    removeFriend: (state, action: PayloadAction<Friend>) => {
      state.friends = state.friends.filter(
        (friend) => friend.id !== action.payload.id
      );
      state.deletedFriends.push(action.payload);
    },
    changeTeachLangs: (state, actions: PayloadAction<string[]>) => {
      state.teachLanguages = actions.payload;
    },
    changeLearnLangs: (state, actions: PayloadAction<string[]>) => {
      state.learnLanguages = actions.payload;
    },
    setJoinDate: (state, actions: PayloadAction<number>) => {
      state.joinedAt = new Date(actions.payload);
    },
    resetUserState: (state) => {
      return initialState;
    },
    setUserImageURL: (state, a: PayloadAction<string>) => {
      state.imageURL = a.payload;
    },
    addDataRef: (
      state,
      actions: PayloadAction<{ lang: keyof typeof dbLangObj; ref: string }>
    ) => {
      const key = actions.payload.lang;
      state.addedDataVocsRefs = {
        ...state.addedDataVocsRefs,
        [key]: actions.payload.ref,
      };
    },
  },
});

export const {
  setCurrentUser,
  setFriends,
  setUserData,
  setJoinDate,
  changeFriendName,
  changeFrLastMsg,
  addFriend,
  reAddFriend,
  updateFriendLastMsg,
  updateFriendInteraction,
  removeFriend,
  addConvRef,
  addConvToFriendUser,
  setUserId,
  resetUserState,
  changeLearnLangs,
  changeTeachLangs,
  addDataRef,
  setUserImageURL,
} = UserSlice.actions;

export default UserSlice.reducer;
