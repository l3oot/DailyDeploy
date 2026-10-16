export const TypeError = {
  None: 0,
  ValidationError: 1,
  InvalidCredential: 2,
  Forbidden: 3,
  NotFound: 4,
  InternalError: 5,
  Conflict: 6,
} as const;

export type TypeErrorCode = (typeof TypeError)[keyof typeof TypeError];

export type ApiResponse<T> = {
  isSuccess: boolean;
  message?: string;
  data: T | null;
  errorMessage?: string;
  errorType: TypeErrorCode;
};

export function ok<T>(data: T, message = "Success"): ApiResponse<T> {
  return {
    isSuccess: true,
    message,
    data,
    errorType: TypeError.None,
  };
}

export function fail(
  errorMessage: string,
  errorType: TypeErrorCode,
): ApiResponse<null> {
  return {
    isSuccess: false,
    errorMessage,
    data: null,
    errorType,
  };
}

export function statusFor(errorType: TypeErrorCode): number {
  switch (errorType) {
    case TypeError.ValidationError:
      return 400;
    case TypeError.InvalidCredential:
      return 401;
    case TypeError.Forbidden:
      return 403;
    case TypeError.NotFound:
      return 404;
    case TypeError.Conflict:
      return 409;
    case TypeError.InternalError:
      return 500;
    default:
      return 400;
  }
}
