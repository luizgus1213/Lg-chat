import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullPageStatus } from "../../components/FullPageStatus";
import { useAuth } from "./useAuth";

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return (
      <FullPageStatus
        title="Carregando"
        message="Estamos verificando sua sessão."
      />
    );
  }

  if (auth.status === "error") {
    return (
      <FullPageStatus
        title="Não foi possível conectar"
        message={
          auth.errorMessage ||
          "Não foi possível verificar sua sessão no servidor."
        }
        actionLabel="Tentar novamente"
        onAction={() => {
          void auth.refreshSession();
        }}
      />
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}`,
        }}
      />
    );
  }

  return <Outlet />;
}
