"use client";

import { motion } from "framer-motion";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
      style={{
        backgroundColor: checked ? "var(--accent)" : "var(--border)",
      }}
    >
      <motion.span
        className="block h-5 w-5 rounded-full bg-white shadow"
        animate={{ x: checked ? 22 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
