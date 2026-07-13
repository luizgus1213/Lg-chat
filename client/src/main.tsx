import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";

import { AuthProvider } from "./features/auth/AuthProvider";
import { CallProvider } from "./features/calls";
import { SocketProvider } from "./socket/SocketProvider";

import "./styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Elemento com id "root" não encontrado no index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <App />
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
