import { Navigate, Route, Routes } from "react-router-dom";

import { AuthenticatedHomePage } from "./app/AuthenticatedHomePage";
import { HomePage } from "./app/HomePage";
import { NotFoundPage } from "./app/NotFoundPage";

import { GuestOnly } from "./features/auth/GuestOnly";
import { RequireAuth } from "./features/auth/RequireAuth";

import { LoginPage } from "./features/auth/pages/LoginPage";
import { RegisterPage } from "./features/auth/pages/RegisterPage";
import { VerifyEmailPage } from "./features/auth/pages/VerifyEmailPage";

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
        <Route path="/app" element={<AuthenticatedHomePage />} />
      </Route>

      <Route path="/entrar" element={<Navigate to="/login" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
