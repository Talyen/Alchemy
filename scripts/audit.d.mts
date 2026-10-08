export interface AuditSelection {
  hasTypes: boolean;
  hasAmplification: boolean;
  hasContent: boolean;
  hasAll: boolean;
  forwardedArgs: string[];
}

export function parseAuditArgs(argv: string[]): AuditSelection;

export function resolveAuditScript(parsed: AuditSelection): string;
