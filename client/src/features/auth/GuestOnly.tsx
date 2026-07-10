import { Navigate, Outlet } from "react-router-dom";

import { FullPageStatus } from "../../components/FullPageStatus";
import { useAuth } from "./useAuth";

export function GuestOnly() {
  const auth = useAuth();

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
        title="Servidor indisponível"
        message={
          auth.errorMessage ||
          "Não foi possível verificar sua sessão no momento."
        }
        actionLabel="Tentar novamente"
        onAction={() => {
          void auth.refreshSession();
        }}
      />
    );
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
