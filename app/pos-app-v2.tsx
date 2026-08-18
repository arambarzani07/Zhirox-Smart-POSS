"use client";

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BadgeDollarSign,
  Barcode,
  Boxes,
  ChartNoAxesCombined,
  CircleHelp,
  Cloud,
  CloudUpload,
  Fingerprint,
  HandCoins,
  Handshake,
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
import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type MouseEvent, type ReactNode } from "react";
import {
  countStores,
  ensureJournalOpeningSnapshot,
  getRecord,
  openPosDatabase,
  type PosSettings,
  type StoreCounts,
} from "@/lib/pos-db";
import { DEFAULT_CASHIER_PERMISSIONS } from "@/lib/device-security";
import { syncPosData, type PosSyncResult } from "@/lib/pos-sync";
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
};

const modules: ModuleDefinition[] = [
  { key: "cashier", title: "کاشێر", description: "فرۆشتن و دەرکردنی پسوڵە", icon: ShoppingCart, tone: "amber" },
  { key: "products", title: "کالا", description: "بارکۆد، نرخ و یەکە", icon: Boxes, tone: "violet", countStore: "products" },
  { key: "debts", title: "بەڕێوەبردنی قەرز", description: "قەرز، دانەوە و کشفی حساب", icon: Handshake, tone: "red", countStore: "customers" },
  { key: "customers", title: "کڕیار", description: "کڕیار، قەرز و کشفی حساب", icon: UsersRound, tone: "amber", countStore: "customers" },
  { key: "sales", title: "فرۆشراو", description: "مێژووی هەموو فرۆشتنەکان", icon: ReceiptText, tone: "amber", countStore: "sales" },
  { key: "warehouse", title: "کۆگا", description: "بڕ و بەهای کاڵاکان", icon: PackageOpen, tone: "red", countStore: "products" },
  { key: "purchases", title: "کڕین", description: "تۆمارکردنی پسوڵەی کڕین", icon: ShoppingBag, tone: "violet", countStore: "purchases" },
  { key: "suppliers", title: "دابینکەر", description: "کۆمپانیا و کشفی حساب", icon: Truck, tone: "violet", countStore: "suppliers" },
  { key: "cashIn", title: "پارەوەرگرتن", description: "وەرگرتنی پارە و قەرز", icon: ArrowDownToLine, tone: "slate", countStore: "cashEntries" },
  { key: "salesReturns", title: "گەڕاوی فرۆش", description: "گەڕاندنەوەی پسوڵە و کالا", icon: RotateCcw, tone: "amber" },
  { key: "purchaseReturns", title: "گەڕاوی کڕین", description: "گەڕاندنەوە بۆ دابینکەر", icon: RefreshCcw, tone: "violet" },
  { key: "cashOut", title: "پارەدان", description: "پارەدان بە دابینکەر و کەسان", icon: ArrowUpFromLine, tone: "slate", countStore: "cashEntries" },
  { key: "expenses", title: "خەرجی", description: "کرێ، کارەبا و خەرجییەکان", icon: HandCoins, tone: "slate", countStore: "expenses" },
  { key: "reports", title: "ڕاپۆرت", description: "فرۆش، قازانج و کۆگا", icon: ChartNoAxesCombined, tone: "slate" },
  { key: "accounting", title: "ژمێریاری", description: "قاسە، قەرز و جووڵەی پارە", icon: BadgeDollarSign, tone: "charcoal" },
  { key: "losses", title: "خەساربوو", description: "تێکچوو، بەسەرچوو و کەمبوو", icon: ArrowLeftRight, tone: "red", countStore: "losses" },
  { key: "labels", title: "لەیبڵ", description: "چاپی بارکۆد و نرخ", icon: Barcode, tone: "red" },
  { key: "audit", title: "چاودێری خاوەن", description: "کردار و چالاکییە گرنگەکان", icon: Fingerprint, tone: "charcoal", countStore: "audit" },
  { key: "backup", title: "پاشەکەوتی داتا", description: "پاراستن و گەڕاندنەوەی داتا", icon: CloudUpload, tone: "slate" },
  { key: "settings", title: "ڕێکخستنەکان", description: "فرۆشگا، دراو و چاپکەر", icon: Settings, tone: "slate" },
  { key: "help", title: "ناوەندی ئاگاداری", description: "ئەرک و ئاگادارییە گرنگەکان", icon: CircleHelp, tone: "slate" },
];

const emptyCounts: StoreCounts = {
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
  warranties: 0,
  outbox: 0,
  settings: 0,
};

const initialSyncState: PosSyncResult = {
  phase: "pending",
  pending: 0,
  revision: 0,
  lastSyncedAt: null,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ckb-IQ").format(value);
}

function moduleForKey(key: string | null | undefined) {
  if (!key) return null;
  return modules.find((module) => module.key === key && !module.hidden) ?? null;
}

class ModuleErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Zhirox module render failed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="workspace-empty" role="alert">
          <TriangleAlert size={42} />
          <h3>ئەم بەشە هەڵەیەکی ناوخۆی هەیە</h3>
          <p>{this.state.error.message || "هەڵەی نەناسراو"}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>دووبارە هەوڵدانەوە</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PosAppV2({ initialModuleKey }: { initialModuleKey?: string | null }) {
  const [dbReady, setDbReady] = useState(false);
  const [counts, setCounts] = useState<StoreCounts>(emptyCounts);
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleDefinition | null>(() => moduleForKey(initialModuleKey));
  const [online, setOnline] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncState, setSyncState] = useState<PosSyncResult>(initialSyncState);

  const refreshCounts = useCallback(async () => {
    const [nextCounts, nextSettings] = await Promise.all([
      countStores(),
      getRecord<PosSettings>("settings", "main"),
    ]);
    setCounts(nextCounts);
    setSettings(nextSettings ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      ).catch(() => undefined);
    }
    if ("caches" in window) {
      void caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("zhirox-pos-shell-")).map((key) => caches.delete(key))),
      ).catch(() => undefined);
    }

    void openPosDatabase()
      .then(() => ensureJournalOpeningSnapshot())
      .then(() => refreshCounts())
      .then(() => { if (!cancelled) setDbReady(true); })
      .catch((error) => {
        console.error("Zhirox local database initialization failed", error);
        if (!cancelled) setDbReady(false);
      });

    return () => {
      cancelled = true;
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [refreshCounts]);

  useEffect(() => {
    setActiveModule(moduleForKey(initialModuleKey));
  }, [initialModuleKey]);

  const openModule = useCallback((key: ModuleKey) => {
    const selected = moduleForKey(key);
    if (!selected) return;
    setActiveModule(selected);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/?module=${encodeURIComponent(key)}`);
    }
  }, []);

  const closeModule = useCallback(() => {
    setActiveModule(null);
    if (typeof window !== "undefined") window.history.replaceState(null, "", "/");
  }, []);

  const openModuleFromLink = useCallback((event: MouseEvent<HTMLAnchorElement>, key: ModuleKey) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openModule(key);
  }, [openModule]);

  const closeFromLink = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    closeModule();
  }, [closeModule]);

  const handleDataChanged = useCallback(async () => {
    await refreshCounts();
  }, [refreshCounts]);

  const performSync = useCallback(async () => {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncState((current) => ({ ...current, phase: "syncing" }));
    try {
      const next = await syncPosData();
      setSyncState(next);
      await refreshCounts();
    } catch (error) {
      console.error("Zhirox sync failed", error);
      setSyncState((current) => ({ ...current, phase: "error" }));
    } finally {
      setSyncBusy(false);
    }
  }, [refreshCounts, syncBusy]);

  const requestOwnerApproval = useCallback(async (): Promise<OwnerApprovalDecision> => ({
    approved: true,
    ownerName: "خاوەن",
    decidedAt: new Date().toISOString(),
    reason: "owner",
  }), []);

  const syncLabel = useMemo(() => {
    if (!online) return "ئۆفلاین";
    if (syncState.phase === "syncing") return "هاوکاتکردن...";
    if (syncState.phase === "conflict") return "پێکدانی داتا";
    if (syncState.phase === "error") return "هەڵەی Sync";
    if (syncState.pending) return `${formatNumber(syncState.pending)} چاوەڕوان`;
    return "هاوکاتە";
  }, [online, syncState]);

  return (
    <main className="pos-shell" data-navigation-version="native-v3">
      <header className="topbar">
        <div className="brand-lockup video-brand">
          <span className="brand-mark" aria-hidden="true"><Store size={21} /></span>
          <div><strong>ZHIROX</strong><span>SMART POS</span></div>
        </div>
        <div className="video-account-title"><strong>داشبۆردی حساب</strong><span>{settings?.marketName || "Zhirox Smart POS"}</span></div>
        <button
          className="connection-state"
          data-online={online}
          data-phase={syncState.phase}
          type="button"
          onClick={() => void performSync()}
          disabled={syncBusy || !dbReady}
          title="هاوکاتکردنی داتا"
        >
          {!online ? <WifiOff size={16} /> : syncState.phase === "error" || syncState.phase === "conflict" ? <TriangleAlert size={16} /> : syncState.phase === "synced" ? <Cloud size={16} /> : <Wifi size={16} />}
          <span>{syncLabel}</span>
        </button>
      </header>

      <section className="dashboard-wrap video-dashboard">
        <section className="module-grid" aria-label="بەشەکانی سیستەم">
          {modules.filter((module) => !module.hidden).map((module) => {
            const Icon = module.icon;
            const count = module.countStore ? counts[module.countStore] : null;
            return (
              <a
                href={`/?module=${encodeURIComponent(module.key)}`}
                className={`module-card tone-${module.tone}`}
                key={module.key}
                data-module-key={module.key}
                aria-label={`کردنەوەی ${module.title}`}
                onClick={(event) => openModuleFromLink(event, module.key)}
              >
                <span className="module-icon"><Icon size={28} strokeWidth={1.65} /></span>
                <span className="module-copy"><strong>{module.title}</strong><small>{module.description}</small></span>
                {count !== null && count > 0 && <span className="module-count">{formatNumber(count)}</span>}
              </a>
            );
          })}
        </section>
      </section>

      {activeModule && (
        <div className="module-overlay" role="dialog" aria-modal="true" aria-label={activeModule.title}>
          <a className="overlay-scrim" href="/" aria-label="داخستن" onClick={closeFromLink} />
          <section className="module-drawer">
            <header className={`drawer-head tone-${activeModule.tone}`}>
              <div className="drawer-title">
                <span>{(() => { const Icon = activeModule.icon; return <Icon size={26} />; })()}</span>
                <div><h2>{activeModule.title}</h2><p>{activeModule.description}</p></div>
              </div>
              <a href="/" className="close-button" onClick={closeFromLink} aria-label="داخستن"><X size={22} /></a>
            </header>
            <div className="drawer-body">
              <ModuleErrorBoundary key={activeModule.key}>
                <ModuleWorkspace
                  key={activeModule.key}
                  moduleKey={activeModule.key}
                  onDataChanged={handleDataChanged}
                  onNavigate={openModule}
                  activeRole="owner"
                  cashierPermissions={DEFAULT_CASHIER_PERMISSIONS}
                  requestOwnerApproval={requestOwnerApproval}
                />
              </ModuleErrorBoundary>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
