function openMediaPreview(file) {
    if (!validateMediaFile(file)) return;

    revokeMediaPreviewUrl();

    state.pendingMediaFile = file;
    state.pendingMediaPreviewUrl = URL.createObjectURL(file);

    const modal = ui.el("mediaPreviewModal");
    const body = ui.el("mediaPreviewBody");
    const caption = ui.el("mediaPreviewCaption");
    const meta = ui.el("mediaPreviewMeta");
    const title = ui.el("mediaPreviewTitle");

    body.replaceChildren();

    const kind = getFileKindFromMime(file.type);
    const isImage = kind === "image";
    const isAudio = kind === "audio";
    const isVideo = kind === "video";
    const isFile = kind === "file";

    if (isFile) {
      const fileBox = document.createElement("div");
      fileBox.className = "media-preview-file-box";

      const icon = document.createElement("span");
      icon.className = "media-preview-file-icon";
      icon.textContent = getFileIconFromMime(file.type, file.name);

      const info = document.createElement("div");
      info.className = "media-preview-file-info";

      const name = document.createElement("strong");
      name.textContent = file.name || "Documento";

      const details = document.createElement("span");
      details.textContent = `${file.type || "arquivo"} • ${formatFileSize(file.size)}`;

      info.appendChild(name);
      info.appendChild(details);

      fileBox.appendChild(icon);
      fileBox.appendChild(info);
      body.appendChild(fileBox);
    } else {
      const preview = isImage
        ? document.createElement("img")
        : isAudio
          ? document.createElement("audio")
          : document.createElement("video");

      preview.className = isImage
        ? "media-preview-image"
        : isAudio
          ? "media-preview-audio"
          : "media-preview-video";
      preview.src = state.pendingMediaPreviewUrl;

      if (!isImage) {
        preview.controls = true;
        preview.preload = "metadata";
      }

      body.appendChild(preview);
    }

    title.textContent = isImage
      ? "Enviar foto"
      : isVideo
        ? "Enviar vídeo"
        : isAudio
          ? "Enviar áudio"
          : "Enviar documento";
    meta.textContent = `${file.name || "arquivo"} • ${formatFileSize(file.size)}`;

    caption.placeholder = isFile
      ? "Adicione uma mensagem para esse documento..."
      : "Adicione uma legenda...";
    caption.value = ui.el("messageInput").value.trim();
    modal.classList.remove("hidden");

    setTimeout(() => {
      caption.focus();
    }, 50);
  }

function closeMediaPreview() {
    const modal = ui.el("mediaPreviewModal");
    const body = ui.el("mediaPreviewBody");
    const caption = ui.el("mediaPreviewCaption");

    state.pendingMediaFile = null;
    revokeMediaPreviewUrl();

    modal.classList.add("hidden");
    body.replaceChildren();
    caption.value = "";

    setMediaPreviewSending(false);
  }

function setMediaPreviewSending(isSending) {
    const sendButton = ui.el("sendMediaPreviewButton");
    const cancelButton = ui.el("cancelMediaPreviewButton");
    const closeButton = ui.el("closeMediaPreviewButton");
    const caption = ui.el("mediaPreviewCaption");

    if (!sendButton || !cancelButton || !closeButton || !caption) return;

    sendButton.disabled = isSending;
    cancelButton.disabled = isSending;
    closeButton.disabled = isSending;
    caption.disabled = isSending;

    sendButton.textContent = isSending ? "Enviando..." : "Enviar";
  }
