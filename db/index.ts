import * as schema from "./schema";

export function getDb() {
  const globalEnv = (globalThis as any).env;
  if (globalEnv && globalEnv.DB) {
    return globalEnv.DB;
  }
  return null;
}

