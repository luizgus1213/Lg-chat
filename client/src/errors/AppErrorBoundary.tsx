import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportClientError } from "./clientDiagnostics";

import styles from "./errors.module.css";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError({
      type: "react_render_error",
      message: error.message,
      stack: error.stack,
      metadata: { componentStack: info.componentStack ?? "" },
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className={styles.fallback}>
        <div>
          <span aria-hidden="true">LG</span>
          <h1>O LG Chat encontrou um problema</h1>
          <p>
            Seus dados continuam protegidos. Recarregue a página para retomar a
            conversa.
          </p>
          <div>
            <button type="button" onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <a href="/app">Voltar ao aplicativo</a>
          </div>
        </div>
      </main>
    );
  }
}
