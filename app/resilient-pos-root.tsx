"use client";

import { indexedDB as memoryIndexedDB, IDBKeyRange as MemoryIDBKeyRange } from "fake-indexeddb";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";

type PosRootProps = { initialModuleKey?: string | null };
type BootState = "booting" | "ready" | "error";

function isEmbeddedPreview() {
  try {
    return window.self !== window.top
      || document.referrer.includes("aistudio.google.com")
      || location.hostname.includes("googleusercontent.com");
  } catch {
    return true;
  }
}

function installMemoryStorage() {
  try {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: memoryIndexedDB,
    });
    Object.defineProperty(globalThis, "IDBKeyRange", {
      configurable: true,
      writable: true,
      value: MemoryIDBKeyRange,
    });
    return true;
  } catch (error) {
    console.error("Zhirox preview storage install failed", error);
    return false;
  }
}

function timeout<T>(promise: Promise<T>, milliseconds: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(code)), milliseconds);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

async function verifyStorageEndToEnd() {
  if (isEmbeddedPreview() && !installMemoryStorage()) {
    throw new Error("PREVIEW_STORAGE_INSTALL_FAILED");
  }

  const db = await timeout(import("@/lib/pos-db"), 3500, "POS_DB_CHUNK_TIMEOUT");
  await timeout(db.openPosDatabase(), 3500, "POS_DB_OPEN_TIMEOUT");
  await timeout(db.ensureJournalOpeningSnapshot(), 3500, "POS_DB_INIT_TIMEOUT");

  // This is intentionally the exact full read used by ModuleWorkspace. A POS
  // module is not mounted unless all stores can be read end-to-end.
  await timeout(db.loadDashboardData(), 5000, "POS_DASHBOARD_READ_TIMEOUT");
}

export default function ResilientPosRoot({ initialModuleKey }: PosRootProps) {
  const [state, setState] = useState<BootState>("booting");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [PosApp, setPosApp] = useState<ComponentType<PosRootProps> | null>(null);

  useEffect(() => {
    let alive = true;
    setState("booting");
    setError("");
    setPosApp(null);

    const watchdog = window.setTimeout(() => {
      if (!alive) return;
      setState("error");
      setError("POS_BOOT_WATCHDOG_TIMEOUT");
    }, 12_000);

    void (async () => {
      try {
        await verifyStorageEndToEnd();
        const module = await timeout(import("./pos-app-v3"), 5000, "POS_UI_CHUNK_TIMEOUT");
        if (!alive) return;
        setPosApp(() => module.default);
        setState("ready");
      } catch (bootError) {
        console.error("Zhirox POS boot failed", bootError);
        if (!alive) return;
        setError(bootError instanceof Error ? bootError.message : "POS_BOOT_FAILED");
        setState("error");
      } finally {
        window.clearTimeout(watchdog);
      }
    })();

    return () => {
      alive = false;
      window.clearTimeout(watchdog);
    };
  }, [attempt]);

  if (state === "ready" && PosApp) {
    return <PosApp initialModuleKey={initialModuleKey} />;
  }

  if (state === "error") {
    return (
      <main className="pos-shell">
        <section className="workspace-empty" role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", alignContent: "center", gap: 12 }}>
          <TriangleAlert size={44} />
          <h3>سیستەم نەتوانی بنکەدراوە ئامادە بکات</h3>
          <p dir="ltr">{error}</p>
          <button className="primary-action" type="button" onClick={() => setAttempt((value) => value + 1)}>دووبارە هەوڵدانەوە</button>
        </section>
      </main>
    );
  }

  return (
    <main className="pos-shell" data-boot-state="booting">
      <section className="workspace-loading" style={{ minHeight: "100vh" }}>
        <span />
        <p>پشکنین و ئامادەکردنی بنکەدراوە...</p>
      </section>
    </main>
  );
}
