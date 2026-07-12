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
  const [imageFailed, setImageFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className={`${styles.avatar} ${styles[size]}`}
      aria-label={name}
      role="img"
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
