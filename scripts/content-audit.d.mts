export function formatContentAuditErrors(errors: Array<{ area: string; id: string; message: string }>): string;
export function runContentAudit(): Promise<void>;
