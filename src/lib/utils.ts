export const tryFn = <T>(fn: () => T) => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};
