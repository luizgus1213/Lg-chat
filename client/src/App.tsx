import { Navigate, Route, Routes } from "react-router-dom";

import { HomePage } from "./app/HomePage";
import { NotFoundPage } from "./app/NotFoundPage";

import { GuestOnly } from "./features/auth/GuestOnly";
import { RequireAuth } from "./features/auth/RequireAuth";

import { LoginPage } from "./features/auth/pages/LoginPage";
import { RegisterPage } from "./features/auth/pages/RegisterPage";
import { VerifyEmailPage } from "./features/auth/pages/VerifyEmailPage";

import { ChatHomePage } from "./features/conversations/pages/ChatHomePage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verificar-email" element={<VerifyEmailPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<ChatHomePage />} />
        <Route path="/app/chat/:chatId" element={<ChatHomePage />} />
        <Route path="/app/status" element={<ChatHomePage />} />
        <Route path="/app/starred" element={<ChatHomePage />} />
        <Route path="/app/archived" element={<ChatHomePage />} />
      </Route>

      <Route path="/entrar" element={<Navigate to="/login" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
