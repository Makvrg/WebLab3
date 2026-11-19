export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) {
    return fallback;
  }

  const err = error as { error?: unknown };
  if (typeof err.error === 'string' && err.error.trim().length > 0) {
    return err.error;
  }

  if (typeof err.error !== 'object' || err.error === null) {
    return fallback;
  }

  const response = err.error as {
    statusMessage?: string;
    message?: string;
    error?: string | { message?: string };
  };

  if (response.statusMessage && typeof response.statusMessage === 'string') {
    return response.statusMessage;
  }

  if (typeof response.error === 'string' && response.error.trim().length > 0) {
    return response.error;
  }

  if (response.message && typeof response.message === 'string') {
    return response.message;
  }

  if (
    typeof response.error === 'object' &&
    response.error !== null &&
    typeof response.error.message === 'string'
  ) {
    return response.error.message;
  }

  return fallback;
}
