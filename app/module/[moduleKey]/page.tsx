import { getModule, modules } from "@/lib/modules";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return modules.map((module) => ({ moduleKey: module.key }));
}

export default async function ModulePage({ params }: { params: Promise<{ moduleKey: string }> }) {
  const { moduleKey } = await params;
  const module = getModule(moduleKey);
  if (!module) notFound();

  return (
    <main className="module-page">
      <header className="module-header">
        <a className="back-button" href="/" aria-label="گەڕانەوە">×</a>
        <div className="module-heading"><span>{module.icon}</span><div><h1>{module.title}</h1><p>{module.description}</p></div></div>
        {module.primaryAction ? <button className="primary-action" type="button" disabled title="داتا-لەیەر لە قۆناغی داهاتوو پەیوەست دەکرێت">{module.primaryAction}</button> : <span />}
      </header>

      <section className="module-content">
        <div className="module-notice"><strong>بەشەکە بە سەرکەوتوویی کراوەتەوە.</strong><span>هیچ loading یان initialization ـێکی blocking نییە.</span></div>
        <div className="section-grid">
          {module.sections.map((section) => (
            <article className="section-card" key={section}><h2>{section}</h2><p>ئەم بەشە بۆ data-layer ـی نوێ ئامادەیە و هیچ dependency ـێکی legacy نییە.</p></article>
          ))}
        </div>
        <section className="empty-state"><span>○</span><h2>هێشتا داتایەک نییە</h2><p>سیستەم بە داتای ساختە پڕ نەکراوەتەوە. داتا لە قۆناغی database integration ـدا بە شێوەی واقعی پەیوەست دەکرێت.</p></section>
      </section>
    </main>
  );
}
