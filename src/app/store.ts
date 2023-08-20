import {
  configureStore,
  ThunkAction,
  Action,
  combineReducers,
} from "@reduxjs/toolkit";
import storage from "redux-persist/lib/storage";
import localforage from "localforage";
import { persistReducer } from "redux-persist";
import persistStore from "redux-persist/es/persistStore";
import thunk from "redux-thunk";
import SettingsReducer from "./slices/settings-slice";
import UserReducer from "./slices/user-slice";
import vocabsReducer from "./slices/vocabs-slice";
import conversationReducer from "./slices/conversation-slice";
import AllVocabsReducer from "./slices/vocabs-class-slice";
import NoteReducer from "./slices/notes-slice";

const rootPersistConfig = {
  key: "root",
  storage: localforage,
  blacklist: ["user", "allVocabs"],
};

const userPersistConfig = {
  key: "user",
  storage: storage,
  blacklist: ["currentUser"],
};

// const userConfig = {
//   key: "user",
//   storage,
//   blacklist: ["currentUser"],
// };

const appReducer = combineReducers({
  settings: SettingsReducer,
  user: persistReducer(userPersistConfig, UserReducer),
  vocabs: vocabsReducer,
  allVocabs: AllVocabsReducer,
  conversations: conversationReducer,
  notes: NoteReducer,
});

const persistedReducer = persistReducer(rootPersistConfig, appReducer);

export const store = configureStore({
  reducer: persistedReducer,
  devTools: process.env.NODE_ENV !== "production",
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(thunk),
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

export const persistor = persistStore(store);
