import type { ApiError } from "@price-watch/contract";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type RequestOptions = {
  path: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

const NETWORK_ERROR = "Can't reach PriceDawn. Check your connection and try again.";

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const response = await sendRequest(options);
  return response.json();
}

export async function apiCommand(options: RequestOptions) {
  await sendRequest(options);
}

async function sendRequest({ path, method = "GET", body, headers }: RequestOptions) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    throw new ApiRequestError(0, "network", NETWORK_ERROR);
  });

  if (!response.ok) {
    const error: Partial<ApiError> = await response.json().catch(() => {
      return {};
    });
    throw new ApiRequestError(response.status, error.error ?? "internal", error.message ?? "Something went wrong");
  }
  return response;
}
