import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import "./App.css";
import { Routes } from "react-router-dom";
import { Route } from "react-router";
import Navigation from "./screens/navigation/navigation";
import HomeScreen from "./screens/home/home-screen";
import ContactScreen from "./screens/contacts/contacs-screen";
import ChatScreen from "./screens/chatscreen/chat-screen";
import SettingsScreen from "./screens/settings-screen/settings.screen";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  createUserDocumentFromAuth,
  loadFriends,
  onAuthStateChangedListener,
} from "./utils/firebase";
import {
  setCurrentUser,
  setFriends,
  setUserData,
  setUserId,
} from "./app/slices/user-slice";
import AllAuthScreens from "./screens/auth-screens/all-auth.screen";
import ConversationLoader from "./logic/loading-components/conversation-loader";
import { AppUser } from "./logic/types/user.types";
import ContacChatScreen from "./screens/main-display-hanlder/contact-chat-handler";

function App() {
  const { theme } = useAppSelector((state) => state.settings);
  const { currentUser } = useAppSelector((state) => state.user);
  const { conversations } = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();
  // const theme = "dark";

  const chosenTheme = createTheme({
    palette: {
      mode: theme,
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((user) => {
      if (user) {
        createUserDocumentFromAuth(user);
      }
      dispatch(setCurrentUser(user));
      if (user?.uid) dispatch(setUserId(user.uid));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const getFriends = async () => {
      const data = await loadFriends(currentUser.uid);
      if (!data) return;
      const friends = data.friends;
      console.log("loaded friends: ", friends);

      // for later: checken wann "last active war und gegebenenfalls nicht updaten"

      const userData: AppUser = {
        name: data.displayName,
        email: data.email,
        lastActive: data.lastActive,
        createdAt: data.createdAt,
        conversations: data.conversations,
        teachLanguages: data.teachLanguages,
        learnLanguages: data.learnLanguages,
        allVocabs: data.allVocabs,
      };
      dispatch(setFriends(friends));
      dispatch(setUserData(userData));
    };
    getFriends();
  }, [currentUser]);

  return (
    <>
      <ThemeProvider theme={chosenTheme}>
        <Routes>
          <Route path="/" element={<Navigation />}>
            <Route index element={<HomeScreen />} />
            <Route path="contacts" element={<ContacChatScreen />} />
            <Route path="chat" element={<ContacChatScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="login" element={<AllAuthScreens />} />
          </Route>
        </Routes>
      </ThemeProvider>
      {conversations.map((conv) => (
        <ConversationLoader conversation={conv} />
      ))}
    </>
  );
}

export default App;
