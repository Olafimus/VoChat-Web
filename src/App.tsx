import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useEffect } from "react";
import "./App.css";
import { Routes } from "react-router-dom";
import { Route } from "react-router";
import Navigation from "./screens/navigation/navigation";
import HomeScreen from "./screens/home/home-screen";
import SettingsScreen from "./screens/settings-screen/settings.screen";
import { useAppDispatch, useAppSelector } from "./app/hooks";

import AllAuthScreens from "./screens/auth-screens/all-auth.screen";

import ContacChatScreen from "./screens/main-display-hanlder/contact-chat-handler";

import DeleteFriend from "./components/contacts/delete-friend";
import LoadingContainer from "./logic/loading-components/LoadingContainer";
import AllVocabs from "./screens/vocba-screens/all-vocabs-screen";
import { AllVocabsClass, Vocab } from "./logic/classes/vocab.class";
import { setAllVocabs } from "./app/slices/vocabs-class-slice";
import { setVocabs } from "./app/slices/vocabs-slice";
import WorkbooksScreen from "./screens/vocba-screens/workbooks-screen";
import { VocObj } from "./logic/types/vocab.types";
import { produce } from "immer";

function App() {
  const { theme } = useAppSelector((state) => state.settings);
  const { allUserVocabs } = useAppSelector((state) => state.vocabs);
  const dispatch = useAppDispatch();
  const chosenTheme = createTheme({
    palette: {
      mode: theme,
    },
  });

  useEffect(() => {
    // dispatch(setVocabs([]));
    const allVocs = new AllVocabsClass([]);
    const allVocabsClone = produce(allUserVocabs, (draftState) => draftState);
    allVocabsClone.forEach((voc) => allVocs.addVocab(new Vocab(voc)));
    dispatch(setAllVocabs(allVocs));
  }, []);

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
            <Route path="vocab" element={<AllVocabs />}></Route>
            <Route path="vocab/workbooks" element={<WorkbooksScreen />} />
          </Route>
        </Routes>
      </ThemeProvider>
      <LoadingContainer />

      {/* {id !== "" && <UserDataLoader id={id} />} */}
    </>
  );
}

export default App;
