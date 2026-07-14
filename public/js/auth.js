(() => {
  const state = window.LGChat.state;
  const api = window.LGChat.api;
  const ui = window.LGChat.ui;

  const PENDING_EMAIL_KEY = "lgchat_pending_verification_email";
  let verificationEventsBound = false;
  let restoreTimer = null;

  function getUserInitial(user) {
    return (user?.nome || "?").charAt(0).toUpperCase();
  }

  function safeEl(id) {
    try {
      return document.getElementById(id);
    } catch (_error) {
      return null;
    }
  }

  function getApiErrorCode(error) {
    return error?.data?.error?.code || error?.data?.code || null;
  }

  function getApiErrorEmail(error) {
    return error?.data?.error?.email || error?.data?.data?.email || null;
  }

  function setHidden(element, hidden) {
    if (!element) return;

    element.classList.toggle("hidden", Boolean(hidden));
    element.hidden = Boolean(hidden);
  }

  function getPendingVerificationEmail() {
    return localStorage.getItem(PENDING_EMAIL_KEY) || "";
  }

  function setPendingVerificationEmail(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      localStorage.removeItem(PENDING_EMAIL_KEY);
      state.pendingVerificationEmail = null;
      return "";
    }

    localStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail);
    state.pendingVerificationEmail = normalizedEmail;
    return normalizedEmail;
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

  function showLoginAndRegister() {
    setHidden(safeEl("loginForm"), false);
    setHidden(safeEl("registerForm"), false);
    setHidden(safeEl("emailVerificationForm"), true);
  }

  function showEmailVerification(email) {
    const normalizedEmail = setPendingVerificationEmail(email);
    const verificationEmail = safeEl("verificationEmail");
    const codeInput = safeEl("emailVerificationCode");

    setHidden(safeEl("loginForm"), true);
    setHidden(safeEl("registerForm"), true);
    setHidden(safeEl("emailVerificationForm"), false);

    if (verificationEmail) {
      verificationEmail.value = normalizedEmail;
    }

    if (codeInput) {
      codeInput.value = "";
      setTimeout(() => codeInput.focus(), 50);
    }

    ensureVerificationEventsBound();
  }

  function restorePendingVerification() {
    const email = getPendingVerificationEmail();

    if (!email) return;
    if (!safeEl("emailVerificationForm")) return;

    showEmailVerification(email);
  }

  function scheduleRestorePendingVerification() {
    if (restoreTimer) {
      clearInterval(restoreTimer);
      restoreTimer = null;
    }

    let attempts = 0;

    restoreTimer = setInterval(() => {
      attempts += 1;

      if (safeEl("emailVerificationForm")) {
        ensureVerificationEventsBound();
        restorePendingVerification();
        clearInterval(restoreTimer);
        restoreTimer = null;
        return;
      }

      if (attempts >= 30) {
        clearInterval(restoreTimer);
        restoreTimer = null;
      }
    }, 150);
  }

  async function loadMe() {
    const data = await api.request("/api/auth/me");

    state.currentUser = data.data.user;

    renderCurrentUser();
  }

  async function registerUser() {
    const nome = ui.el("registerNome").value.trim();
    const email = ui.el("registerEmail").value.trim().toLowerCase();
    const senha = ui.el("registerSenha").value;

    const data = await api.request("/api/auth/register", {
      method: "POST",
      timeoutMs: 30000,
      body: JSON.stringify({ nome, email, senha }),
    });

    const verificationEmail = data?.data?.email || email;

    localStorage.removeItem("token");
    state.token = null;
    state.currentUser = null;

    showEmailVerification(verificationEmail);

    ui.showToast(
      "success",
      data?.message || "Código enviado. Verifique seu email.",
    );
  }

  async function verifyEmailCode() {
    const email =
      safeEl("verificationEmail")?.value.trim().toLowerCase() ||
      getPendingVerificationEmail();

    const codigo = safeEl("emailVerificationCode")?.value.trim();

    if (!email) {
      ui.showToast("error", "Email de verificação não encontrado.");
      return;
    }

    if (!codigo || codigo.length !== 6) {
      ui.showToast("error", "Digite o código de 6 dígitos.");
      return;
    }

    const data = await api.request("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, codigo }),
    });

    state.token = null;
    state.currentUser = data.data.user;

    localStorage.removeItem("token");
    localStorage.removeItem(PENDING_EMAIL_KEY);

    ui.showToast("success", "Email verificado com sucesso.");
    await window.LGChat.main.startApp();
  }

  async function resendVerificationCode() {
    const email =
      safeEl("verificationEmail")?.value.trim().toLowerCase() ||
      getPendingVerificationEmail();

    if (!email) {
      ui.showToast("error", "Email de verificação não encontrado.");
      return;
    }

    const data = await api.request("/api/auth/resend-verification", {
      method: "POST",
      timeoutMs: 30000,
      body: JSON.stringify({ email }),
    });

    ui.showToast(
      "success",
      data?.message || "Código reenviado. Verifique seu email.",
    );
  }

  function cancelEmailVerification() {
    localStorage.removeItem(PENDING_EMAIL_KEY);
    state.pendingVerificationEmail = null;

    const codeInput = safeEl("emailVerificationCode");
    if (codeInput) codeInput.value = "";

    showLoginAndRegister();
  }

  function ensureVerificationEventsBound() {
    if (verificationEventsBound) return;

    const verificationForm = safeEl("emailVerificationForm");
    const resendButton = safeEl("resendVerificationCodeButton");
    const backButton = safeEl("backToRegisterButton");

    if (!verificationForm) return;

    verificationEventsBound = true;

    verificationForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const button = safeEl("verifyEmailButton");

      await ui.withButtonLoading(button, async () => {
        try {
          await verifyEmailCode();
        } catch (error) {
          ui.showToast("error", error.message);
        }
      }, "Verificando.");
    });

    if (resendButton) {
      resendButton.addEventListener("click", async () => {
        await ui.withButtonLoading(resendButton, async () => {
          try {
            await resendVerificationCode();
          } catch (error) {
            ui.showToast("error", error.message);
          }
        }, "Reenviando.");
      });
    }

    if (backButton) {
      backButton.addEventListener("click", () => {
        cancelEmailVerification();
      });
    }
  }

  async function loginUser() {
    const email = ui.el("loginEmail").value.trim().toLowerCase();
    const senha = ui.el("loginSenha").value;

    try {
      const data = await api.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
      });

      state.token = null;
      state.currentUser = data.data.user;

      localStorage.removeItem("token");
      localStorage.removeItem(PENDING_EMAIL_KEY);

      ui.showToast("success", "Login realizado com sucesso.");
      await window.LGChat.main.startApp();
    } catch (error) {
      if (getApiErrorCode(error) === "EMAIL_NOT_VERIFIED") {
        showEmailVerification(getApiErrorEmail(error) || email);
        ui.showToast("error", "Verifique seu email antes de entrar.");
        return;
      }

      throw error;
    }
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
    api.request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    localStorage.removeItem("token");
    localStorage.removeItem(PENDING_EMAIL_KEY);

    state.token = null;
    state.currentUser = null;
    state.pendingVerificationEmail = null;
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
    if (safeEl("emailVerificationCode")) safeEl("emailVerificationCode").value = "";

    if (ui.el("chatsList")) ui.el("chatsList").replaceChildren();
    if (ui.el("usersList")) ui.el("usersList").replaceChildren();
    if (ui.el("groupUsersList")) ui.el("groupUsersList").replaceChildren();

    ui.resetChatScreen();
    showLoginAndRegister();
    ui.showAuthArea();
  }

  scheduleRestorePendingVerification();

  window.LGChat.auth = {
    loadMe,
    renderCurrentUser,
    updateMyProfile,
    uploadMyAvatar,
    registerUser,
    loginUser,
    logout,
    showEmailVerification,
    verifyEmailCode,
    resendVerificationCode,
    cancelEmailVerification,
    ensureVerificationEventsBound,
  };
})();
