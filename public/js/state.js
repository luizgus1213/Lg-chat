(() => {
  window.LGChat = window.LGChat || {};

  window.LGChat.state = {
    token: localStorage.getItem("token"),
    currentUser: null,
    socket: null,
    allChats: [],
    allUsers: [],
    selectedChat: null,
    statusGroups: [],
    selectedStatusGroup: null,
    statusViewer: null,
    statusAutoTimer: null,
    statusProgressTimer: null,
    activeCall: null,
    callPeerConnection: null,
    localCallStream: null,
    remoteCallStream: null,
    pendingCallOffer: null,
    pendingCallCandidates: [],
    callTimerInterval: null,
    callStartedAt: null,
    typingTimeout: null,
    isCreateGroupLoading: false,
    notificationPermission:
      "Notification" in window ? Notification.permission : "unsupported",
    appUnreadCount: 0,
    originalTitle: document.title || "LG Chat",
    notificationSoundEnabled: localStorage.getItem("lgchat_sound") !== "off",
    browserNotificationsEnabled:
      localStorage.getItem("lgchat_browser_notifications") !== "off",
    canInstallApp: false,
    isInstalledApp:
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches,
  };
})();
