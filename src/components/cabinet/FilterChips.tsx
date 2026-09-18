"use client";

type Chip<T extends string> = { value: T; label: string; count?: number };

export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "Filtr",
}: {
  value: T;
  onChange: (next: T) => void;
  options: Chip<T>[];
  ariaLabel?: string;
}) {
  return (
    <div className="lx-filters" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`lx-filter-chip${active ? " is-active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
            {typeof opt.count === "number" ? (
              <span className="lx-filter-count">{opt.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
