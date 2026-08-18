export type DeviceRole = "owner" | "cashier";
export type CashierProfile = "standard" | "supervisor";
export type CashierPermissions = { profile: CashierProfile; allowedModules: string[]; maxDiscountPercent: number; allowCreditSales: boolean };
export const STANDARD_CASHIER_MODULES = ["cashier", "sales", "customers", "debts", "cashIn", "labels", "help"];
export const SUPERVISOR_CASHIER_MODULES = [...STANDARD_CASHIER_MODULES, "products", "warehouse", "purchases", "suppliers", "cashOut"];
export const DEFAULT_CASHIER_PERMISSIONS: CashierPermissions = { profile: "standard", allowedModules: STANDARD_CASHIER_MODULES, maxDiscountPercent: 5, allowCreditSales: false };

type PinCredential = { salt: string; hash: string };

export type DeviceSecurityConfig = {
  version: 1;
  owner: PinCredential;
  cashier?: PinCredential;
  timeoutMinutes: number;
  ownerName?: string;
  cashierName?: string;
  cashierPermissions?: CashierPermissions;
  updatedAt: string;
};

const SECURITY_KEY = "zhirox.device-security.v1";
const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePin(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 150_000 },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

async function createCredential(pin: string): Promise<PinCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toBase64(salt), hash: await derivePin(pin, salt) };
}

/**
 * Device PIN security has been retired from the POS UI.
 * Existing locally stored PIN credentials are removed on load so devices
 * immediately return to the always-open local owner workspace.
 * Server-side authentication/authorization is intentionally unaffected.
 */
export function loadDeviceSecurity(): DeviceSecurityConfig | null {
  try {
    localStorage.removeItem(SECURITY_KEY);
    sessionStorage.removeItem("zhirox.security-blocked-until");
    sessionStorage.setItem("zhirox.active-operator.v1", JSON.stringify({
      id: "device-owner",
      role: "owner",
      name: "خاوەن",
    }));
  } catch {
    // Storage cleanup is best effort. PIN remains disabled regardless.
  }
  return null;
}

/** @deprecated Device PIN setup is disabled. Kept temporarily for source compatibility. */
export async function createDeviceSecurity(ownerPin: string, cashierPin: string, timeoutMinutes = 5, ownerName = "خاوەن", cashierName = "کاشێر") {
  const config: DeviceSecurityConfig = {
    version: 1,
    owner: await createCredential(ownerPin),
    ...(cashierPin ? { cashier: await createCredential(cashierPin) } : {}),
    timeoutMinutes,
    ownerName: ownerName.trim() || "خاوەن",
    cashierName: cashierName.trim() || "کاشێر",
    cashierPermissions: DEFAULT_CASHIER_PERMISSIONS,
    updatedAt: new Date().toISOString(),
  };
  // Do not persist: PIN security has been disabled for this application.
  return config;
}

/** @deprecated Device PIN setup is disabled. Kept temporarily for source compatibility. */
export async function updateDeviceSecurity(
  config: DeviceSecurityConfig,
  currentOwnerPin: string,
  newOwnerPin: string,
  newCashierPin: string,
  removeCashier: boolean,
  timeoutMinutes: number,
  ownerName: string,
  cashierName: string,
  cashierPermissions: CashierPermissions,
) {
  if (!(await verifyDevicePin(config, "owner", currentOwnerPin))) throw new Error("PIN ـی ئێستای خاوەن هەڵەیە");
  const owner = newOwnerPin ? await createCredential(newOwnerPin) : config.owner;
  const cashier = removeCashier
    ? undefined
    : newCashierPin
      ? await createCredential(newCashierPin)
      : config.cashier;
  return {
    version: 1 as const,
    owner,
    ...(cashier ? { cashier } : {}),
    timeoutMinutes,
    ownerName: ownerName.trim() || config.ownerName || "خاوەن",
    cashierName: cashierName.trim() || config.cashierName || "کاشێر",
    cashierPermissions,
    updatedAt: new Date().toISOString(),
  };
}

export async function verifyDevicePin(config: DeviceSecurityConfig, role: DeviceRole, pin: string) {
  const credential = role === "owner" ? config.owner : config.cashier;
  if (!credential) return false;
  const candidate = await derivePin(pin, fromBase64(credential.salt));
  if (candidate.length !== credential.hash.length) return false;
  let difference = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ credential.hash.charCodeAt(index);
  }
  return difference === 0;
}

export function isValidPin(pin: string) {
  return /^\d{6}$/.test(pin);
}

export function setActiveOperator(config: DeviceSecurityConfig, role: DeviceRole) {
  sessionStorage.setItem("zhirox.active-operator.v1", JSON.stringify({
    id: `device-${role}`,
    role,
    name: role === "owner" ? config.ownerName || "خاوەن" : config.cashierName || "کاشێر",
  }));
}

export function clearActiveOperator() {
  sessionStorage.removeItem("zhirox.active-operator.v1");
}

export function removeDeviceSecurity() {
  try {
    localStorage.removeItem(SECURITY_KEY);
    sessionStorage.removeItem("zhirox.security-blocked-until");
    sessionStorage.setItem("zhirox.active-operator.v1", JSON.stringify({
      id: "device-owner",
      role: "owner",
      name: "خاوەن",
    }));
  } catch {
    // storage cleanup is best effort
  }
}
