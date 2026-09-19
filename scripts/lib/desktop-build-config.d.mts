export function validateDesktopBuildConfig(env?: NodeJS.ProcessEnv): {
  sentryDsn: string;
  sentryUploadEnabled: boolean;
  steamAppId: string | undefined;
  azureFields: Record<string, string | undefined>;
};
