import type { ReactNode } from "react";

/** Seitenkopf: farbiges Symbol, Titel, Unterzeile und optionale Aktionen rechts. */
export function PageHeader({ icon, title, subtitle, tone = "qt-violet", actions }: { icon: ReactNode; title: string; subtitle?: string; tone?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <span className={`ph-icon ${tone}`} aria-hidden>{icon}</span>
      <div className="ph-text">
        <h1>{title}</h1>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </header>
  );
}
