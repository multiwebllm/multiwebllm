export const AUTH_META_KEY = "_meta";

export interface AuthMeta {
  updatedAt: string;
  source?: string;
}

export function stampAuthRecord(
  authData: Record<string, unknown>,
  source = "dashboard"
): Record<string, unknown> {
  const { [AUTH_META_KEY]: _ignored, ...rest } = authData;
  return {
    ...rest,
    [AUTH_META_KEY]: {
      updatedAt: new Date().toISOString(),
      source,
    } satisfies AuthMeta,
  };
}

export function getAuthMeta(
  authData: Record<string, unknown> | null | undefined
): AuthMeta | null {
  if (!authData?.[AUTH_META_KEY] || typeof authData[AUTH_META_KEY] !== "object") {
    return null;
  }
  const meta = authData[AUTH_META_KEY] as AuthMeta;
  return meta.updatedAt ? meta : null;
}

export function getAuthAgeDays(
  authData: Record<string, unknown> | null | undefined
): number | null {
  const meta = getAuthMeta(authData);
  if (!meta?.updatedAt) return null;
  const updated = new Date(meta.updatedAt).getTime();
  if (Number.isNaN(updated)) return null;
  return Math.floor((Date.now() - updated) / (24 * 60 * 60 * 1000));
}

export function isAuthStale(
  authData: Record<string, unknown> | null | undefined,
  maxAgeDays: number
): boolean {
  const age = getAuthAgeDays(authData);
  if (age === null) return false;
  return age >= maxAgeDays;
}
