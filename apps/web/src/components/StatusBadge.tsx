import type { ReactNode } from "react";

interface StatusBadgeProps {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: ReactNode;
}

const toneClass = {
  neutral: "status-badge-neutral",
  success: "status-badge-success",
  warning: "status-badge-warning",
  danger: "status-badge-danger"
} as const;

export function StatusBadge({
  tone = "neutral",
  children
}: StatusBadgeProps) {
  return (
    <span className={`status-badge ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
