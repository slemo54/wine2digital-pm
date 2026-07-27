export class ClockifyRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function clockifyRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ClockifyRequestError(data?.error || "Operazione non riuscita", response.status);
  return data as T;
}
