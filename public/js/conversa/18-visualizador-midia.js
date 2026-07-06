function openMediaViewer(message) {
    if (!message.mediaUrl) return;

    const modal = ui.el("mediaViewerModal");
    const body = ui.el("mediaViewerBody");
    const caption = ui.el("mediaViewerCaption");
    const title = ui.el("mediaViewerTitle");

    if (!modal || !body || !caption || !title) {
      window.open(message.mediaUrl, "_blank", "noopener,noreferrer");
      return;
    }

    body.replaceChildren();

    const isImage = message.type === "image";
    const isAudio = message.type === "audio";
    const isFile = message.type === "file";

    if (isFile) {
      const fileCard = document.createElement("a");
      fileCard.className = "media-viewer-file-card";
      fileCard.href = message.mediaUrl;
      fileCard.target = "_blank";
      fileCard.rel = "noopener noreferrer";
      fileCard.download = message.mediaOriginalName || "";

      const icon = document.createElement("span");
      icon.className = "media-viewer-file-icon";
      icon.textContent = getFileIconFromMime(
        message.mediaMimeType,
        message.mediaOriginalName,
      );

      const info = document.createElement("div");
      info.className = "media-viewer-file-info";

      const name = document.createElement("strong");
      name.textContent = message.mediaOriginalName || "Documento";

      const meta = document.createElement("span");
      meta.textContent = `${message.mediaMimeType || "arquivo"} • ${formatFileSize(Number(message.mediaSize || 0))}`;

      const hint = document.createElement("small");
      hint.textContent = "Clique para abrir ou baixar";

      info.appendChild(name);
      info.appendChild(meta);
      info.appendChild(hint);

      fileCard.appendChild(icon);
      fileCard.appendChild(info);

      body.appendChild(fileCard);
    } else {
      const media = isImage
        ? document.createElement("img")
        : isAudio
          ? document.createElement("audio")
          : document.createElement("video");

      media.className = isImage
        ? "media-viewer-image"
        : isAudio
          ? "media-viewer-audio"
          : "media-viewer-video";
      media.src = message.mediaUrl;

      if (!isImage) {
        media.controls = true;
        media.autoplay = true;
      }

      body.appendChild(media);
    }

    title.textContent = isImage
      ? "Foto"
      : isAudio
        ? "Áudio"
        : isFile
          ? "Documento"
          : "Vídeo";
    caption.textContent = message.text || message.mediaOriginalName || "";

    modal.classList.remove("hidden");
  }

function closeMediaViewer() {
    const modal = ui.el("mediaViewerModal");
    const body = ui.el("mediaViewerBody");
    const caption = ui.el("mediaViewerCaption");

    if (!modal || !body || !caption) return;

    modal.classList.add("hidden");
    body.replaceChildren();
    caption.textContent = "";
  }

function revokeMediaPreviewUrl() {
    if (state.pendingMediaPreviewUrl) {
      URL.revokeObjectURL(state.pendingMediaPreviewUrl);
      state.pendingMediaPreviewUrl = null;
    }
  }
