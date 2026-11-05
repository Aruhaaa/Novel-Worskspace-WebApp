export const sign: (payload: Record<string, unknown>) => string;
export const verify: (token: string) => Record<string, unknown> | null;
export const ANON_KEY: string;
