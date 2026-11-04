export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) {
    return fallback;
  }

  const err = error as { error?: unknown };
  if (typeof err.error !== 'object' || err.error === null) {
    return fallback;
  }

  const response = err.error as {
    statusMessage?: string;
    message?: string;
    error?: { message?: string };
  };

  if (response.statusMessage && typeof response.statusMessage === 'string') {
    return response.statusMessage;
  }

  if (response.message && typeof response.message === 'string') {
    return response.message;
  }

  if (response.error?.message && typeof response.error.message === 'string') {
    return response.error.message;
  }

  return fallback;
}
