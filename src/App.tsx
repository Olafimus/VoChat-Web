import { useState } from "react";
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
import { useAppSelector } from "./app/hooks";

function App() {
  const { theme } = useAppSelector((state) => state.Settings);

  const chosenTheme = createTheme({
    palette: {
      mode: theme,
    },
  });

  return (
    <ThemeProvider theme={chosenTheme}>
      <Routes>
        <Route path="/" element={<Navigation />}>
          <Route index element={<HomeScreen />} />
          <Route path="contacts" element={<ContactScreen />} />
          <Route path="chat" element={<ChatScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

export default App;
