export function exposeActiveSessionUser<T>(user: T, isActive: boolean | undefined): T | undefined {
  return isActive === false ? undefined : user;
}
