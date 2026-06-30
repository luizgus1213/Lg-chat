import { ZodError } from "zod";
import {
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from "sequelize";

export type ClientError = {
  code: string;
  message: string;
  statusCode: number;
  fields?: {
    path: string;
    message: string;
  }[];
};

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public publicMessage: string;

  constructor(statusCode: number, publicMessage: string, code = "APP_ERROR") {
    super(publicMessage);

    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
    this.code = code;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function toClientError(error: unknown): ClientError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.publicMessage,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_ERROR",
      message: "Dados inválidos. Verifique as informações enviadas.",
      statusCode: 400,
      fields: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }


  if (
    error &&
    typeof error === "object" &&
    (error as { name?: string; code?: string }).name === "MulterError"
  ) {
    const code = (error as { code?: string }).code;

    if (code === "LIMIT_FILE_SIZE") {
      return {
        code: "UPLOAD_FILE_TOO_LARGE",
        message: "Arquivo muito grande. Envie um arquivo menor.",
        statusCode: 413,
      };
    }

    if (code === "LIMIT_UNEXPECTED_FILE") {
      return {
        code: "UPLOAD_UNEXPECTED_FIELD",
        message: "Campo de arquivo inválido.",
        statusCode: 400,
      };
    }

    return {
      code: "UPLOAD_ERROR",
      message: "Erro ao receber arquivo enviado.",
      statusCode: 400,
    };
  }

  if (error instanceof UniqueConstraintError) {
    return {
      code: "DUPLICATED_DATA",
      message: "Já existe um registro com essas informações.",
      statusCode: 409,
    };
  }

  if (error instanceof SequelizeValidationError) {
    return {
      code: "DATABASE_VALIDATION_ERROR",
      message: "Dados inválidos para salvar no banco.",
      statusCode: 400,
      fields: error.errors.map((item) => ({
        path: item.path || "unknown",
        message: item.message,
      })),
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Erro interno no servidor. Tente novamente.",
    statusCode: 500,
  };
}
