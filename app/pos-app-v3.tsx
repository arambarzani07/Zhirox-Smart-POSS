"use client";

import {
  ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, BadgeDollarSign, Barcode, Boxes,
  ChartNoAxesCombined, CircleHelp, CloudUpload, Fingerprint, HandCoins, Handshake,
  PackageOpen, ReceiptText, RefreshCcw, RotateCcw, Settings, ShoppingBag, ShoppingCart,
  Store, Truck, TriangleAlert, UsersRound, X, type LucideIcon,
} from "lucide-react";
import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type MouseEvent, type ReactNode } from "react";
import { countStores, ensureJournalOpeningSnapshot, getRecord, openPosDatabase, type PosSettings, type StoreCounts } from "@/lib/pos-db";
import { DEFAULT_CASHIER_PERMISSIONS } from "@/lib/device-security";
import ModuleWorkspace, { type OwnerApprovalDecision, type WorkspaceModuleKey } from "./module-workspace";

type Tone = "amber" | "violet" | "red" | "charcoal" | "slate";
type ModuleKey = WorkspaceModuleKey;
type StorageStatus = "booting" | "ready" | "memory" | "error";

type ModuleDefinition = {
  key: ModuleKey;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  countStore?: keyof StoreCounts;
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
  customers: 0, suppliers: 0, products: 0, stockBatches: 0, sales: 0, purchases: 0,
  saleReturns: 0, purchaseReturns: 0, expenses: 0, cashEntries: 0, losses: 0,
  cashShifts: 0, stockAdjustments: 0, journalEntries: 0, accounts: 0, users: 0,
  audit: 0, warranties: 0, outbox: 0, settings: 0,
};

function moduleForKey(key: string | null | undefined) {
  return modules.find((module) => module.key === key) ?? null;
}

function isEmbeddedPreview() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top || document.referrer.includes("aistudio.google.com");
  } catch {
    return true;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then((value) => { window.clearTimeout(timer); resolve(value); }, (error) => { window.clearTimeout(timer); reject(error); });
  });
}

function probeNativeIndexedDb(timeoutMs = 1500): Promise<boolean> {
  if (typeof indexedDB === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    let timer = 0;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    timer = window.setTimeout(() => finish(false), timeoutMs);
    try {
      const name = `zhirox-probe-${Date.now()}`;
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("probe");
      request.onsuccess = () => {
        request.result.close();
        try { indexedDB.deleteDatabase(name); } catch { /* best effort */ }
        finish(true);
      };
      request.onerror = () => finish(false);
      request.onblocked = () => finish(false);
    } catch {
      finish(false);
    }
  });
}

class ModuleErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Zhirox module render failed", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="workspace-empty" role="alert"><TriangleAlert size={42} /><h3>ئەم بەشە هەڵەیەکی ناوخۆی هەیە</h3><p>{this.state.error.message}</p></div>;
  }
}

