export function waitForHttp(
  url: string,
  options?: {
    timeoutMs?: number;
    pollMs?: number;
    requestTimeoutMs?: number;
    accept?: (response: Response) => boolean;
  },
): Promise<Response>;
