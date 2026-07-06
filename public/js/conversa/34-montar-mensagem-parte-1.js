/* Corrigido: função buildMessageElement completa neste arquivo. */

function buildMessageElement(message) {
    const div = document.createElement("div");
    div.className = "message";

    if (message.clientId) {
      div.dataset.clientId = String(message.clientId);
    }

    if (message.id) {
      div.dataset.messageId = String(message.id);
    }

    if (message.type === "system") {
      div.classList.add("system");

      const shouldShowGroupAvatar =
        message.text &&
        message.text.toLowerCase().includes("imagem do grupo") &&
        state.selectedChat &&
        state.selectedChat.avatarUrl;

      if (shouldShowGroupAvatar) {
        const avatar = document.createElement("img");
        avatar.className = "system-message-avatar";
        avatar.src = state.selectedChat.avatarUrl;
        avatar.alt = "Foto do grupo";
        div.appendChild(avatar);
      }

      const text = document.createElement("span");
      text.textContent = message.text;
      div.appendChild(text);
      return div;
    }

    const isMine =
      state.currentUser && message.fromUserId === state.currentUser.id;

    if (isMine) {
      div.classList.add("mine");
    }

    if (message.deletedAt) {
      div.classList.add("deleted");
    }

    if (message.clientStatus === "error") {
      div.classList.add("message-error");
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (isActionableMessage(message)) {
      div.classList.add("selectable");

      const actionButton = document.createElement("button");
      actionButton.type = "button";
      actionButton.className = "message-action-button";
      actionButton.title = "Opções da mensagem";
      actionButton.textContent = "⌄";
      actionButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openMessageActionMenu(message, actionButton);
      });

      bubble.appendChild(actionButton);

      div.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openMessageActionMenu(message, div);
      });
    }

    if (message.replyTo) {
      const replyPreview = createReplyPreviewElement(message.replyTo);

      if (replyPreview) {
        bubble.appendChild(replyPreview);
      }
    }

    if (message.isForwarded) {
      const forwardedLabel = document.createElement("span");
      forwardedLabel.className = "forwarded-label";
      forwardedLabel.textContent = "↪ Encaminhada";
      bubble.appendChild(forwardedLabel);
    }

    if (message.type === "image" && message.mediaUrl) {
      bubble.classList.add("media-bubble");

      const img = document.createElement("img");
      img.className = "message-media-image";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = message.mediaUrl;
      img.alt = message.mediaOriginalName || "Imagem enviada";
      img.loading = "lazy";
      img.addEventListener("click", () => {
        openMediaViewer(message);
      });
      bubble.appendChild(img);
    }

    if (message.type === "video" && message.mediaUrl) {
      bubble.classList.add("media-bubble");

      const video = document.createElement("video");
      video.className = "message-media-video";
      video.preload = "metadata";
      video.src = message.mediaUrl;
      video.controls = true;
      video.preload = "metadata";
      bubble.appendChild(video);

video.addEventListener("dblclick", () => {
        openMediaViewer(message);
      });
    }

    if (message.type === "audio" && message.mediaUrl) {
      bubble.classList.add("audio-bubble");

      const audioWrap = document.createElement("div");
      audioWrap.className = "message-audio-box";

      const audioIcon = document.createElement("span");
      audioIcon.className = "message-audio-icon";
      audioIcon.textContent = "🎙";

      const audio = document.createElement("audio");
      audio.className = "message-media-audio";
      audio.src = message.mediaUrl;
      audio.controls = true;
      audio.preload = "metadata";

      audioWrap.appendChild(audioIcon);
      audioWrap.appendChild(audio);
      bubble.appendChild(audioWrap);
    }

    if (message.type === "file" && message.mediaUrl) {
      bubble.classList.add("file-bubble");

      const fileLink = document.createElement("a");
      fileLink.className = "message-file-box";
      fileLink.href = message.mediaUrl;
      fileLink.target = "_blank";
      fileLink.rel = "noopener noreferrer";
      fileLink.download = message.mediaOriginalName || "";
      fileLink.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      const fileIcon = document.createElement("span");
      fileIcon.className = "message-file-icon";
      fileIcon.textContent = getFileIconFromMime(
        message.mediaMimeType,
        message.mediaOriginalName,
      );

      const fileInfo = document.createElement("div");
      fileInfo.className = "message-file-info";

      const fileName = document.createElement("strong");
      fileName.textContent = message.mediaOriginalName || "Documento";

      const fileMeta = document.createElement("span");
      fileMeta.textContent = `${message.mediaMimeType || "arquivo"} • ${formatFileSize(Number(message.mediaSize || 0))}`;

      fileInfo.appendChild(fileName);
      fileInfo.appendChild(fileMeta);

      fileLink.appendChild(fileIcon);
      fileLink.appendChild(fileInfo);

      bubble.appendChild(fileLink);
    }

    if (message.text) {
      const text = document.createElement("p");
      text.textContent = message.text;
      bubble.appendChild(text);
    }

    if (message.type === "text" && !message.text) {
      const text = document.createElement("p");
      text.textContent = "";
      bubble.appendChild(text);
    }

    const meta = document.createElement("span");
    meta.className = "message-meta";

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = ui.formatDate(message.createdAt);

    meta.appendChild(time);

    if (message.editedAt && !message.deletedAt) {
      const edited = document.createElement("span");
      edited.className = "edited-label";
      edited.textContent = "editada";
      meta.appendChild(edited);
    }

    if (message.isStarred && !message.deletedAt) {
      const star = document.createElement("span");
      star.className = "starred-label";
      star.textContent = "⭐";
      star.title = "Mensagem favorita";
      meta.appendChild(star);
    }

    const statusText = getMessageStatusText(message);

    if (statusText) {
      const status = document.createElement("span");
      status.className = "message-status";
      status.textContent = statusText;
      status.title = getMessageStatusTitle(message);

      if (message.clientStatus === "sending") {
        status.classList.add("sending");
      }

      if (message.clientStatus === "error") {
        status.classList.add("error");

}

      if (message.clientStatus === "read") {
        status.classList.add("read");
      }

      meta.appendChild(status);
    }

    bubble.appendChild(meta);

    const reactions = createReactionsElement(message);

    if (reactions) {
      bubble.appendChild(reactions);
    }

    div.appendChild(bubble);

    return div;
  }
