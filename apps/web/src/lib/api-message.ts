/** Extract a user-facing message from an Axios-style API error. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data?.message;
  if (Array.isArray(message)) return message.filter(Boolean).join('. ');
  if (typeof message === 'string' && message.length > 0) return message;
  return fallback;
}
