"use client";

import { useId, useState } from "react";
import styles from "./auth.module.css";

type GlassFieldProps = {
  id?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  showToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
};

export function GlassField({
  id,
  label,
  type = "text",
  value,
  onChange,
  required,
  autoComplete,
  minLength,
  showToggle,
  showPassword,
  onTogglePassword,
}: GlassFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  return (
    <div
      className={`${styles.inputField}${floated ? ` ${styles.floated}` : ""}${showToggle ? "" : ` ${styles.inputFieldNoToggle}`}`}
    >
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder=" "
      />
      <label htmlFor={inputId}>{label}</label>
      {showToggle ? (
        <button type="button" className={styles.showBtn} onClick={onTogglePassword}>
          {showPassword ? "Berkit" : "Ko'rsat"}
        </button>
      ) : null}
    </div>
  );
}
