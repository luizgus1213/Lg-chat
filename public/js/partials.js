(() => {
  window.LGChat = window.LGChat || {};

  const partials = [
    { target: "authRoot", path: "features/auth/auth.html" },
    { target: "sidebarRoot", path: "features/sidebar/sidebar.html" },
    { target: "chatMainRoot", path: "features/chat-main/chat-main.html" },
    { target: "infoPanelRoot", path: "features/info-panel/info-panel.html" },
    { target: "usersPanelRoot", path: "features/users-panel/users-panel.html" },
    { target: "groupPanelRoot", path: "features/group-panel/group-panel.html" },
    { target: "statusPanelRoot", path: "features/status-panel/status-panel.html" },
    { target: "globalInputsRoot", path: "features/global-inputs/global-inputs.html" },
    { target: "toastRoot", path: "features/toast/toast.html" },
  ];

  async function loadPartials() {
    await Promise.all(
      partials.map(async (partial) => {
        const target = document.getElementById(partial.target);

        if (!target) {
          throw new Error(`Elemento não encontrado: ${partial.target}`);
        }

        const response = await fetch(partial.path, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Erro ao carregar ${partial.path}`);
        }

        target.innerHTML = await response.text();
      }),
    );
  }

  window.LGChat.loadPartials = loadPartials;
})();
