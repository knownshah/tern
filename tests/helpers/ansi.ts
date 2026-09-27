// eslint-disable-next-line no-control-regex
export const ANSI_REGEX = /\u001b\[[0-9;]*[a-zA-Z]/g;

export function hasAnsiCodes(text: string): boolean {
  // Reset lastIndex for stateful global regex
  ANSI_REGEX.lastIndex = 0;
  return ANSI_REGEX.test(text);
}