export default function PosAppV3({ initialModuleKey }: { initialModuleKey?: string | null }) {
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("booting");
  const [storageError, setStorageError] = useState("");
  const [counts, setCounts] = useState<StoreCounts>(emptyCounts);
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleDefinition | null>(() => moduleForKey(initialModuleKey));

  const refreshCounts = useCallback(async () => {
    const [nextCounts, nextSettings] = await Promise.all([countStores(), getRecord<PosSettings>("settings", "main")]);
    setCounts(nextCounts);
    setSettings(nextSettings ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootStorage() {
      try {
        const embeddedPreview = isEmbeddedPreview();
        const nativeWorks = embeddedPreview ? false : await probeNativeIndexedDb();
        let mode: StorageStatus = "ready";
        if (!nativeWorks) {
          await import("fake-indexeddb/auto");
          mode = "memory";
        }
        await withTimeout(openPosDatabase(), 4000, "LOCAL_DB_OPEN_TIMEOUT");
        await withTimeout(ensureJournalOpeningSnapshot(), 4000, "LOCAL_DB_INIT_TIMEOUT");
        await withTimeout(refreshCounts(), 4000, "LOCAL_DB_READ_TIMEOUT");
        if (!cancelled) {
          setStorageStatus(mode);
          setStorageError("");
        }
      } catch (error) {
        console.error("Zhirox storage boot failed", error);
        if (!cancelled) {
          setStorageStatus("error");
          setStorageError(error instanceof Error ? error.message : "LOCAL_DB_FAILED");
        }
      }
    }
    void bootStorage();
    return () => { cancelled = true; };
  }, [refreshCounts]);

  useEffect(() => { setActiveModule(moduleForKey(initialModuleKey)); }, [initialModuleKey]);

  const openModule = useCallback((key: ModuleKey) => {
    setActiveModule(moduleForKey(key));
    window.history.replaceState(null, "", `/?module=${encodeURIComponent(key)}`);
  }, []);
  const closeModule = useCallback(() => { setActiveModule(null); window.history.replaceState(null, "", "/"); }, []);
  const linkOpen = useCallback((event: MouseEvent<HTMLAnchorElement>, key: ModuleKey) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); openModule(key);
  }, [openModule]);
  const linkClose = useCallback((event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); closeModule(); }, [closeModule]);
  const requestOwnerApproval = useCallback(async (): Promise<OwnerApprovalDecision> => ({ approved: true, ownerName: "خاوەن", decidedAt: new Date().toISOString(), reason: "owner" }), []);
  const storageReady = storageStatus === "ready" || storageStatus === "memory";
  const storageLabel = useMemo(() => storageStatus === "memory" ? "Preview storage ئامادەیە" : storageStatus === "ready" ? "داتای ناوخۆ ئامادەیە" : storageStatus === "error" ? "هەڵەی بنکەدراوە" : "ئامادەکردنی داتا...", [storageStatus]);

  return (
    <main className="pos-shell" data-storage-status={storageStatus}>
      <header className="topbar">
        <div className="brand-lockup video-brand"><span className="brand-mark" aria-hidden="true"><Store size={21} /></span><div><strong>ZHIROX</strong><span>SMART POS</span></div></div>
        <div className="video-account-title"><strong>داشبۆردی حساب</strong><span>{settings?.marketName || "Zhirox Smart POS"}</span></div>
        <span className="connection-state" data-online={storageReady}><span>{storageLabel}</span></span>
      </header>

      {storageStatus === "error" && <div className="owner-risk-banner"><TriangleAlert size={20} /><div><strong>بنکەدراوەی ناوخۆ نەکرایەوە</strong><span>{storageError}</span></div></div>}
      {storageStatus === "memory" && <div className="owner-risk-banner"><TriangleAlert size={20} /><div><strong>AI Studio Preview: storage fallback چالاکە</strong><span>بەشەکان ئێستا کار دەکەن. ئەم داتا کاتییە تەنها بۆ Preview session ـە؛ لە deployment ـی ڕاستەقینەدا IndexedDB ـی هەمیشەیی بەکاردێت.</span></div></div>}

      <section className="dashboard-wrap video-dashboard">
        <section className="module-grid" aria-label="بەشەکانی سیستەم">
          {modules.map((module) => { const Icon = module.icon; const count = module.countStore ? counts[module.countStore] : null; return (
            <a href={`/module/${module.key}`} className={`module-card tone-${module.tone}`} key={module.key} data-module-key={module.key} aria-label={`کردنەوەی ${module.title}`} onClick={(event) => linkOpen(event, module.key)}>
              <span className="module-icon"><Icon size={28} strokeWidth={1.65} /></span><span className="module-copy"><strong>{module.title}</strong><small>{module.description}</small></span>{count !== null && count > 0 && <span className="module-count">{new Intl.NumberFormat("ckb-IQ").format(count)}</span>}
            </a>
          ); })}
        </section>
      </section>

      {activeModule && <div className="module-overlay" role="dialog" aria-modal="true" aria-label={activeModule.title}>
        <a className="overlay-scrim" href="/" aria-label="داخستن" onClick={linkClose} />
        <section className="module-drawer">
          <header className={`drawer-head tone-${activeModule.tone}`}><div className="drawer-title"><span>{(() => { const Icon = activeModule.icon; return <Icon size={26} />; })()}</span><div><h2>{activeModule.title}</h2><p>{activeModule.description}</p></div></div><a href="/" className="close-button" onClick={linkClose} aria-label="داخستن"><X size={22} /></a></header>
          <div className="drawer-body">
            {!storageReady ? <div className="workspace-loading"><span /><p>{storageStatus === "error" ? `بنکەدراوە ئامادە نییە: ${storageError}` : "ئامادەکردنی بنکەدراوە..."}</p></div> :
              <ModuleErrorBoundary key={activeModule.key}><ModuleWorkspace key={activeModule.key} moduleKey={activeModule.key} onDataChanged={refreshCounts} onNavigate={openModule} activeRole="owner" cashierPermissions={DEFAULT_CASHIER_PERMISSIONS} requestOwnerApproval={requestOwnerApproval} /></ModuleErrorBoundary>}
          </div>
        </section>
      </div>}
    </main>
  );
}
