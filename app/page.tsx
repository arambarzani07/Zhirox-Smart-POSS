import { modules } from "@/lib/modules";

export default function Home() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">Z</span><div><strong>ZHIROX</strong><small>SMART POS</small></div></div>
        <div className="topbar-title"><strong>داشبۆرد</strong><small>سیستەمی نوێ — stable baseline</small></div>
        <span className="status-pill">ئامادە</span>
      </header>

      <section className="hero">
        <div><p className="eyebrow">ZHIROX SMART POS</p><h1>هەموو بەشەکان، بەبێ loading gate</h1><p>ئەم وەشانە هیچ PIN، service worker، IndexedDB bootstrap یان sync loop ـێکی global نییە. هەر بەشێک route ـی سەربەخۆی خۆی هەیە.</p></div>
        <div className="hero-stat"><strong>{modules.length}</strong><span>بەشی سەربەخۆ</span></div>
      </section>

      <section className="module-grid" aria-label="بەشەکانی سیستەم">
        {modules.map((module) => (
          <a className="module-card" href={`/module/${module.key}`} key={module.key} data-module-key={module.key}>
            <span className="module-icon" aria-hidden="true">{module.icon}</span>
            <span className="module-copy"><strong>{module.title}</strong><small>{module.description}</small></span>
            <span className="module-arrow" aria-hidden="true">←</span>
          </a>
        ))}
      </section>
    </main>
  );
}
