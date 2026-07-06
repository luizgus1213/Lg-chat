document.addEventListener("DOMContentLoaded", async () => {
    try {
      await window.LGChat.loadPartials();

      bindEvents();

      if (window.LGChat.status && typeof window.LGChat.status.bindUi === "function") {
        window.LGChat.status.bindUi();
      }

      if (window.LGChat.call && typeof window.LGChat.call.bindUi === "function") {
        window.LGChat.call.bindUi();
      }

      if (window.LGChat.pwa && typeof window.LGChat.pwa.bindUi === "function") {
        window.LGChat.pwa.bindUi();
      }

      if (window.LGChat.pwa && typeof window.LGChat.pwa.register === "function") {
        window.LGChat.pwa.register();
      }

      if (state.token) {
        await startApp();
      } else {
        ui.showAuthArea();
      }
    } catch (error) {
      console.error("Erro ao iniciar interface:", error);
      alert("Erro ao carregar interface. Veja o console.");
    }
  });

window.LGChat.main = {
    startApp,
  };
