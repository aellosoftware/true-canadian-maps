export type ErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "precondition_failed"
  | "payload_too_large"
  | "rate_limited"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  precondition_failed: 412,
  payload_too_large: 413,
  rate_limited: 429,
  internal: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  static notFound(what = "resource"): ApiError {
    return new ApiError("not_found", `${what} not found`);
  }
  static forbidden(message = "forbidden"): ApiError {
    return new ApiError("forbidden", message);
  }
  static unauthorized(message = "authentication required"): ApiError {
    return new ApiError("unauthorized", message);
  }
}

export interface ErrorBody {
  error: { code: ErrorCode; message: string; correlationId: string; details?: unknown };
}
