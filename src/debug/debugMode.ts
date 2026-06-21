export const DEBUG_MODE_WARNING = 'DEBUG MODE - INSECURE - DANGER';

export function isUnsafeDebugMode(
  devFlag: unknown = typeof __DEV__ === 'boolean' ? __DEV__ : undefined,
): boolean {
  return devFlag === true;
}
