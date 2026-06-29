(() => {
  const state = window.LGChat.state;
  const api = window.LGChat.api;
  const ui = window.LGChat.ui;

  function getUserInitial(user) {
    return (user?.nome || "?").charAt(0).toUpperCase();
  }

  function renderCurrentUser() {
    if (!state.currentUser) return;

    const text = ui.el("currentUserText");

    if (text) {
      text.textContent = `${state.currentUser.nome} • ${state.currentUser.about || "Disponível"}`;
    }

    const avatar = ui.el("currentUserAvatar");

    if (avatar) {
      avatar.replaceChildren();

      if (state.currentUser.avatarUrl) {
        const img = document.createElement("img");
        img.src = state.currentUser.avatarUrl;
        img.alt = `Foto de ${state.currentUser.nome}`;
        avatar.appendChild(img);
      } else {
        avatar.textContent = getUserInitial(state.currentUser);
      }
    }

    const nameInput = ui.el("profileNome");

    if (nameInput) {
      nameInput.value = state.currentUser.nome || "";
    }

    const aboutInput = ui.el("profileAbout");

    if (aboutInput) {
      aboutInput.value = state.currentUser.about || "Disponível";
    }

    const emailText = ui.el("profileEmail");

    if (emailText) {
      emailText.textContent = state.currentUser.email || "";
    }

    const preview = ui.el("profileAvatarPreview");

    if (preview) {
      preview.replaceChildren();

      if (state.currentUser.avatarUrl) {
        const img = document.createElement("img");
        img.src = state.currentUser.avatarUrl;
        img.alt = `Foto de ${state.currentUser.nome}`;
        preview.appendChild(img);
      } else {
        preview.textContent = getUserInitial(state.currentUser);
      }
    }
  }

  async function loadMe() {
    const data = await api.request("/api/auth/me");

    state.currentUser = data.data.user;

    renderCurrentUser();
  }

  async function registerUser() {
    const nome = ui.el("registerNome").value.trim();
    const email = ui.el("registerEmail").value.trim();
    const senha = ui.el("registerSenha").value;

    const data = await api.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ nome, email, senha }),
    });

    state.token = data.data.token;
    state.currentUser = data.data.user;

    localStorage.setItem("token", state.token);

    ui.showToast("success", "Conta criada com sucesso.");
    await window.LGChat.main.startApp();
  }

  async function loginUser() {
    const email = ui.el("loginEmail").value.trim();
    const senha = ui.el("loginSenha").value;

    const data = await api.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });

    state.token = data.data.token;
    state.currentUser = data.data.user;

    localStorage.setItem("token", state.token);

    ui.showToast("success", "Login realizado com sucesso.");
    await window.LGChat.main.startApp();
  }

  async function updateMyProfile() {
    const nome = ui.el("profileNome").value.trim();
    const about = ui.el("profileAbout").value.trim();

    const data = await api.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        nome,
        about: about || "Disponível",
      }),
    });

    state.currentUser = data.data;
    renderCurrentUser();

    ui.showToast("success", "Perfil atualizado.");
    await window.LGChat.chat.loadChats();
  }

  async function uploadMyAvatar(file) {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      ui.showToast("error", "Use uma imagem JPG, PNG ou WEBP.");
      return;
    }

    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      ui.showToast("error", "A imagem deve ter no máximo 2MB.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    const data = await api.request("/api/users/me/avatar", {
      method: "POST",
      body: formData,
    });

    state.currentUser = data.data;
    renderCurrentUser();

    ui.showToast("success", "Foto de perfil atualizada.");
    await window.LGChat.chat.loadChats();
  }

  function logout() {
    localStorage.removeItem("token");

    state.token = null;
    state.currentUser = null;
    state.selectedChat = null;
    state.allChats = [];
    state.allUsers = [];

    if (state.typingTimeout) {
      clearTimeout(state.typingTimeout);
      state.typingTimeout = null;
    }

    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }

    if (ui.el("loginSenha")) ui.el("loginSenha").value = "";
    if (ui.el("registerSenha")) ui.el("registerSenha").value = "";

    if (ui.el("chatsList")) ui.el("chatsList").replaceChildren();
    if (ui.el("usersList")) ui.el("usersList").replaceChildren();
    if (ui.el("groupUsersList")) ui.el("groupUsersList").replaceChildren();

    ui.resetChatScreen();
    ui.showAuthArea();
  }

  window.LGChat.auth = {
    loadMe,
    renderCurrentUser,
    updateMyProfile,
    uploadMyAvatar,
    registerUser,
    loginUser,
    logout,
  };
})();
