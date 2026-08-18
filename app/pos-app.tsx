"use client";

import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeDollarSign,
  Barcode,
  Boxes,
  ChartNoAxesCombined,
  CircleHelp,
  Cloud,
  CloudUpload,
  Database,
  Fingerprint,
  Handshake,
  HandCoins,
  Landmark,
  LockKeyhole,
  PackageOpen,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  TriangleAlert,
  UsersRound,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  countStores,
  getRecord,
  ensureJournalOpeningSnapshot,
  openPosDatabase,
  type PosSettings,
  type StoreCounts,
  type AuditEntry,
  listRecords,
  recordAuditEvent,
} from "@/lib/pos-db";
import {
  createDeviceSecurity,
  isValidPin,
  loadDeviceSecurity,
  verifyDevicePin,
  updateDeviceSecurity,
  setActiveOperator,
  clearActiveOperator,
  DEFAULT_CASHIER_PERMISSIONS,
  STANDARD_CASHIER_MODULES,
  SUPERVISOR_CASHIER_MODULES,
  type CashierPermissions,
  type DeviceRole,
  type DeviceSecurityConfig,
} from "@/lib/device-security";
import { pullCloudOverLocal, syncPosData, type PosSyncResult } from "@/lib/pos-sync";
import ModuleWorkspace, { type OwnerApprovalDecision, type WorkspaceModuleKey } from "./module-workspace";

type Tone = "amber" | "violet" | "red" | "charcoal" | "slate";

type ModuleKey = WorkspaceModuleKey;

type ModuleDefinition = {
  key: ModuleKey;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  countStore?: keyof StoreCounts;
  hidden?: boolean;
  priorityGroup: number;
};

const modules: ModuleDefinition[] = [
  { key: "cashier", title: "کاشێر", description: "فرۆشتن و دەرکردنی پسوڵە", icon: ShoppingCart, tone: "amber", priorityGroup: 1 },
  { key: "products", title: "کالا", description: "بارکۆد، نرخ و یەکە", icon: Boxes, tone: "violet", countStore: "products", priorityGroup: 1 },
  { key: "debts", title: "بەڕێوەبردنی قەرز", description: "قەرز، دانەوە و کشفی حساب", icon: Handshake, tone: "red", countStore: "customers", priorityGroup: 1 },
  { key: "customers", title: "کڕیار", description: "کڕیار، قەرز و کشفی حساب", icon: UsersRound, tone: "amber", countStore: "customers", priorityGroup: 1 },
  { key: "sales", title: "فرۆشراو", description: "مێژووی هەموو فرۆشتنەکان", icon: ReceiptText, tone: "amber", countStore: "sales", priorityGroup: 2 },
  { key: "warehouse", title: "کۆگا", description: "بڕ و بەهای کاڵاکان", icon: PackageOpen, tone: "red", countStore: "products", priorityGroup: 2 },
  { key: "purchases", title: "کڕین", description: "تۆمارکردنی پسوڵەی کڕین", icon: ShoppingBag, tone: "violet", countStore: "purchases", priorityGroup: 2 },
  { key: "suppliers", title: "دابینکەر", description: "کۆمپانیا و کشفی حساب", icon: Truck, tone: "violet", countStore: "suppliers", priorityGroup: 2 },
  { key: "cashIn", title: "پارەوەرگرتن", description: "وەرگرتنی پارە و قەرز", icon: ArrowDownToLine, tone: "slate", countStore: "cashEntries", priorityGroup: 3 },
  { key: "salesReturns", title: "گەڕاوی فرۆش", description: "گەڕاندنەوەی پسوڵە و کالا", icon: RotateCcw, tone: "amber", priorityGroup: 3 },
  { key: "purchaseReturns", title: "گەڕاوی کڕین", description: "گەڕاندنەوە بۆ دابینکەر", icon: RefreshCcw, tone: "violet", priorityGroup: 3 },
  { key: "cashOut", title: "پارەدان", description: "پارەدان بە دابینکەر و کەسان", icon: ArrowUpFromLine, tone: "slate", countStore: "cashEntries", priorityGroup: 3 },
  { key: "expenses", title: "خەرجی", description: "کرێ، کارەبا و خەرجییەکان", icon: HandCoins, tone: "slate", countStore: "expenses", priorityGroup: 3 },
  { key: "reports", title: "ڕاپۆرت", description: "فرۆش، قازانج و کۆگا", icon: ChartNoAxesCombined, tone: "slate", priorityGroup: 4 },
  { key: "accounting", title: "ژمێریاری", description: "قاسە، قەرز و جووڵەی پارە", icon: BadgeDollarSign, tone: "charcoal", priorityGroup: 4 },
  { key: "accounts", title: "حسابەکان", description: "دلیل الحساب و باڵانسەکان", icon: Landmark, tone: "slate", countStore: "accounts", hidden: true, priorityGroup: 4 },
  { key: "losses", title: "خەساربوو", description: "تێکچوو، بەسەرچوو و کەمبوو", icon: ArrowLeftRight, tone: "red", countStore: "losses", priorityGroup: 4 },
  { key: "labels", title: "لەیبڵ", description: "چاپی بارکۆد و نرخ", icon: Barcode, tone: "red", priorityGroup: 4 },
  { key: "audit", title: "چاودێری خاوەن", description: "کردار، مەترسی و چالاکی کاشێر", icon: Fingerprint, tone: "charcoal", countStore: "audit", priorityGroup: 5 },
  { key: "backup", title: "پاشەکەوتی داتا", description: "پاراستن و گەڕاندنەوەی داتا", icon: CloudUpload, tone: "slate", priorityGroup: 5 },
  { key: "settings", title: "ڕێکخستنەکان", description: "فرۆشگا، دراو و چاپکەر", icon: Settings, tone: "slate", priorityGroup: 5 },
  { key: "help", title: "ناوەندی ئاگاداری", description: "ئەرک و ئاگادارییە گرنگەکان", icon: CircleHelp, tone: "slate", priorityGroup: 1 },
];

