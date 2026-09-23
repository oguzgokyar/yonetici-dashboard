"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function StockAccordionSection({
  id,
  title,
  summary,
  icon,
  openSection,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  icon: ReactNode;
  openSection: string;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  const isOpen = openSection === id;
  return (
    <section className={`stock-accordion ${isOpen ? "open" : ""}`}>
      <button type="button" className="stock-accordion-trigger" onClick={() => onToggle(id)} aria-expanded={isOpen}>
        <span className="stock-accordion-icon">{icon}</span>
        <span className="stock-accordion-heading"><strong>{title}</strong><small>{summary}</small></span>
        <ChevronDown size={16} />
      </button>
      {isOpen && <div className="stock-accordion-content">{children}</div>}
    </section>
  );
}
