import { useCallback, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  DEFAULT_FILTERS,
  filtersToSearchParams,
  parseFiltersFromSearch,
} from "./moderationConstants.js";

export function useModerationFilters() {
  const history = useHistory();
  const location = useLocation();

  const filters = useMemo(
    () => parseFiltersFromSearch(location.search),
    [location.search]
  );

  const setFilters = useCallback(
    (patch, { replace = true } = {}) => {
      const next = { ...filters, ...patch };
      if (patch.page === undefined && Object.keys(patch).some((k) => k !== "page")) {
        next.page = 1;
      }
      const qs = filtersToSearchParams(next);
      const path = `/moderation${qs.toString() ? `?${qs}` : ""}`;
      if (replace) history.replace(path);
      else history.push(path);
    },
    [filters, history]
  );

  const resetFilters = useCallback(() => {
    history.replace("/moderation");
  }, [history]);

  return { filters, setFilters, resetFilters, DEFAULT_FILTERS };
}