const MODULE_USAGE_KEY = "zhirox.module-usage.v1";
const OWNER_ONLY_MODULES = new Set<ModuleKey>([
  "salesReturns", "purchaseReturns", "expenses", "reports", "accounting", "accounts", "losses", "audit", "backup", "settings",
]);

const emptyCounts = {
  customers: 0,
  suppliers: 0,
  products: 0,
  stockBatches: 0,
  sales: 0,
  purchases: 0,
  saleReturns: 0,
  purchaseReturns: 0,
  expenses: 0,
  cashEntries: 0,
  losses: 0,
  cashShifts: 0,
  stockAdjustments: 0,
  journalEntries: 0,
  accounts: 0,
  users: 0,
  audit: 0,
  outbox: 0,
  settings: 0,
} satisfies StoreCounts;

const initialSyncState: PosSyncResult = {
  phase: "pending",
  pending: 0,
  revision: 0,
  lastSyncedAt: null,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ckb-IQ").format(value);
}

function subscribeToConnection(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getConnectionSnapshot() {
  return navigator.onLine;
}

export default function PosApp() {
  const online = useSyncExternalStore(subscribeToConnection, getConnectionSnapshot, () => true);
  const [dbReady, setDbReady] = useState(false);
  const [counts, setCounts] = useState<StoreCounts>(emptyCounts);
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleDefinition | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncState, setSyncState] = useState<PosSyncResult>(initialSyncState);
  const [syncBusy, setSyncBusy] = useState(false);
  const [moduleUsage, setModuleUsage] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(MODULE_USAGE_KEY) ?? "{}"); } catch { return {}; }
  });
  const [securityLoaded, setSecurityLoaded] = useState(false);
  const [security, setSecurity] = useState<DeviceSecurityConfig | null>(null);
  const [role, setRole] = useState<DeviceRole | null>(null);
  const [requiredRole, setRequiredRole] = useState<DeviceRole | "any">("any");
  const [pendingModuleKey, setPendingModuleKey] = useState<ModuleKey | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(() => typeof window === "undefined" ? 0 : Number(sessionStorage.getItem("zhirox.security-blocked-until") ?? 0));
  const [securityPanelOpen, setSecurityPanelOpen] = useState(false);
  const [securityEvents, setSecurityEvents] = useState<AuditEntry[]>([]);
  const [approvalRequest, setApprovalRequest] = useState<{ details: string; expiresAt: number; resolve: (decision: OwnerApprovalDecision) => void } | null>(null);

  const refreshCounts = useCallback(async () => {
    const [nextCounts, nextSettings] = await Promise.all([
      countStores(),
      getRecord<PosSettings>("settings", "main"),
    ]);
    setCounts(nextCounts);
    setSettings(nextSettings ?? null);
    setLastUpdated(new Date());
  }, []);

  const performSync = useCallback(async () => {
    setSyncBusy(true);
    setSyncState((current) => ({ ...current, phase: "syncing" }));
    try {
      const next = await syncPosData();
      await ensureJournalOpeningSnapshot();
      setSyncState(next);
      await refreshCounts();
      return next;
    } finally {
      setSyncBusy(false);
    }
  }, [refreshCounts]);

  useEffect(() => {
    setSecurity(loadDeviceSecurity());
    setSecurityLoaded(true);
    openPosDatabase()
      .then(() => ensureJournalOpeningSnapshot())
      .then(() => refreshCounts())
      .then(() => setDbReady(true))
      .catch(() => setDbReady(false));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

  }, [refreshCounts]);

  useEffect(() => {
    if (!security || !role) return;
    let timeout = window.setTimeout(() => undefined, 0);
    const reset = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        clearActiveOperator();
        setRole(null);
        setRequiredRole("any");
        void recordAuditEvent("security.auto_locked", "device", `role=${role}`);
      }, security.timeoutMinutes * 60_000);
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [role, security]);

  useEffect(() => {
    if (!securityPanelOpen) return;
    void listRecords<AuditEntry>("audit").then((entries) => setSecurityEvents(entries
      .filter((entry) => entry.action.startsWith("security."))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 6)));
  }, [securityPanelOpen]);

  useEffect(() => {
    if (!dbReady) return;
    const synchronize = () => { if (navigator.onLine) void performSync(); };
    synchronize();
    window.addEventListener("online", synchronize);
    const interval = window.setInterval(synchronize, 60_000);
    return () => {
      window.removeEventListener("online", synchronize);
      window.clearInterval(interval);
    };
  }, [dbReady, performSync]);

  useEffect(() => {
    if (
      !dbReady || !online || counts.outbox === 0 || syncBusy ||
      syncState.phase === "conflict" || syncState.phase === "unauthorized" || syncState.phase === "error"
    ) return;
    const timeout = window.setTimeout(() => void performSync(), 700);
    return () => window.clearTimeout(timeout);
  }, [counts.outbox, dbReady, online, performSync, syncBusy, syncState.phase]);

  const handleDataChanged = useCallback(async () => {
    await refreshCounts();
    if (navigator.onLine) window.setTimeout(() => void performSync(), 250);
  }, [performSync, refreshCounts]);

  const acceptCloudCopy = useCallback(async () => {
    const confirmed = window.confirm("داتای کلەود جێگای گۆڕانکارییە هاوکات‌نەکراوەکانی ئەم ئامێرە دەگرێتەوە. پێشتر پاشەکەوتێک دابگرە. دڵنیایت؟");
    if (!confirmed) return;
    setSyncBusy(true);
    setSyncState((current) => ({ ...current, phase: "syncing" }));
    try {
      const next = await pullCloudOverLocal();
      await ensureJournalOpeningSnapshot();
      setSyncState(next);
      await refreshCounts();
    } finally {
      setSyncBusy(false);
    }
  }, [refreshCounts]);

  const syncLabel = useMemo(() => {
    if (!online || syncState.phase === "offline") return syncState.pending ? `${formatNumber(syncState.pending)} چاوەڕوان` : "ئۆفلاین";
    if (syncState.phase === "syncing") return "هاوکاتکردن...";
    if (syncState.phase === "conflict") return "پێکدانی داتا";
    if (syncState.phase === "unauthorized") return "تەنها ناوخۆ";
    if (syncState.phase === "error") return "هەڵەی Sync";
    if (syncState.phase === "pending" || syncState.pending) return `${formatNumber(syncState.pending)} چاوەڕوان`;
    return "هاوکاتە";
  }, [online, syncState]);

  const totalRecords = useMemo(
    () => counts.sales + counts.purchases + counts.products + counts.customers,
    [counts],
  );

  const visibleModules = useMemo(() => modules.map((module, index) => ({ module, index })).sort((left, right) =>
    left.module.priorityGroup - right.module.priorityGroup ||
    (moduleUsage[right.module.key] ?? 0) - (moduleUsage[left.module.key] ?? 0) ||
    left.index - right.index,
  ).map(({ module }) => module), [moduleUsage]);

  const rememberModuleUse = useCallback((key: ModuleKey) => {
    setModuleUsage((current) => {
      const next = { ...current, [key]: (current[key] ?? 0) + 1 };
      try { localStorage.setItem(MODULE_USAGE_KEY, JSON.stringify(next)); } catch { /* device preference is best effort */ }
      return next;
    });
  }, []);

  const openModule = useCallback((key: ModuleKey) => {
    const selected = visibleModules.find((item) => item.key === key);
    if (!selected) return;

    // Until PIN security is explicitly configured, this single-device POS runs
    // as a local owner workspace. Navigation must never dead-end just because a
    // security profile has not been created yet.
    if (!security) {
      setPendingModuleKey(null);
      setRequiredRole("any");
      rememberModuleUse(key);
      setActiveModule(selected);
      return;
    }

    const cashierAccess = security.cashierPermissions ?? DEFAULT_CASHIER_PERMISSIONS;
    if (!role || (role === "cashier" && (!cashierAccess.allowedModules.includes(key) || OWNER_ONLY_MODULES.has(key)))) {
      if (role === "cashier" && dbReady) void recordAuditEvent("permission.denied", key, `profile=${cashierAccess.profile}`);
      setPendingModuleKey(key);
      setRequiredRole(role === "cashier" ? "owner" : OWNER_ONLY_MODULES.has(key) ? "owner" : "any");
      return;
    }
    setPendingModuleKey(null);
    rememberModuleUse(key);
    setActiveModule(selected);
  }, [dbReady, rememberModuleUse, role, security, visibleModules]);

  const auditSecurity = useCallback((action: string, details: string) => {
    if (dbReady) void recordAuditEvent(action, "device", details);
  }, [dbReady]);

  useEffect(() => {
    if (!role) return;
    const visibilityChanged = () => {
      if (document.hidden) {
        sessionStorage.setItem("zhirox.security-hidden-at", String(Date.now()));
        return;
      }
      const hiddenAt = Number(sessionStorage.getItem("zhirox.security-hidden-at") ?? 0);
      if (hiddenAt && Date.now() - hiddenAt > 60_000) {
        clearActiveOperator();
        setRole(null);
        setRequiredRole("any");
        setSecurityPanelOpen(false);
        auditSecurity("security.background_locked", `role=${role}`);
      }
      sessionStorage.removeItem("zhirox.security-hidden-at");
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => document.removeEventListener("visibilitychange", visibilityChanged);
  }, [auditSecurity, role]);

  const finishSetup = useCallback(async (ownerPin: string, cashierPin: string, timeoutMinutes: number, ownerName = "خاوەن", cashierName = "کاشێر") => {
    const next = await createDeviceSecurity(ownerPin, cashierPin, timeoutMinutes, ownerName, cashierName);
    setSecurity(next);
    setRole("owner");
    setActiveOperator(next, "owner");
    setSecurityPanelOpen(false);
    auditSecurity("security.configured", `timeout=${timeoutMinutes};cashier=${Boolean(cashierPin)}`);
  }, [auditSecurity]);

  const unlock = useCallback(async (pin: string) => {
    if (!security || Date.now() < blockedUntil) return false;
    const roles: DeviceRole[] = requiredRole === "owner" ? ["owner"] : ["owner", "cashier"];
    for (const candidate of roles) {
      if (await verifyDevicePin(security, candidate, pin)) {
        setRole(candidate);
        setActiveOperator(security, candidate);
        setRequiredRole("any");
        setFailedAttempts(0);
        auditSecurity("security.unlocked", `role=${candidate}`);
        if (pendingModuleKey) {
          const selected = visibleModules.find((item) => item.key === pendingModuleKey);
          const cashierAccess = security.cashierPermissions ?? DEFAULT_CASHIER_PERMISSIONS;
          const canOpen = candidate === "owner" || (cashierAccess.allowedModules.includes(pendingModuleKey) && !OWNER_ONLY_MODULES.has(pendingModuleKey));
          if (selected && canOpen) {
            rememberModuleUse(pendingModuleKey);
            setActiveModule(selected);
          }
          setPendingModuleKey(null);
        }
        return true;
      }
    }
    const attempts = failedAttempts + 1;
    setFailedAttempts(attempts);
    auditSecurity("security.pin_failed", `required=${requiredRole};attempt=${attempts}`);
    if (attempts >= 5) {
      const until = Date.now() + 60_000;
      setBlockedUntil(until);
      sessionStorage.setItem("zhirox.security-blocked-until", String(until));
      setFailedAttempts(0);
    }
    return false;
  }, [auditSecurity, blockedUntil, failedAttempts, pendingModuleKey, rememberModuleUse, requiredRole, security, visibleModules]);

  const updateSecurity = useCallback(async (currentPin: string, ownerPin: string, cashierPin: string, removeCashier: boolean, timeout: number, ownerName: string, cashierName: string, cashierPermissions: CashierPermissions) => {
    if (!security) return;
    const next = await updateDeviceSecurity(security, currentPin, ownerPin, cashierPin, removeCashier, timeout, ownerName, cashierName, cashierPermissions);
    setSecurity(next);
    setSecurityPanelOpen(false);
    auditSecurity("security.config_updated", `ownerChanged=${Boolean(ownerPin)};cashierChanged=${Boolean(cashierPin) || removeCashier};timeout=${timeout}`);
    setActiveOperator(next, "owner");
  }, [auditSecurity, security]);

  const requestOwnerApproval = useCallback((details: string) => {
    if (!security) {
      return Promise.resolve<OwnerApprovalDecision>({
        approved: true,
        ownerName: "خاوەن",
        decidedAt: new Date().toISOString(),
        reason: "owner",
      });
    }
    return new Promise<OwnerApprovalDecision>((resolve) => setApprovalRequest({ details, expiresAt: Date.now() + 60_000, resolve }));
  }, [security]);
  const finishApproval = useCallback((approved: boolean, reason: "owner" | "expired" | "pin_failed" = "owner") => {
    setApprovalRequest((current) => { current?.resolve({ approved, ownerName: approved ? security?.ownerName || "خاوەن" : undefined, decidedAt: new Date().toISOString(), reason }); return null; });
  }, [security]);

  return (
    <main className="pos-shell">
      <header className="topbar">
        <div className="brand-lockup video-brand">
          <span className="brand-mark" aria-hidden="true"><Store size={21} /></span>
          <div>
            <strong>ZHIROX</strong>
            <span>SMART POS</span>
          </div>
        </div>

        <div className="video-account-title"><strong>داشبۆردی حساب</strong><span>{settings?.marketName || "Zhirox Smart POS"}</span></div>

        <nav className="topbar-nav video-nav" aria-label="ڕێنوێنی سەرەکی">
          <button className="nav-item active" type="button">داشبۆرد</button>
          {visibleModules.some((item) => item.key === "reports") && <button className="nav-item" type="button" onClick={() => openModule("reports")}>پوختەی ئەمڕۆ</button>}
        </nav>

        <button
          className="connection-state"
          data-online={online}
          data-phase={syncState.phase}
          type="button"
          onClick={() => void performSync()}
          disabled={syncBusy || !dbReady}
          title="هاوکاتکردنی داتا"
        >
          {!online || syncState.phase === "offline" ? <WifiOff size={16} /> : syncState.phase === "conflict" || syncState.phase === "error" ? <TriangleAlert size={16} /> : syncState.phase === "synced" ? <Cloud size={16} /> : <Wifi size={16} />}
          <span>{syncLabel}</span>
        </button>
        <button
          className="security-lock-button"
          type="button"
          onClick={() => {
            if (!security) {
              setSecurityPanelOpen(true);
              return;
            }
            if (role === "owner") {
              setSecurityPanelOpen(true);
              return;
            }
            clearActiveOperator();
            setRole(null);
            setRequiredRole("any");
            auditSecurity("security.manual_locked", "manual");
          }}
          title={!security ? "دانانی PIN" : role === "owner" ? "بەڕێوەبردنی پاراستن" : "قوفڵکردن"}
        >
          <LockKeyhole size={17} /><span>{!security ? "دانانی PIN" : role === "owner" ? security.ownerName || "خاوەن" : role === "cashier" ? security.cashierName || "کاشێر" : "قوفڵ"}</span>
        </button>
      </header>

      {syncState.phase === "conflict" && (
        <section className="sync-conflict-banner" role="alert">
          <TriangleAlert size={20} />
          <div>
            <strong>گۆڕانکاری لە دوو ئامێرەوە هەیە</strong>
            <span>بۆ پاراستنی حسابەکان هیچ داتایەک بە خۆکار تێکەڵ نەکرا. سەرەتا پاشەکەوت دابگرە، پاشان وەشانی کلەود وەربگرە.</span>
          </div>
          <button type="button" onClick={() => openModule("backup")}>پاشەکەوت</button>
          <button type="button" className="sync-pull-button" onClick={() => void acceptCloudCopy()} disabled={syncBusy}>داتای کلەود وەربگرە</button>
        </section>
      )}

      <section className="dashboard-wrap video-dashboard">
        <div className="video-dashboard-meta">
          <div className="local-engine" data-ready={dbReady}>
            <Database size={18} />
            <div><strong>{dbReady ? "داتای ناوخۆ ئامادەیە" : "ئامادەکردنی داتا..."}</strong><span>{online ? `ئۆفلاین-فرست؛ کلەود ${syncLabel}` : "سیستەمەکە بەبێ ئینتەرنێت کاردەکات"}</span></div>
          </div>
          <div className="video-totals"><span>کۆی تۆمار <b>{formatNumber(totalRecords)}</b></span><span>کالا <b>{formatNumber(counts.products)}</b></span><span>کڕیار <b>{formatNumber(counts.customers)}</b></span><span>فرۆش <b>{formatNumber(counts.sales)}</b></span></div>
        </div>

        <section className="module-grid" aria-label="بەشەکانی سیستەم">
          {visibleModules.filter((module) => !module.hidden).map((module) => {
            const Icon = module.icon;
            const count = module.countStore ? counts[module.countStore] : null;
            return (
              <button
                type="button"
                className={`module-card tone-${module.tone}${role === "cashier" && (OWNER_ONLY_MODULES.has(module.key) || !(security?.cashierPermissions ?? DEFAULT_CASHIER_PERMISSIONS).allowedModules.includes(module.key)) ? " is-restricted" : ""}`}
                key={module.key}
                onClick={() => openModule(module.key)}
              >
                <span className="module-icon"><Icon size={28} strokeWidth={1.65} /></span>
                <span className="module-copy">
                  <strong>{module.title}</strong>
                  <small>{module.description}</small>
                </span>
                {count !== null && count > 0 && <span className="module-count">{formatNumber(count)}</span>}
                {role === "cashier" && (OWNER_ONLY_MODULES.has(module.key) || !(security?.cashierPermissions ?? DEFAULT_CASHIER_PERMISSIONS).allowedModules.includes(module.key)) && <span className="module-lock" title="تەنها خاوەن"><LockKeyhole size={11} /> خاوەن</span>}
              </button>
            );
          })}
        </section>

        <footer className="dashboard-footer video-footer">
          <span className="footer-status"><i data-ready={dbReady} /> {dbReady ? "بنکەدراوەی ناوخۆ چالاکە" : "بنکەدراوە ئامادە نییە"}</span>
          <span>{syncState.lastSyncedAt ? `دوایین Sync: ${new Date(syncState.lastSyncedAt).toLocaleTimeString("ckb-IQ", { hour: "2-digit", minute: "2-digit" })} — وەشان ${formatNumber(syncState.revision)}` : lastUpdated ? `دوایین نوێکردنەوە: ${lastUpdated.toLocaleTimeString("ckb-IQ", { hour: "2-digit", minute: "2-digit" })}` : "هیچ داتایەک هێشتا تۆمار نەکراوە"}</span>
        </footer>
      </section>

      {activeModule && (
        <div className="module-overlay" role="dialog" aria-modal="true" aria-label={activeModule.title}>
          <button className="overlay-scrim" type="button" aria-label="داخستن" onClick={() => setActiveModule(null)} />
          <section className="module-drawer">
            <header className={`drawer-head tone-${activeModule.tone}`}>
              <div className="drawer-title">
                <span><activeModule.icon size={26} /></span>
                <div><h2>{activeModule.title}</h2><p>{activeModule.description}</p></div>
              </div>
              <button type="button" className="close-button" onClick={() => setActiveModule(null)} aria-label="داخستن"><X size={22} /></button>
            </header>
            <div className="drawer-body">
              <ModuleWorkspace
                key={activeModule.key}
                moduleKey={activeModule.key}
                onDataChanged={handleDataChanged}
                onNavigate={openModule}
                activeRole={role ?? (!security ? "owner" : null)}
                cashierPermissions={security?.cashierPermissions ?? DEFAULT_CASHIER_PERMISSIONS}
                requestOwnerApproval={requestOwnerApproval}
              />
            </div>
          </section>
        </div>
      )}
      {securityLoaded && !security && securityPanelOpen && <PinSetup onSave={finishSetup} onClose={() => setSecurityPanelOpen(false)} />}
      {securityLoaded && security && (!role || requiredRole === "owner") && (
        <PinLock
          requiredRole={requiredRole}
          blockedUntil={blockedUntil}
          failedAttempts={failedAttempts}
          canCancel={Boolean(role)}
          onCancel={() => { setRequiredRole("any"); setPendingModuleKey(null); }}
          onUnlock={unlock}
        />
      )}
      {security && role === "owner" && securityPanelOpen && <SecurityPanel config={security} events={securityEvents} onClose={() => setSecurityPanelOpen(false)} onLock={() => { setSecurityPanelOpen(false); clearActiveOperator(); setRole(null); setRequiredRole("any"); auditSecurity("security.manual_locked", "panel"); }} onSave={updateSecurity} />}
      {security && approvalRequest && <OwnerApproval details={approvalRequest.details} expiresAt={approvalRequest.expiresAt} config={security} onPinFailed={(attempt) => auditSecurity("security.pin_failed", `context=owner_approval;attempt=${attempt}`)} onDone={finishApproval} />}
    </main>
  );
}

