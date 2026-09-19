export function platformPath(): string;

export function getExecutablePath(relativePath?: string): string;

export function resolveElectronExecutablePath(): string;

export function resolveElectronExecutablePathWithMarker(): string;

export function isElectronInstalled(): boolean;

export function writeExecutablePathMarker(executablePath?: string): void;

export const electronRoot: string;

export const MIN_BINARY_BYTES: number;

export const projectRoot: string;
