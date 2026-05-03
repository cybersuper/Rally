export const RALLY_RED = '#ff4444';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function safeHexColor(value: unknown): string {
  if (typeof value !== 'string') {
    return RALLY_RED;
  }

  const color = value.trim();

  return HEX_COLOR.test(color) ? color : RALLY_RED;
}
