export function verifyDesktopRenderer(rendererDirectory: string, publicDirectory?: string): void;

export function verifyPackagedRenderer(archivePath: string, publicDirectory?: string, rendererDirectory?: string): void;

export function verifyWindowsExecutableArchitecture(executable: string): void;

export function verifyReleaseVersionTag(tag: string, version: string): string;

export function verifyDesktopPackage(): Promise<void>;
