import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ChatPage } from "./pages/ChatPage";
import { VocabPage } from "./pages/VocabPage";
import { LearnPage } from "./pages/LearnPage";
import { PathsPage } from "./pages/PathsPage";
import { CommunityHub } from "./pages/CommunityHub";
import { UserPage } from "./pages/UserPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ScanPage } from "./pages/ScanPage";

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
          <Route path="community" element={<CommunityHub />} />
          <Route path="users/:id" element={<UserPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