function PinSetup({ onSave, onClose }: { onSave: (ownerPin: string, cashierPin: string, timeout: number) => Promise<void>; onClose: () => void }) {
  const [ownerPin, setOwnerPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [cashierPin, setCashierPin] = useState("");
  const [timeout, setTimeoutMinutes] = useState(5);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidPin(ownerPin)) return setError("PIN ـی خاوەن دەبێت ٦ ژمارە بێت");
    if (ownerPin !== confirmPin) return setError("دوو PIN ـەکە یەکسان نین");
    if (cashierPin && (!isValidPin(cashierPin) || cashierPin === ownerPin)) return setError("PIN ـی کاشێر دەبێت ٦ ژمارە و جیاواز بێت");
    setBusy(true);
    try { await onSave(ownerPin, cashierPin, timeout); } finally { setBusy(false); }
  }
  return <div className="pin-gate" role="dialog" aria-modal="true"><form className="pin-card" onSubmit={submit}><button className="pin-close" type="button" onClick={onClose} aria-label="داخستن"><X size={19} /></button><span className="pin-icon"><LockKeyhole size={30} /></span><h2>پاراستنی سیستەم</h2><p>PIN ـی خاوەن تەنها بۆ بەشە هەستیارەکانە. PIN ـی کاشێر ئارەزوومەندانەیە.</p><label>PIN ـی خاوەن<input inputMode="numeric" maxLength={6} value={ownerPin} onChange={(event) => setOwnerPin(event.target.value.replace(/\D/g, ""))} type="password" autoFocus /></label><label>دووبارەکردنەوەی PIN<input inputMode="numeric" maxLength={6} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))} type="password" /></label><label>PIN ـی کاشێر — ئارەزوومەندانە<input inputMode="numeric" maxLength={6} value={cashierPin} onChange={(event) => setCashierPin(event.target.value.replace(/\D/g, ""))} type="password" /></label><label>قوفڵبوونی خۆکار<select value={timeout} onChange={(event) => setTimeoutMinutes(Number(event.target.value))}><option value={1}>دوای ١ خولەک</option><option value={5}>دوای ٥ خولەک</option><option value={15}>دوای ١٥ خولەک</option><option value={30}>دوای ٣٠ خولەک</option></select></label>{error && <div className="pin-error" role="alert">{error}</div>}<button disabled={busy} type="submit">{busy ? "پاراستن..." : "چالاککردنی پاراستن"}</button><small>PIN بە شێوەی کۆدکراو لەسەر ئەم ئامێرە پارێزراو دەبێت.</small></form></div>;
}

