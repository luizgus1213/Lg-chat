export const SESSION_INVALID_EVENT = "lgchat:session-invalid";
export const RECOVERABLE_ERROR_EVENT = "lgchat:recoverable-error";

export type RecoverableErrorDetail = {
  message: string;
  code: string;
};

export function dispatchSessionInvalid(): void {
  window.dispatchEvent(new Event(SESSION_INVALID_EVENT));
}

export function dispatchRecoverableError(detail: RecoverableErrorDetail): void {
  window.dispatchEvent(
    new CustomEvent<RecoverableErrorDetail>(RECOVERABLE_ERROR_EVENT, {
      detail,
    }),
  );
}
