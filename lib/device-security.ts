export type DeviceRole = "owner" | "cashier";
export type CashierProfile = "standard" | "supervisor";
export type CashierPermissions = {
  profile: CashierProfile;
  allowedModules: string[];
  maxDiscountPercent: number;
  allowCreditSales: boolean;
};

export const STANDARD_CASHIER_MODULES = ["cashier", "sales", "customers", "debts", "cashIn", "labels", "help"];
export const SUPERVISOR_CASHIER_MODULES = [...STANDARD_CASHIER_MODULES, "products", "warehouse", "purchases", "suppliers", "cashOut"];
export const DEFAULT_CASHIER_PERMISSIONS: CashierPermissions = {
  profile: "standard",
  allowedModules: STANDARD_CASHIER_MODULES,
  maxDiscountPercent: 5,
  allowCreditSales: false,
};

type RetiredCredential = { salt: string; hash: string };

/**
 * Compatibility-only shape for legacy imports. Device PIN authentication is
 * permanently retired; owner/cashier credential fields are never populated.
 */
export type DeviceSecurityConfig = {
  version: 2;
  timeoutMinutes: 0;
  ownerName: string;
  cashierName: string;
  cashierPermissions: CashierPermissions;
  retired: true;
  owner?: RetiredCredential;
  cashier?: RetiredCredential;
};

const SECURITY_KEY = "zhirox.device-security.v1";

function installOwnerSession() {
  if (typeof window === "undefined") return;
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
}

/** Device PIN security is retired. The local workspace is always owner mode. */
export function loadDeviceSecurity(): DeviceSecurityConfig | null {
  installOwnerSession();
  return null;
}

/** @deprecated PIN setup is retired; retained only so legacy source still compiles. */
export async function createDeviceSecurity(
  _ownerPin: string,
  _cashierPin: string,
  _timeoutMinutes = 0,
  ownerName = "خاوەن",
  cashierName = "کاشێر",
): Promise<DeviceSecurityConfig> {
  installOwnerSession();
  return {
    version: 2,
    timeoutMinutes: 0,
    ownerName: ownerName.trim() || "خاوەن",
    cashierName: cashierName.trim() || "کاشێر",
    cashierPermissions: DEFAULT_CASHIER_PERMISSIONS,
    retired: true,
  };
}

/** @deprecated PIN configuration is retired; changes are ignored. */
export async function updateDeviceSecurity(
  config: DeviceSecurityConfig,
  _currentOwnerPin: string,
  _newOwnerPin: string,
  _newCashierPin: string,
  _removeCashier: boolean,
  _timeoutMinutes: number,
  ownerName: string,
  cashierName: string,
  cashierPermissions: CashierPermissions,
): Promise<DeviceSecurityConfig> {
  installOwnerSession();
  return {
    ...config,
    version: 2,
    timeoutMinutes: 0,
    ownerName: ownerName.trim() || config.ownerName || "خاوەن",
    cashierName: cashierName.trim() || config.cashierName || "کاشێر",
    cashierPermissions,
    retired: true,
    owner: undefined,
    cashier: undefined,
  };
}

/** @deprecated There is no device PIN to verify. */
export async function verifyDevicePin(_config: DeviceSecurityConfig, role: DeviceRole, _pin: string) {
  return role === "owner";
}

/** @deprecated Device PIN input is no longer accepted. */
export function isValidPin(_pin: string) {
  return false;
}

export function setActiveOperator(_config: DeviceSecurityConfig, _role: DeviceRole) {
  installOwnerSession();
}

export function clearActiveOperator() {
  installOwnerSession();
}

export function removeDeviceSecurity() {
  installOwnerSession();
}
