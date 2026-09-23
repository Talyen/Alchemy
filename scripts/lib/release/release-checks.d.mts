export function verifyPackagedRenderer(archivePath: string, musicDirectory?: string): void;

export function verifyWindowsExecutableArchitecture(executable: string): void;

export function verifyReleaseVersionTag(tag: string, version: string): string;

export function verifyDesktopPackage(): Promise<void>;
