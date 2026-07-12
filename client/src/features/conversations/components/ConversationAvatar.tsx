import { useState } from "react";

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
    <div
      className={`conversation-avatar conversation-avatar-${size}`}
      aria-hidden="true"
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt=""
          onError={() => {
            setImageFailed(true);
          }}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
