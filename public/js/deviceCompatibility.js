(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;

  function getViewportHeight() {
    if (window.visualViewport && window.visualViewport.height) {
      return Math.round(window.visualViewport.height);
    }

    return window.innerHeight;
  }

  function syncAppHeight() {
    root.style.setProperty("--app-height", `${getViewportHeight()}px`);
  }

  function isNarrowScreen() {
    return window.innerWidth <= 1100;
  }

  function syncChatActiveClass() {
    const chatArea = document.getElementById("chatArea");
    const isChatVisible = Boolean(chatArea && !chatArea.classList.contains("hidden"));

    body.classList.toggle("chat-active", isChatVisible);

    if (!isChatVisible || !isNarrowScreen()) {
      body.classList.remove("mobile-chat-open");
    }
  }

  function syncDeviceClasses() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTouch =
      navigator.maxTouchPoints > 0 ||
      "ontouchstart" in window ||
      window.matchMedia("(pointer: coarse)").matches;

    body.classList.toggle("is-touch-device", isTouch);
    body.classList.toggle("is-phone", width <= 700);
    body.classList.toggle("is-tablet", width > 700 && width <= 1100);
    body.classList.toggle("is-desktop", width > 1100);
    body.classList.toggle("is-landscape", width > height);
    body.classList.toggle("is-portrait", height >= width);

    if (!isNarrowScreen()) {
      body.classList.remove("mobile-chat-open");
    }
  }

  function openMobileChat() {
    syncChatActiveClass();

    if (!isNarrowScreen()) return;

    body.classList.add("mobile-chat-open");
  }

  function closeMobileChat() {
    body.classList.remove("mobile-chat-open");
  }

  function patchUiNavigation() {
    const lg = window.LGChat;

    if (!lg || !lg.ui || lg.ui.__deviceCompatibilityPatched) return;

    const originalShowAuth = lg.ui.showAuth;
    const originalShowChat = lg.ui.showChat;
    const originalShowMobileChat = lg.ui.showMobileChat;
    const originalShowMobileSidebar = lg.ui.showMobileSidebar;
    const originalResetChatScreen = lg.ui.resetChatScreen;

    if (typeof originalShowAuth === "function") {
      lg.ui.showAuth = function patchedShowAuth(...args) {
        const result = originalShowAuth.apply(this, args);
        syncChatActiveClass();
        closeMobileChat();
        return result;
      };
    }

    if (typeof originalShowChat === "function") {
      lg.ui.showChat = function patchedShowChat(...args) {
        const result = originalShowChat.apply(this, args);
        syncChatActiveClass();
        return result;
      };
    }

    if (typeof originalShowMobileChat === "function") {
      lg.ui.showMobileChat = function patchedShowMobileChat(...args) {
        const result = originalShowMobileChat.apply(this, args);
        openMobileChat();
        return result;
      };
    }

    if (typeof originalShowMobileSidebar === "function") {
      lg.ui.showMobileSidebar = function patchedShowMobileSidebar(...args) {
        const result = originalShowMobileSidebar.apply(this, args);
        closeMobileChat();
        return result;
      };
    }

    if (typeof originalResetChatScreen === "function") {
      lg.ui.resetChatScreen = function patchedResetChatScreen(...args) {
        const result = originalResetChatScreen.apply(this, args);
        closeMobileChat();
        return result;
      };
    }

    lg.ui.__deviceCompatibilityPatched = true;
  }

  function observeChatArea() {
    const chatArea = document.getElementById("chatArea");

    if (!chatArea || chatArea.__deviceCompatibilityObserved) return;

    const observer = new MutationObserver(() => {
      syncChatActiveClass();
      syncDeviceClasses();
    });

    observer.observe(chatArea, {
      attributes: true,
      attributeFilter: ["class"],
    });

    chatArea.__deviceCompatibilityObserved = true;
  }

  function closeKeyboardOnSendButtons() {
    document.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const shouldBlur =
        target.closest("#sendMessageButton") ||
        target.closest("#sendMediaPreviewButton") ||
        target.closest("#sendAudioRecorderButton");

      if (!shouldBlur) return;

      const active = document.activeElement;

      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        active.blur();
      }
    });
  }

  function keepFocusedInputVisible() {
    document.addEventListener("focusin", (event) => {
      const target = event.target;

      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement) &&
        !(target instanceof HTMLSelectElement)
      ) {
        return;
      }

      setTimeout(() => {
        target.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      }, 250);
    });
  }

  function bindBackNavigation() {
    document.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const backButton = target.closest(
        "[data-mobile-back], #backToChatsButton, .back-to-chats, .mobile-back-button",
      );

      if (!backButton) return;

      closeMobileChat();
    });
  }

  function install() {
    syncAppHeight();
    patchUiNavigation();
    observeChatArea();
    syncChatActiveClass();
    syncDeviceClasses();
  }

  window.addEventListener("resize", install, { passive: true });

  window.addEventListener("orientationchange", () => {
    setTimeout(install, 250);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncAppHeight, {
      passive: true,
    });

    window.visualViewport.addEventListener("scroll", syncAppHeight, {
      passive: true,
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    install();
    closeKeyboardOnSendButtons();
    keepFocusedInputVisible();
    bindBackNavigation();

    setTimeout(install, 300);
    setTimeout(install, 1000);
  });

  window.LGChat = window.LGChat || {};
  window.LGChat.deviceCompatibility = {
    syncAppHeight,
    syncDeviceClasses,
    syncChatActiveClass,
    openMobileChat,
    closeMobileChat,
    patchUiNavigation,
    install,
  };
})();
