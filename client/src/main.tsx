import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";

import { AuthProvider } from "./features/auth/AuthProvider";
import { SocketProvider } from "./socket/SocketProvider";
import { AppErrorBoundary } from "./errors/AppErrorBoundary";
import { GlobalErrorPresenter } from "./errors/GlobalErrorPresenter";
import { installGlobalErrorHandlers } from "./errors/clientDiagnostics";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

import "./styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Elemento com id "root" não encontrado no index.html.');
}

installGlobalErrorHandlers();
registerServiceWorker();

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <GlobalErrorPresenter />
            <App />
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
