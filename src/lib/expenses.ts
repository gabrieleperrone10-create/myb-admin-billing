export const EXPENSE_CATEGORY_CFG: Record<string, { label: string; color: string; emoji: string }> = {
  TOOLS:          { label: "Software & Tools",   color: "#4f7deb", emoji: "⚙️" },
  MARKETING:      { label: "Marketing & Ads",    color: "#a855f7", emoji: "📣" },
  PAYROLL:        { label: "Personale",           color: "#3b9e6a", emoji: "👥" },
  FREELANCER:     { label: "Collaboratori",       color: "#06b6d4", emoji: "🤝" },
  INFRASTRUCTURE: { label: "Infrastruttura",      color: "#f97316", emoji: "🖥️" },
  LEGAL:          { label: "Legale & Fiscale",    color: "#eab308", emoji: "⚖️" },
  TRAVEL:         { label: "Trasferte",           color: "#ec4899", emoji: "✈️" },
  OFFICE:         { label: "Ufficio & Materiali", color: "#8b5cf6", emoji: "📦" },
  TAXES:          { label: "Tasse & Imposte",     color: "#dc2626", emoji: "🏛️" },
  OTHER:          { label: "Altro",               color: "#94a3b8", emoji: "📌" },
};

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_CFG).map(
  ([value, { label }]) => ({ value, label })
);