function OwnerApproval({ details, expiresAt, config, onPinFailed, onDone }: { details: string; expiresAt: number; config: DeviceSecurityConfig; onPinFailed: (attempt: number) => void; onDone: (approved: boolean, reason?: "owner" | "expired" | "pin_failed") => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
  useEffect(() => {
    const tick = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))), 250);
    const expiry = window.setTimeout(() => onDone(false, "expired"), Math.max(0, expiresAt - Date.now()));
    return () => { window.clearInterval(tick); window.clearTimeout(expiry); };
  }, [expiresAt, onDone]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (Date.now() >= expiresAt) return onDone(false, "expired");
    if (!isValidPin(pin)) return setError("PIN ـی خاوەن دەبێت ٦ ژمارە بێت");
    setBusy(true);
    const accepted = await verifyDevicePin(config, "owner", pin);
    setBusy(false);
    if (!accepted) {
      const nextAttempts = attempts + 1;
      onPinFailed(nextAttempts);
      if (nextAttempts >= 3) return onDone(false, "pin_failed");
      setAttempts(nextAttempts); setPin(""); setError(`PIN ـی خاوەن هەڵەیە؛ ${new Intl.NumberFormat("ckb-IQ").format(3 - nextAttempts)} هەوڵ ماوە`); return;
    }
    onDone(true);
  }
  return <div className="pin-gate approval-gate" role="dialog" aria-modal="true"><form className="pin-card pin-unlock" onSubmit={submit}><span className="pin-icon approval"><LockKeyhole size={30} /></span><h2>پەسەندی یەک‌جارەی خاوەن</h2><p>ئەم پەسەندە تەنها بۆ هەمان مامەڵەیە و دەسەڵاتی کاشێر ناگۆڕێت.</p><div className={`approval-countdown ${secondsLeft <= 10 ? "ending" : ""}`}><span>کاتی ماوە بۆ بڕیار</span><strong>{new Intl.NumberFormat("ckb-IQ").format(secondsLeft)} چرکە</strong></div><div className="approval-details">{details}</div><label>PIN ـی خاوەن<input inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} type="password" autoFocus /></label><small className="approval-attempts">هەوڵی ماوە: {new Intl.NumberFormat("ckb-IQ").format(3 - attempts)}</small>{error && <div className="pin-error" role="alert">{error}</div>}<button disabled={busy || secondsLeft <= 0} type="submit">{busy ? "پشکنین..." : "پەسەندکردنی مامەڵە"}</button><button className="pin-cancel" type="button" onClick={() => onDone(false, "owner")}>ڕەتکردنەوە</button></form></div>;
}

