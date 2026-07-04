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
  const checkScopeLabel =
    cat === "all" ? `all ${categoryCheckCount} channels` : `${categoryCheckCount} streams in ${categoryLabel(cat)}`;

  return (
    <section className="filter-panel" aria-label="Channel filters">
      <header className="filter-panel-header">
        <div className="filter-panel-heading">
          <h2 className="filter-panel-title">Browse channels</h2>
          <p className="filter-panel-subtitle">Search, filter by category, and check which streams are live.</p>
        </div>
        <div className="filter-panel-meta" aria-live="polite">
          <span className="filter-count-strong">{displayCount}</span>
          <span className="filter-count-muted">of {filteredCount} matching</span>
          <span className="filter-count-total">{totalCount} total</span>
        </div>
      </header>

      <div className="filter-panel-search">
        <label className="filter-field-label" htmlFor="channel-search">
          Search
        </label>
        <input
          id="channel-search"
          type="search"
          className="search search-toolbar search-full"
          placeholder="Channel name, category, or tag…"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="filter-panel-body">
        <div className="filter-row">
          <div className="filter-field">
            <span className="filter-field-label" id="library-label">
              Library
            </span>
            <div className="segmented filter-seg" role="group" aria-labelledby="library-label">
              <button
                type="button"
                className={view === "all" ? "seg active" : "seg"}
                onClick={() => onViewChange("all")}
              >
                All channels
              </button>
              <button
                type="button"
                className={view === "favorites" ? "seg active" : "seg"}
                onClick={() => onViewChange("favorites")}
              >
                Favorites
                {favCount > 0 ? <span className="seg-badge">{favCount}</span> : null}
              </button>
            </div>
          </div>

          <div className="filter-field filter-field-category">
            <label className="filter-field-label" htmlFor="category-select">
              Category
            </label>
            <select
              id="category-select"
              className="select select-cat"
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

          {hasActiveFilters ? (
            <div className="filter-field filter-field-reset">
              <span className="filter-field-label filter-field-label-spacer" aria-hidden>
                &nbsp;
              </span>
              <button type="button" className="btn-ghost btn-filter-reset" onClick={onResetFilters}>
                Reset filters
              </button>
            </div>
          ) : null}
        </div>

        <div className="filter-health" aria-label="Stream health">
            <div className="filter-health-top">
              <div>
                <h3 className="filter-health-title">Stream check</h3>
                <p className="filter-health-desc">
                  Tests {checkScopeLabel}. Labels are shared globally and update live for everyone.
                </p>
              </div>
              <div className="filter-health-actions">
                {checkRunning ? (
                  <button type="button" className="btn-check btn-check-stop" onClick={onStopHealthCheck}>
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-check"
                    disabled={categoryCheckCount === 0}
                    onClick={onStartHealthCheck}
                  >
                    {hasHealthResults ? "Re-check" : "Check live / dead"}
                  </button>
                )}
              </div>
            </div>

            {checkRunning && checkStats ? (
              <div className="filter-health-progress">
                <div className="filter-health-progress-label">
                  Checking {checkStats.done} of {checkStats.total}
                </div>
                <div className="check-progress" aria-hidden>
                  <div
                    className="check-progress-bar"
                    style={{ width: `${checkStats.total ? (checkStats.done / checkStats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ) : null}

            {checkStats && !checkRunning ? (
              <div className="filter-health-results" role="status">
                <span className="health-chip health-chip-live">{checkStats.live} live</span>
                <span className="health-chip health-chip-dead">{checkStats.dead} dead</span>
                {healthCheckedAt ? (
                  <span className="health-chip health-chip-muted" title={new Date(healthCheckedAt).toLocaleString()}>
                    Last run {formatHealthCheckedAgo(healthCheckedAt)}
                  </span>
                ) : null}
              </div>
            ) : null}

            {hasHealthResults ? (
              <div className="filter-field filter-field-status">
                <span className="filter-field-label" id="status-label">
                  Show results
                </span>
                <div className="segmented filter-seg filter-seg-status" role="group" aria-labelledby="status-label">
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
              </div>
            ) : !checkRunning ? (
              <p className="filter-health-empty">No check results yet — run a check to label live and dead streams.</p>
            ) : null}
          </div>
      </div>
    </section>
  );
}
