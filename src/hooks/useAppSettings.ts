import { useMutation, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { adminSetAppSetting, type AppSettingKey } from "@/services/appSettings";

export function useSetAppSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: AppSettingKey; value: boolean }) => adminSetAppSetting(key, value),
    onSuccess: (state) => {
      queryClient.setQueryData(QUERY_KEYS.appPublicState, state);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appPublicState });
      void queryClient.invalidateQueries({ queryKey: ["shop-products"] });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myShopAreas });
    },
  });
}