function PinLock({ requiredRole, blockedUntil, failedAttempts, canCancel, onCancel, onUnlock }: { requiredRole: DeviceRole | "any"; blockedUntil: number; failedAttempts: number; canCancel: boolean; onCancel: () => void; onUnlock: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const blocked = Date.now() < blockedUntil;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return setError("دوای یەک خولەک هەوڵ بدەرەوە");
    if (!isValidPin(pin)) return setError("PIN دەبێت ٦ ژمارە بێت");
    setBusy(true);
    const accepted = await onUnlock(pin);
    setBusy(false);
    if (!accepted) { setPin(""); setError("PIN هەڵەیە"); }
  }
  return <div className="pin-gate" role="dialog" aria-modal="true"><form className="pin-card pin-unlock" onSubmit={submit}><span className="pin-icon"><LockKeyhole size={30} /></span><h2>{requiredRole === "owner" ? "دەسەڵاتی خاوەن پێویستە" : "سیستەم قوفڵە"}</h2><p>{requiredRole === "owner" ? "بۆ کردنەوەی ئەم بەشە PIN ـی خاوەن بنووسە." : "PIN ـی خاوەن یان کاشێر بنووسە."}</p><label>PIN<input inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} type="password" autoFocus /></label>{error && <div className="pin-error" role="alert">{error}</div>}{failedAttempts > 0 && <small>{new Intl.NumberFormat("ckb-IQ").format(5 - failedAttempts)} هەوڵ ماوە</small>}<button disabled={busy || blocked} type="submit">{busy ? "پشکنین..." : "کردنەوە"}</button>{canCancel && <button className="pin-cancel" type="button" onClick={onCancel}>گەڕانەوە</button>}</form></div>;
}

