export interface Logger {
  info(message: string, details?: unknown): void;
  error(message: string, details?: unknown): void;
}

export class ConsoleLogger implements Logger {
  info(message: string, details?: unknown): void {
    console.info(`[Vault Mirror] ${message}`, details ?? "");
  }

  error(message: string, details?: unknown): void {
    console.error(`[Vault Mirror] ${message}`, details ?? "");
  }
}
