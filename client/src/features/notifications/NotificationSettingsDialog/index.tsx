import { Modal } from "../../../components/Modal";

import styles from "./styles.module.css";

type Props = {
  soundEnabled: boolean;
  systemEnabled: boolean;
  errorMessage: string | null;
  onSoundChange: (enabled: boolean) => Promise<void>;
  onEnableSystem: () => Promise<void>;
  onDisableSystem: () => void;
  onClose: () => void;
};

export function NotificationSettingsDialog(props: Props) {
  return (
    <Modal title="Notificações" description="Escolha como deseja receber alertas." onClose={props.onClose} size="small">
      <div className={styles.settings}>
        <label>
          <span><strong>Som de novas mensagens</strong><small>Não toca para mensagens próprias, silenciadas ou já visíveis.</small></span>
          <input type="checkbox" checked={props.soundEnabled} onChange={(event) => void props.onSoundChange(event.target.checked)} />
        </label>
        <div className={styles.system}>
          <span><strong>Notificação do sistema</strong><small>A permissão só é solicitada quando você ativa.</small></span>
          {props.systemEnabled ? (
            <button type="button" onClick={props.onDisableSystem}>Desativar</button>
          ) : (
            <button type="button" onClick={() => void props.onEnableSystem()}>Ativar</button>
          )}
        </div>
        {props.errorMessage ? <div className={styles.error} role="alert">{props.errorMessage}</div> : null}
      </div>
    </Modal>
  );
}
