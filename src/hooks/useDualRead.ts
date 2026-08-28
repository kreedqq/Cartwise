import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { logDualReadReport } from "@/lib/peptide/persistence/dualRead/log";
import { runDualRead } from "@/lib/peptide/persistence/dualRead/runDualRead";
import { shouldCompareResearchReads } from "@/lib/peptide/persistence/researchDbMode";
import { supabase } from "@/lib/supabaseClient";
import type { DualReadReport } from "@/lib/peptide/persistence/dualRead/types";

const researchSelectClient = {
  from(table: string) {
    return {
      select(columns: string) {
        return supabase.from(table as "substances").select(columns);
      },
    };
  },
};

export function useDualRead(options: { enabled?: boolean } = {}) {
  const { isAdmin } = useAuth();
  const compare = shouldCompareResearchReads();
  const enabled = (options.enabled ?? true) && isAdmin && compare;

  return useQuery({
    queryKey: QUERY_KEYS.researchDualRead,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 0,
    queryFn: async (): Promise<DualReadReport> => {
      const report = await runDualRead({ client: researchSelectClient });
      logDualReadReport(report);
      return report;
    },
  });
}
