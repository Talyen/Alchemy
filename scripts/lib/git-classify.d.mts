export function extractSubcommand(argv: string[]): {
  subcommand: string;
  subIndex: number;
  args: string[];
};

export function isDestructive(parsedArgs: string[]): boolean;
