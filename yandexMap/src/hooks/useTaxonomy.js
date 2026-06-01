import { useCallback, useEffect, useState } from "react";
import issueTaxonomyFallback from "@issue-taxonomy";
import { getTaxonomy } from "../services/api.js";

export function useTaxonomy() {
  const [taxonomy, setTaxonomy] = useState(issueTaxonomyFallback);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const data = await getTaxonomy();
      if (data?.domains?.length) {
        setTaxonomy(data);
        return data;
      }
    } catch {
      setTaxonomy(issueTaxonomyFallback);
    }
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getTaxonomy();
        if (!cancelled && data?.domains?.length) {
          setTaxonomy(data);
        }
      } catch {
        if (!cancelled) setTaxonomy(issueTaxonomyFallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { taxonomy, loading, reload };
}
