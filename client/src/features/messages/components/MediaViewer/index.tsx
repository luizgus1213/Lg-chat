import { useState } from "react";

import { Modal } from "../../../../components/Modal";

import styles from "./styles.module.css";

type Props = {
  url: string;
  type: "image" | "video";
  label: string;
  onClose: () => void;
};

export function MediaViewer({ url, type, label, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  return (
    <Modal
      title={type === "image" ? "Visualizar imagem" : "Visualizar vídeo"}
      description={label}
      onClose={onClose}
      size="large"
      footer={
        <div className={styles.footer}>
          {type === "image" ? (
            <label>
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.25"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
              <span>{Math.round(zoom * 100)}%</span>
            </label>
          ) : null}
          <a href={url} target="_blank" rel="noopener noreferrer">
            Abrir
          </a>
          <a href={url} download>
            Baixar
          </a>
        </div>
      }
    >
      <div className={styles.viewer} aria-busy={status === "loading"}>
        {status === "loading" ? <p role="status">Carregando mídia…</p> : null}
        {status === "error" ? (
          <p role="alert">Não foi possível carregar esta mídia.</p>
        ) : null}
        {type === "image" ? (
          <div className={styles.imageStage}>
            <img
              src={url}
              alt={label}
              style={{ transform: `scale(${zoom})` }}
              onLoad={() => setStatus("ready")}
              onError={() => setStatus("error")}
            />
          </div>
        ) : (
          <video
            src={url}
            controls
            autoPlay
            preload="metadata"
            onLoadedMetadata={() => setStatus("ready")}
            onError={() => setStatus("error")}
          >
            Seu navegador não suporta este vídeo.
          </video>
        )}
      </div>
    </Modal>
  );
}
