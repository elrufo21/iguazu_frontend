export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: unknown } } }).response?.data;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
  }
  if (error instanceof Error) return error.message;
  return 'No se pudo completar la operación.';
}
