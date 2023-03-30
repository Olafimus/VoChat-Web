import { ThemeProvider, createTheme } from "@mui/material/styles";
import "./App.css";
import { Routes } from "react-router-dom";
import { Route } from "react-router";
import Navigation from "./screens/navigation/navigation";
import HomeScreen from "./screens/home/home-screen";
import SettingsScreen from "./screens/settings-screen/settings.screen";
import { useAppSelector } from "./app/hooks";

import AllAuthScreens from "./screens/auth-screens/all-auth.screen";

import ContacChatScreen from "./screens/main-display-hanlder/contact-chat-handler";

import DeleteFriend from "./components/contacts/delete-friend";
import LoadingContainer from "./logic/loading-components/LoadingContainer";

function App() {
  const { theme } = useAppSelector((state) => state.settings);
  const chosenTheme = createTheme({
    palette: {
      mode: theme,
    },
  });

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
      <LoadingContainer />

      {/* {id !== "" && <UserDataLoader id={id} />} */}
    </>
  );
}

export default App;
