export function readExposure(section: {
  path: string;
  start: number;
  end: number;
  text: string;
}): Record<string, unknown>;

export function recordAgentEvent(root: string, event: Record<string, unknown>, env?: Record<string, string>): void;
