import type { ApiError } from "@price-watch/contract";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(error: HttpError) {
  const body: ApiError = {
    error: error.code,
    message: error.message,
  };
  return json(body, error.status);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const data: unknown = await request.json().catch(() => {
    return null;
  });

  if (!isRecord(data)) {
    throw new HttpError(400, "invalid_json", "Request body must be a JSON object");
  }
  return data;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString({
  data,
  key,
  maxLength,
}: {
  data: Record<string, unknown>;
  key: string;
  maxLength: number;
}) {
  const value = data[key];

  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_field", `"${key}" must be a string`);
  }
  if (value.length > maxLength) {
    throw new HttpError(400, "invalid_field", `"${key}" is longer than ${maxLength} characters`);
  }
  return value;
}

export type Route<C> = {
  method: string;
  pattern: URLPattern;
  handler: (context: C & { request: Request; params: Record<string, string> }) => Promise<Response>;
};

export function route<C>(method: string, pathname: string, handler: Route<C>["handler"]): Route<C> {
  return {
    method,
    pattern: new URLPattern({ pathname }),
    handler,
  };
}

export function matchRoute<C>({ routes, request }: { routes: Route<C>[]; request: Request }) {
  for (const candidate of routes) {
    const match = candidate.pattern.exec(request.url);
    if (match && candidate.method === request.method) {
      return {
        route: candidate,
        params: filterParams(match.pathname.groups),
      };
    }
  }
  return null;
}

function filterParams(groups: Record<string, string | undefined>) {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(groups)) {
    if (value !== undefined) {
      params[key] = value;
    }
  }
  return params;
}
