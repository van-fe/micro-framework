export type RiskLevel = "high" | "medium" | "low";

export interface CustomerAccount {
  id: string;
  initials: string;
  name: string;
  tier: "enterprise" | "growth" | "scale";
  risk: RiskLevel;
  score: number;
  revenue: string;
  color: string;
}

export const customers: readonly CustomerAccount[] = [
  { id: "orchid", initials: "OS", name: "Orchid Supply", tier: "enterprise", risk: "high", score: 82, revenue: "$184k", color: "#dce8ff" },
  { id: "aster", initials: "AC", name: "Aster & Co.", tier: "growth", risk: "medium", score: 61, revenue: "$96k", color: "#f3e1ff" },
  { id: "fieldwork", initials: "FL", name: "Fieldwork Labs", tier: "enterprise", risk: "low", score: 28, revenue: "$241k", color: "#e2f0d7" },
  { id: "goodmorrow", initials: "GM", name: "Goodmorrow", tier: "scale", risk: "low", score: 18, revenue: "$73k", color: "#ffe4ce" },
];
