import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { HomePage } from "./app/HomePage";
import { NotFoundPage } from "./app/NotFoundPage";

import { GuestOnly } from "./features/auth/GuestOnly";
import { RequireAuth } from "./features/auth/RequireAuth";

import { LoginPage } from "./features/auth/pages/LoginPage";
import { RegisterPage } from "./features/auth/pages/RegisterPage";
import { VerifyEmailPage } from "./features/auth/pages/VerifyEmailPage";

import { FullPageStatus } from "./components/FullPageStatus";

const AuthenticatedChatApp = lazy(() => import("./app/AuthenticatedChatApp"));

function ChatAppRoute() {
  return (
    <Suspense
      fallback={
        <FullPageStatus
          title="Carregando o LG Chat"
          message="Preparando suas conversas e recursos em tempo real."
        />
      }
    >
      <AuthenticatedChatApp />
    </Suspense>
  );
}

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
        <Route path="/app" element={<ChatAppRoute />} />
        <Route path="/app/chat/:chatId" element={<ChatAppRoute />} />
        <Route path="/app/status" element={<ChatAppRoute />} />
        <Route path="/app/starred" element={<ChatAppRoute />} />
        <Route path="/app/archived" element={<ChatAppRoute />} />
      </Route>

      <Route path="/entrar" element={<Navigate to="/login" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
