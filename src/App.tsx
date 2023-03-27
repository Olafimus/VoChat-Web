import { useState, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import "./App.css";
import { Routes } from "react-router-dom";
import { Route } from "react-router";
import Navigation from "./screens/navigation/navigation";
import HomeScreen from "./screens/home/home-screen";
import SettingsScreen from "./screens/settings-screen/settings.screen";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import {
  createUserDocumentFromAuth,
  db,
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
import { AppUser, CurrentUser, Friend } from "./logic/types/user.types";
import ContacChatScreen from "./screens/main-display-hanlder/contact-chat-handler";
import FriendLoader from "./logic/loading-components/friend-loader";
import DeleteFriend from "./components/contacts/delete-friend";

function App() {
  const { theme } = useAppSelector((state) => state.settings);
  const { currentUser, conversations, friends, friendsSet } = useAppSelector(
    (state) => state.user
  );
  const { unreadMsgs } = useAppSelector((state) => state.conversations);
  const [loading, setLoading] = useState(true);
  const [friendLoads, setFriendLoads] = useState<Friend[]>([]);
  const [conversationLoads, setConversationLoads] = useState<string[]>([]);
  const dispatch = useAppDispatch();
  console.log(loading);

  const chosenTheme = createTheme({
    palette: {
      mode: theme,
    },
  });

  useEffect(() => {
    if (unreadMsgs > 0) document.title = `(${unreadMsgs}) VoChat`;
    else document.title = "VoChat";
  }, [unreadMsgs]);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((user) => {
      if (user) {
        createUserDocumentFromAuth(user);
      }

      if (!user) return;
      const currentUser: CurrentUser = {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        providerData: {
          providerId: user.providerData[0].providerId,
          uid: user.providerData[0].uid,
          displayName: user.providerData[0].displayName,
          email: user.providerData[0].email,
          phoneNumber: user.providerData[0].phoneNumber,
          photoURL: user.providerData[0].photoURL,
        },
        stsTokenManager: {
          refreshToken: user.refreshToken,
          accessToken: "afd",
          expirationTime: 13242,
        },
      };

      dispatch(setCurrentUser(currentUser));
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

      // for later: checken wann "last active war und gegebenenfalls nicht updaten"
      const lastActive = Date.now();
      const userData: AppUser = {
        name: data.displayName,
        email: data.email,
        lastActive,
        createdAt: data.createdAt.seconds,
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

  useEffect(() => {
    setLoading(true);
    console.log(loading);
    if (friends.length > -1 && conversations.length > 0) setLoading(false);
    if (conversations.length !== conversationLoads.length)
      setConversationLoads([...conversations]);
    if (friends.length !== friendLoads.length) {
      setFriendLoads([...friends]);
      console.log("length changed");
    }
  }, [friends, conversations]);

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
            <Route path="delete" element={<DeleteFriend />} />
          </Route>
        </Routes>
      </ThemeProvider>
      {!loading &&
        friendsSet &&
        friendLoads.map((friend) => (
          <FriendLoader key={friend.id} friend={friend} />
        ))}
      {!loading &&
        friendsSet &&
        conversationLoads.map((conv) => (
          <ConversationLoader key={conv} conversation={conv} />
        ))}
      {/* {id !== "" && <UserDataLoader id={id} />} */}
    </>
  );
}

export default App;
