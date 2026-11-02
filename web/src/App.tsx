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
import { StatsPage } from "./pages/StatsPage";
import { HomePage } from "./pages/HomePage";
import { ChatsPage } from "./pages/ChatsPage";
import { ConversationPage } from "./pages/ConversationPage";
import { AdminPage } from "./pages/AdminPage";
import { NotesPage } from "./pages/NotesPage";
import { GoalsPage } from "./pages/GoalsPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="chat" element={<ChatsPage />} />
          <Route path="chat/assistant" element={<ChatPage />} />
          <Route path="chat/:id" element={<ConversationPage />} />
          <Route path="vocab" element={<VocabPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="paths" element={<PathsPage />} />
          <Route path="community" element={<CommunityHub />} />
          <Route path="users/:id" element={<UserPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="notes/:id" element={<NotesPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
