import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useEffect } from "react";
import "./App.css";
import { Routes } from "react-router-dom";
import { Route } from "react-router";
import Navigation from "./screens/navigation/navigation";
import HomeScreen from "./screens/home/home-screen";
import SettingsScreen from "./screens/settings-screen/settings.screen";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import ContacChatScreen from "./screens/main-display-hanlder/contact-chat-handler";

import DeleteFriend from "./components/contacts/delete-friend";
import LoadingContainer from "./logic/loading-components/LoadingContainer";
import AllVocabs from "./screens/vocba-screens/all-vocabs-screen";
import { AllVocabsClass, Vocab } from "./logic/classes/vocab.class";
import { setAllVocabs } from "./app/slices/vocabs-class-slice";
import WorkbooksScreen from "./screens/vocba-screens/workbooks-screen";
import { produce } from "immer";
import LearningScreen from "./screens/vocba-screens/learning-screen";
import LearningRoute from "./screens/vocba-screens/learning-route";
import ProfilePage from "./screens/profile/profile-page";
import SignUpStepper from "./screens/auth-screens/signup/signup-screen";
import LogInScreen from "./screens/auth-screens/login.screen";
import NotebookScreen from "./screens/notebook-screen/notebook-screen";

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
            <Route path="notebook" element={<NotebookScreen />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="contacts" element={<ContacChatScreen />} />
            <Route path="chat" element={<ContacChatScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="login" element={<LogInScreen />} />
            <Route path="signup" element={<SignUpStepper />} />
            <Route path="delete" element={<DeleteFriend />} />
            <Route path="vocab" element={<AllVocabs />}></Route>
            <Route path="vocab/workbooks" element={<WorkbooksScreen />} />
            <Route path="vocab/learning" element={<LearningScreen />} />
            <Route path="vocab/learning/:route" element={<LearningRoute />} />
          </Route>
        </Routes>
      </ThemeProvider>
      <LoadingContainer />

      {/* {id !== "" && <UserDataLoader id={id} />} */}
    </>
  );
}

export default App;