function SecurityPanel({ config, events, onClose, onLock, onSave }: { config: DeviceSecurityConfig; events: AuditEntry[]; onClose: () => void; onLock: () => void; onSave: (currentPin: string, ownerPin: string, cashierPin: string, removeCashier: boolean, timeout: number, ownerName: string, cashierName: string, permissions: CashierPermissions) => Promise<void> }) {
  const [ownerName, setOwnerName] = useState(config.ownerName || "خاوەن");
  const [cashierName, setCashierName] = useState(config.cashierName || "کاشێر");
  const [currentPin, setCurrentPin] = useState("");
  const [ownerPin, setOwnerPin] = useState("");
  const [ownerConfirm, setOwnerConfirm] = useState("");
  const [cashierPin, setCashierPin] = useState("");
  const [removeCashier, setRemoveCashier] = useState(false);
  const [timeout, setTimeoutMinutes] = useState(config.timeoutMinutes);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [permissions, setPermissions] = useState<CashierPermissions>(config.cashierPermissions ?? DEFAULT_CASHIER_PERMISSIONS);
  const permissionModules = modules.filter((module) => !module.hidden && !OWNER_ONLY_MODULES.has(module.key));
  function applyProfile(profile: "standard" | "supervisor") {
    setPermissions((current) => ({ ...current, profile, allowedModules: profile === "standard" ? STANDARD_CASHIER_MODULES : SUPERVISOR_CASHIER_MODULES, maxDiscountPercent: profile === "standard" ? 5 : 10, allowCreditSales: profile === "supervisor" }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidPin(currentPin)) return setError("PIN ـی ئێستای خاوەن بنووسە");
    if (ownerPin && (!isValidPin(ownerPin) || ownerPin !== ownerConfirm)) return setError("PIN ـی نوێی خاوەن دروست نییە یان یەکسان نییە");
    if (cashierPin && (!isValidPin(cashierPin) || cashierPin === ownerPin || cashierPin === currentPin)) return setError("PIN ـی نوێی کاشێر دەبێت ٦ ژمارە و جیاواز بێت");
    setBusy(true); setError("");
    try { await onSave(currentPin, ownerPin, cashierPin, removeCashier, timeout, ownerName, cashierName, permissions); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "گۆڕانکاری پاشەکەوت نەکرا"); }
    finally { setBusy(false); }
  }
  const eventLabel = (action: string) => ({
    "security.unlocked": "کردنەوەی سیستەم",
    "security.pin_failed": "هەوڵی PIN ـی هەڵە",
    "security.auto_locked": "قوفڵبوونی خۆکار",
    "security.manual_locked": "قوفڵکردنی دەستی",
    "security.background_locked": "قوفڵبوون لە پاشبنەما",
    "security.config_updated": "گۆڕینی ڕێکخستنی پاراستن",
  }[action] ?? action);
  return <div className="pin-gate" role="dialog" aria-modal="true"><form className="pin-card security-panel" onSubmit={submit}>
    <button className="pin-close" type="button" onClick={onClose} aria-label="داخستن"><X size={19} /></button>
    <span className="pin-icon"><LockKeyhole size={30} /></span><h2>بەڕێوەبردنی پاراستن</h2>
    <div className="security-status-row"><span><b>PIN ـی خاوەن</b><small>چالاکە</small></span><span><b>PIN ـی کاشێر</b><small>{config.cashier ? "چالاکە" : "دانەنراوە"}</small></span></div>
    <div className="security-name-grid"><label>ناوی خاوەن<input maxLength={40} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} type="text" /></label><label>ناوی کاشێر<input maxLength={40} value={cashierName} onChange={(event) => setCashierName(event.target.value)} type="text" /></label></div>
    <label>PIN ـی ئێستای خاوەن<input inputMode="numeric" maxLength={6} value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, ""))} type="password" autoFocus /></label>
    <fieldset><legend>گۆڕینی PIN ـی خاوەن — ئارەزوومەندانە</legend><label>PIN ـی نوێ<input inputMode="numeric" maxLength={6} value={ownerPin} onChange={(event) => setOwnerPin(event.target.value.replace(/\D/g, ""))} type="password" /></label><label>دووبارەکردنەوە<input inputMode="numeric" maxLength={6} value={ownerConfirm} onChange={(event) => setOwnerConfirm(event.target.value.replace(/\D/g, ""))} type="password" /></label></fieldset>
    <fieldset><legend>PIN ـی کاشێر</legend><label>PIN ـی نوێ<input disabled={removeCashier} inputMode="numeric" maxLength={6} value={cashierPin} onChange={(event) => setCashierPin(event.target.value.replace(/\D/g, ""))} type="password" /></label>{config.cashier && <label className="security-check"><input checked={removeCashier} onChange={(event) => setRemoveCashier(event.target.checked)} type="checkbox" />لابردنی PIN ـی کاشێر</label>}</fieldset>
    <fieldset className="cashier-permissions"><legend>دەسەڵاتی کاشێر</legend><label>ئاستی کاشێر<select value={permissions.profile} onChange={(event) => applyProfile(event.target.value === "supervisor" ? "supervisor" : "standard")}><option value="standard">کاشێری ئاسایی</option><option value="supervisor">کاشێری سەرپەرشتیار</option></select></label><label>زۆرترین داشکاندن ٪<input type="number" min="0" max="100" step="0.5" value={permissions.maxDiscountPercent} onChange={(event) => setPermissions((current) => ({ ...current, maxDiscountPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }))} /></label><label className="security-check allow"><input type="checkbox" checked={permissions.allowCreditSales} onChange={(event) => setPermissions((current) => ({ ...current, allowCreditSales: event.target.checked }))} />ڕێگەدان بە فرۆشتنی قەرز</label><div className="permission-module-grid">{permissionModules.map((module) => <label key={module.key}><input type="checkbox" checked={permissions.allowedModules.includes(module.key)} onChange={(event) => setPermissions((current) => ({ ...current, allowedModules: event.target.checked ? [...new Set([...current.allowedModules, module.key])] : current.allowedModules.filter((key) => key !== module.key) }))} />{module.title}</label>)}</div></fieldset>
    <label>قوفڵبوونی خۆکار<select value={timeout} onChange={(event) => setTimeoutMinutes(Number(event.target.value))}><option value={1}>دوای ١ خولەک</option><option value={5}>دوای ٥ خولەک</option><option value={15}>دوای ١٥ خولەک</option><option value={30}>دوای ٣٠ خولەک</option></select></label>
    <div className="security-events"><strong>دوایین ڕووداوە ئاسایشییەکان</strong>{events.length ? events.map((entry) => <span key={entry.id}><b>{eventLabel(entry.action)}</b><small>{entry.operatorName} · {new Date(entry.createdAt).toLocaleString("ckb-IQ")}</small></span>) : <small>هێشتا ڕووداوێک تۆمار نەکراوە</small>}</div>
    {error && <div className="pin-error" role="alert">{error}</div>}<button disabled={busy} type="submit">{busy ? "پاراستن..." : "پاشەکەوتکردنی گۆڕانکاری"}</button><button className="security-lock-now" type="button" onClick={onLock}><LockKeyhole size={15} /> ئێستا قوفڵی بکە</button>
  </form></div>;
}
