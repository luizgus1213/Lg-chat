function handleUserStatusUpdate(payload) {
    if (!payload || !payload.userId) return;

    const updateUser = (user) => {
      if (!user || Number(user.id) !== Number(payload.userId)) return user;

      return {
        ...user,
        isOnline: Boolean(payload.isOnline),
        lastSeenAt: payload.lastSeenAt || user.lastSeenAt,
      };
    };

    state.allUsers = (state.allUsers || []).map(updateUser);

    state.allChats = (state.allChats || []).map((chat) => {
      if (!chat.privateUser || Number(chat.privateUser.id) !== Number(payload.userId)) {
        return chat;
      }

      return {
        ...chat,
        privateUser: updateUser(chat.privateUser),
      };
    });

    if (
      state.selectedChat &&
      state.selectedChat.privateUser &&
      Number(state.selectedChat.privateUser.id) === Number(payload.userId)
    ) {
      state.selectedChat = {
        ...state.selectedChat,
        privateUser: updateUser(state.selectedChat.privateUser),
      };

      updateChatHeader(state.selectedChat);
    }

    renderChats();
  }

window.LGChat.chat = {
    getChatName,
    getAvatarUrl,
    formatUserStatus,
    loadUsers,
    loadChats,
    scheduleChatsRefresh,
    applyMessageToChatList,
    markChatListAsRead,
    renderChats,
    toggleArchivedChats,
    updateArchivedToggleButton,
    updateChatPreferences,
    isMutedChat,
    isBlockedChat,
    getBlockNoticeText,
    updateBlockContact,
    clearCurrentChat,
    deleteCurrentChatForMe,
    syncBlockNotice,
    openChatOptionsMenu,
    closeChatOptionsMenu,
    toggleAttachmentMenu,
    closeAttachmentMenu,
    openChat,
    addMessage,
    updateMessage,
    markChatAsRead,
    scheduleMarkChatAsRead,
    loadOlderMessages,
    openMediaViewer,
    closeMediaViewer,
    renderUsersForPrivateChat,
    renderUsersForGroup,
    createGroup,
    sendMessage,
    startReplyMessage,
    cancelReplyMessage,
    toggleMessageReaction,
    startEditMessage,
    cancelEditMessage,
    submitEditedMessage,
    deleteMessageForEveryone,
    openMediaPreview,
    closeMediaPreview,
    sendPreviewMedia,
    sendMediaMessage,
    validateMediaFile,
    startAudioRecording,
    stopAudioRecording,
    cancelAudioRecording,
    sendRecordedAudio,
    handleTyping,
    formatMemberRole,
    deleteCurrentGroup,
    leaveCurrentGroup,
    openGroupAvatarPicker,
    uploadGroupAvatar,
    createChatAvatar,
    fillAvatarElement,
    updateChatHeader,
    handleUserStatusUpdate,
    openChatSearchPanel,
    closeChatSearchPanel,
    clearChatSearch,
    scheduleChatSearch,
    performChatSearch,
    openStarredMessagesPanel,
    closeStarredMessagesPanel,
    openForwardMessageModal,
    closeForwardMessageModal,
    submitForwardMessage,
    toggleMessageStar,
  };
