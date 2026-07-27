export class ClockifyRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export type ClockifyRequestGate = {
  begin: () => number;
  isCurrent: (requestId: number) => boolean;
};

export function createClockifyRequestGate(): ClockifyRequestGate {
  let latestRequestId = 0;
  return {
    begin: () => {
      latestRequestId += 1;
      return latestRequestId;
    },
    isCurrent: (requestId) => requestId === latestRequestId,
  };
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
