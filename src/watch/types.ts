export interface WatchOptions {
  cwd?: string;
  debounceMs?: number;
  onEvent?: (message: string) => void;
}
