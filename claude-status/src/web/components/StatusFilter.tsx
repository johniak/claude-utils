import { SessionStatus } from "../../shared/types.js";

const FILTERS: { value: SessionStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "waiting", label: "Waiting" },
  { value: "error", label: "Errors" },
  { value: "stale", label: "Stale" },
  { value: "turn_complete", label: "Done" },
];

interface Props {
  filter: SessionStatus[];
  onFilterChange: (filters: SessionStatus[]) => void;
  counts: Record<string, number>;
}

export default function StatusFilter({ filter, onFilterChange, counts }: Props) {
  const toggle = (status: SessionStatus) => {
    if (filter.includes(status)) {
      onFilterChange(filter.filter((s) => s !== status));
    } else {
      onFilterChange([...filter, status]);
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
          className={`filter-btn ${filter.includes(f.value) ? "active" : ""}`}
          onClick={() => toggle(f.value)}
        >
          {f.label} ({counts[f.value] || 0})
        </button>
      ))}
    </div>
  );
}
