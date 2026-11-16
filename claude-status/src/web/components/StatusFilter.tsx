import { SessionStatus } from "../../shared/types.js";

const FILTERS: { value: SessionStatus; values?: SessionStatus[]; label: string }[] = [
  { value: "active", values: ["active"], label: "Running" },
  { value: "waiting", values: ["waiting"], label: "Needs Input" },
  { value: "error", values: ["error"], label: "Errors" },
  { value: "stale", values: ["stale"], label: "Stale" },
  { value: "idle", values: ["idle"], label: "Idle" },
];

interface Props {
  filter: SessionStatus[];
  onFilterChange: (filters: SessionStatus[]) => void;
  counts: Record<string, number>;
}

export default function StatusFilter({ filter, onFilterChange, counts }: Props) {
  const toggle = (status: SessionStatus) => {
    const statuses = FILTERS.find((f) => f.value === status)?.values ?? [status];
    const isActive = statuses.every((s) => filter.includes(s));

    if (isActive) {
      onFilterChange(filter.filter((s) => !statuses.includes(s)));
    } else {
      onFilterChange(Array.from(new Set([...filter, ...statuses])));
    }
  };

  const clearAll = () => onFilterChange([]);

  return (
    <div className="status-filter">
      <button
        className={`filter-btn ${filter.length === 0 ? "active" : ""}`}
        onClick={clearAll}
      >
        All ({counts.all || 0})
      </button>
      {FILTERS.map((f) => (
        <button
          key={f.value}
          className={`filter-btn ${(f.values ?? [f.value]).every((s) => filter.includes(s)) ? "active" : ""}`}
          onClick={() => toggle(f.value)}
        >
          {f.label} ({counts[f.value] || 0})
        </button>
      ))}
    </div>
  );
}
