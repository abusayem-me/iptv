"use client";

import type { CategoryMeta } from "@/app/components/TVApp";
import { formatHealthCheckedAgo } from "@/lib/channelHealthCache";
import type { HealthCheckStats } from "@/lib/runChannelHealthCheck";

type ViewFilter = "all" | "favorites";
type HealthFilter = "all" | "live" | "dead";

type Props = {
  q: string;
  onSearchChange: (value: string) => void;
  view: ViewFilter;
  onViewChange: (view: ViewFilter) => void;
  favCount: number;
  cat: string;
  onCategoryChange: (categoryId: string) => void;
  categories: CategoryMeta[];
  categoryLabel: (id: string) => string;
  filteredCount: number;
  shownCount: number;
  totalCount: number;
  healthFilterActive: boolean;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  categoryCheckCount: number;
  checkRunning: boolean;
  checkStats: HealthCheckStats | null;
  healthCheckedAt: number | null;
  hasHealthResults: boolean;
  healthFilter: HealthFilter;
  onHealthFilterChange: (filter: HealthFilter) => void;
  onStartHealthCheck: () => void;
  onStopHealthCheck: () => void;
};

export function ChannelFilterPanel({
  q,
  onSearchChange,
  view,
  onViewChange,
  favCount,
  cat,
  onCategoryChange,
  categories,
  categoryLabel,
  filteredCount,
  shownCount,
  totalCount,
  healthFilterActive,
  hasActiveFilters,
  onResetFilters,
  categoryCheckCount,
  checkRunning,
  checkStats,
  healthCheckedAt,
  hasHealthResults,
  healthFilter,
  onHealthFilterChange,
  onStartHealthCheck,
  onStopHealthCheck,
}: Props) {
  const displayCount = healthFilterActive ? shownCount : filteredCount;
  const checkTitle =
    cat === "all"
      ? `Check all ${categoryCheckCount} channels (shared globally)`
      : `Check ${categoryCheckCount} in ${categoryLabel(cat)} (shared globally)`;

  return (
    <section className="filter-panel filter-panel-compact" aria-label="Channel filters">
      <header className="filter-panel-header">
        <h2 className="filter-panel-title">Browse</h2>
        <div className="filter-panel-header-end">
          <span className="filter-panel-meta" aria-live="polite">
            <span className="filter-count-strong">{displayCount}</span>
            <span className="filter-count-muted">/ {filteredCount}</span>
            <span className="filter-count-total">{totalCount}</span>
          </span>
          {hasActiveFilters ? (
            <button type="button" className="btn-filter-reset-inline" onClick={onResetFilters}>
              Reset
            </button>
          ) : null}
        </div>
      </header>

      <div className="filter-panel-body">
        <input
          id="channel-search"
          type="search"
          className="search search-toolbar search-full"
          placeholder="Search channels…"
          aria-label="Search channels"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />

        <div className="filter-inline-row">
          <div className="segmented filter-seg" role="group" aria-label="Library">
            <button
              type="button"
              className={view === "all" ? "seg active" : "seg"}
              onClick={() => onViewChange("all")}
            >
              All
            </button>
            <button
              type="button"
              className={view === "favorites" ? "seg active" : "seg"}
              onClick={() => onViewChange("favorites")}
            >
              Favs
              {favCount > 0 ? <span className="seg-badge">{favCount}</span> : null}
            </button>
          </div>

          <select
            id="category-select"
            className="select select-cat"
            aria-label="Category"
            value={cat}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c.id)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-health filter-health-compact" aria-label="Stream health">
          <div className="filter-health-row">
            {checkRunning && checkStats ? (
              <span className="filter-health-progress-label">
                {checkStats.done}/{checkStats.total}
              </span>
            ) : checkStats && !checkRunning ? (
              <span className="filter-health-summary">
                <span className="health-chip health-chip-live">{checkStats.live} live</span>
                <span className="health-chip health-chip-dead">{checkStats.dead} dead</span>
                {healthCheckedAt ? (
                  <span className="filter-health-ago" title={new Date(healthCheckedAt).toLocaleString()}>
                    {formatHealthCheckedAgo(healthCheckedAt)}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="filter-health-label">Stream check</span>
            )}
            {checkRunning ? (
              <button type="button" className="btn-check btn-check-stop btn-check-sm" onClick={onStopHealthCheck}>
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="btn-check btn-check-sm"
                disabled={categoryCheckCount === 0}
                title={checkTitle}
                onClick={onStartHealthCheck}
              >
                {hasHealthResults ? "Re-check" : "Check"}
              </button>
            )}
          </div>

          {checkRunning && checkStats ? (
            <div className="check-progress" aria-hidden>
              <div
                className="check-progress-bar"
                style={{ width: `${checkStats.total ? (checkStats.done / checkStats.total) * 100 : 0}%` }}
              />
            </div>
          ) : null}

          {hasHealthResults ? (
            <div className="segmented filter-seg filter-seg-status" role="group" aria-label="Show results">
              <button
                type="button"
                className={healthFilter === "all" ? "seg active" : "seg"}
                onClick={() => onHealthFilterChange("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`seg seg-live ${healthFilter === "live" ? "active" : ""}`}
                onClick={() => onHealthFilterChange("live")}
              >
                Live
                {checkStats && checkStats.live > 0 ? (
                  <span className="seg-badge seg-badge-live">{checkStats.live}</span>
                ) : null}
              </button>
              <button
                type="button"
                className={`seg seg-dead ${healthFilter === "dead" ? "active" : ""}`}
                onClick={() => onHealthFilterChange("dead")}
              >
                Dead
                {checkStats && checkStats.dead > 0 ? (
                  <span className="seg-badge seg-badge-dead">{checkStats.dead}</span>
                ) : null}
              </button>
            </div>
          ) : !checkRunning ? (
            <p className="filter-health-empty">Run a check to label streams.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
