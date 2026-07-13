import { useState } from "react";

import styles from "./styles.module.css";

type ConversationAvatarProps = {
  name: string;
  src?: string | null;
  size?: "small" | "medium" | "large";
};

export function ConversationAvatar({
  name,
  src,
  size = "medium",
}: ConversationAvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const shouldShowImage = Boolean(src && src !== failedSource);

  return (
    <span
      className={`${styles.avatar} ${styles[size]}`}
      aria-label={name}
      role="img"
    >
      {src && shouldShowImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
