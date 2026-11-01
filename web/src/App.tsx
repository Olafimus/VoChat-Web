import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ChatPage } from "./pages/ChatPage";
import { VocabPage } from "./pages/VocabPage";
import { LearnPage } from "./pages/LearnPage";
import { PathsPage } from "./pages/PathsPage";
import { CommunityPage } from "./pages/CommunityPage";
import { ProfilePage } from "./pages/ProfilePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="vocab" element={<VocabPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="paths" element={<PathsPage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
