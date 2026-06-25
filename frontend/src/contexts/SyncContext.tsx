import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { refreshResults, fetchSyncStatus } from "@/api";

type SyncContextValue = {
  syncCounter: number;
  lastSync: string | null;
  syncing: boolean;
  triggerSync: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue>({
  syncCounter: 0,
  lastSync: null,
  syncing: false,
  triggerSync: async () => {},
});

export function useSync() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncCounter, setSyncCounter] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      await refreshResults();
      const status = await fetchSyncStatus();
      setLastSync(status.espn);
      setSyncCounter((c) => c + 1);
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <SyncContext.Provider value={{ syncCounter, lastSync, syncing, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}
