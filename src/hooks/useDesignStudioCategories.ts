import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { buildDesignStudioCategoryRegistry } from "@/lib/designStudioCategories";
import { listAllShopAreaCategoryKeysForDesignStudio } from "@/services/shopAreas";

export function useDesignStudioCategoryRegistry(categoryMedia?: Readonly<Record<string, string>>) {
  const query = useQuery({
    queryKey: QUERY_KEYS.designStudioCategories,
    queryFn: listAllShopAreaCategoryKeysForDesignStudio,
  });

  const registry = useMemo(
    () =>
      buildDesignStudioCategoryRegistry({
        areaCategoryRows: query.data ?? [],
        categoryMedia,
      }),
    [query.data, categoryMedia],
  );

  const labelByKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of registry) map[entry.key] = entry.label;
    return map;
  }, [registry]);

  return { ...query, registry, labelByKey };
}
