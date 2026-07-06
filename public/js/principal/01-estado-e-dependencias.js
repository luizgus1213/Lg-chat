const state = window.LGChat.state;

const ui = window.LGChat.ui;

const auth = window.LGChat.auth;

const chat = window.LGChat.chat;

const socket = window.LGChat.socket;

async function startApp() {
    if (window.LGChat.performance && typeof window.LGChat.performance.init === "function") {
      window.LGChat.performance.init();
    }
    try {
      ui.showChatArea();

      await auth.loadMe();

      socket.connectSocket();

      await chat.loadChats({ silent: false });

      const performanceApi = window.LGChat.performance;

      if (performanceApi && typeof performanceApi.runWhenIdle === "function") {
        performanceApi.runWhenIdle(() => {
          chat.loadUsers().catch((error) => {
            console.error("Erro ao carregar usuários em segundo plano:", error);
          });
        }, 1200);
      } else {
        chat.loadUsers().catch((error) => {
          console.error("Erro ao carregar usuários em segundo plano:", error);
        });
      }
    } catch (error) {
      ui.showToast("error", error.message);
      auth.logout();
    }
  }
