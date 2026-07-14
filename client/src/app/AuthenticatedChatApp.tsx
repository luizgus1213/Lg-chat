import { CallProvider } from "../features/calls/CallProvider";
import { ChatHomePage } from "../features/conversations/pages/ChatHomePage";

export default function AuthenticatedChatApp() {
  return (
    <CallProvider>
      <ChatHomePage />
    </CallProvider>
  );
}
