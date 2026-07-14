import { ApiError } from "../../api/apiClient";

export function getStatusErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return "Não foi possível concluir a ação de status.";
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase("pt-BR");
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatStatusDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Horário indisponível"
    : dateFormatter.format(date);
}

export function safeStatusBackground(value: string | null) {
  if (value && /^#[0-9a-f]{6}$/i.test(value)) return value;
  if (value && /^linear-gradient\([^;{}]+\)$/i.test(value)) return value;
  return "#00a884";
}
