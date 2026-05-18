interface ProcessOptions {
  format?: string;
}

export async function processWithFormat(
  input: string,
  output: string,
  options: ProcessOptions
): Promise<void> {
  if (options.format !== undefined) {
    await processFile(input, output, { format: options.format });
  } else {
    await processFile(input, output);
  }
}

export async function selectMode(): Promise<string | undefined> {
  let selectedMode: string | undefined;
  await promptUser(["dev", "prod"], (choice) => {
    selectedMode = choice;
  });
  return selectedMode;
}

export function getUserId(user: { id?: string }): string {
  return user.id ?? "unknown";
}

async function processFile(
  _input: string,
  _output: string,
  _opts?: { format?: string }
): Promise<void> {
  return;
}

async function promptUser(
  _choices: string[],
  cb: (choice: string) => void
): Promise<void> {
  cb("dev");
}
