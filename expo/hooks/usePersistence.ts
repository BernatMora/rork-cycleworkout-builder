import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/workout-options';

// Types for persisted data
export interface CompletedSessionsMap {
  [sessionId: string]: boolean;
}

export interface AdaptiveFeedbackMap {
  [sessionId: string]: -5 | 0 | 5;
}

export interface SessionExecutionEntry {
  rpe: number;
  note: string;
  completedAt: string;
}

export interface SessionExecutionMap {
  [sessionId: string]: SessionExecutionEntry;
}

export interface SessionChaosMap {
  [sessionId: string]: number;
}

export interface SessionFavorite {
  id: string;
  name: string;
  duration: string;
  goal: string;
  level: string;
  style: string;
  warmupMinutes: string;
  cooldownMinutes: string;
  warmupPowerPercent: string;
  cooldownPowerPercent: string;
  createdAt: string;
}

export interface ExportHistoryEntry {
  id: string;
  label: string;
  files: number;
  createdAt: string;
  format: string;
  template?: string;
}

export function usePersistence() {
  const [completedSessions, setCompletedSessions] = useState<CompletedSessionsMap>({});
  const [adaptiveFeedback, setAdaptiveFeedback] = useState<AdaptiveFeedbackMap>({});
  const [sessionExecutionLog, setSessionExecutionLog] = useState<SessionExecutionMap>({});
  const [sessionChaosMap, setSessionChaosMap] = useState<SessionChaosMap>({});
  const [sessionFavorites, setSessionFavorites] = useState<SessionFavorite[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load all persisted data on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const [
          savedCompletedSessions,
          savedAdaptiveFeedback,
          savedSessionExecutionLog,
          savedSessionFavorites,
          savedExportHistory,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_SESSIONS),
          AsyncStorage.getItem(STORAGE_KEYS.ADAPTIVE_FEEDBACK),
          AsyncStorage.getItem(STORAGE_KEYS.SESSION_EXECUTION_LOG),
          AsyncStorage.getItem(STORAGE_KEYS.SESSION_FAVORITES),
          AsyncStorage.getItem(STORAGE_KEYS.EXPORT_HISTORY),
        ]);

        if (savedCompletedSessions) {
          setCompletedSessions(JSON.parse(savedCompletedSessions));
        }
        if (savedAdaptiveFeedback) {
          setAdaptiveFeedback(JSON.parse(savedAdaptiveFeedback));
        }
        if (savedSessionExecutionLog) {
          setSessionExecutionLog(JSON.parse(savedSessionExecutionLog));
        }
        if (savedSessionFavorites) {
          setSessionFavorites(JSON.parse(savedSessionFavorites));
        }
        if (savedExportHistory) {
          setExportHistory(JSON.parse(savedExportHistory));
        }
      } catch (error) {
        console.error('Error loading persisted data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersistedData();
  }, []);

  // Mark session as completed
  const markSessionCompleted = useCallback(
    async (sessionId: string, completed: boolean = true) => {
      const newCompletedSessions = { ...completedSessions, [sessionId]: completed };
      setCompletedSessions(newCompletedSessions);
      await AsyncStorage.setItem(
        STORAGE_KEYS.COMPLETED_SESSIONS,
        JSON.stringify(newCompletedSessions)
      );
    },
    [completedSessions]
  );

  // Set adaptive feedback for a session
  const setSessionFeedback = useCallback(
    async (sessionId: string, feedback: -5 | 0 | 5) => {
      const newFeedback = { ...adaptiveFeedback, [sessionId]: feedback };
      setAdaptiveFeedback(newFeedback);
      await AsyncStorage.setItem(STORAGE_KEYS.ADAPTIVE_FEEDBACK, JSON.stringify(newFeedback));
    },
    [adaptiveFeedback]
  );

  // Log session execution
  const logSessionExecution = useCallback(
    async (sessionId: string, rpe: number, note: string) => {
      const entry: SessionExecutionEntry = {
        rpe,
        note,
        completedAt: new Date().toISOString(),
      };
      const newLog = { ...sessionExecutionLog, [sessionId]: entry };
      setSessionExecutionLog(newLog);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_EXECUTION_LOG, JSON.stringify(newLog));
    },
    [sessionExecutionLog]
  );

  // Set chaos level for a session
  const setSessionChaos = useCallback(
    (sessionId: string, level: number) => {
      setSessionChaosMap((prev) => ({ ...prev, [sessionId]: level }));
    },
    []
  );

  // Add a session favorite
  const addSessionFavorite = useCallback(
    async (favorite: Omit<SessionFavorite, 'id' | 'createdAt'>) => {
      const newFavorite: SessionFavorite = {
        ...favorite,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      const newFavorites = [...sessionFavorites, newFavorite];
      setSessionFavorites(newFavorites);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_FAVORITES, JSON.stringify(newFavorites));
      return newFavorite;
    },
    [sessionFavorites]
  );

  // Remove a session favorite
  const removeSessionFavorite = useCallback(
    async (favoriteId: string) => {
      const newFavorites = sessionFavorites.filter((f) => f.id !== favoriteId);
      setSessionFavorites(newFavorites);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_FAVORITES, JSON.stringify(newFavorites));
    },
    [sessionFavorites]
  );

  // Add export history entry
  const addExportHistoryEntry = useCallback(
    async (entry: Omit<ExportHistoryEntry, 'id' | 'createdAt'>) => {
      const newEntry: ExportHistoryEntry = {
        ...entry,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      const newHistory = [newEntry, ...exportHistory].slice(0, 50); // Keep last 50 entries
      setExportHistory(newHistory);
      await AsyncStorage.setItem(STORAGE_KEYS.EXPORT_HISTORY, JSON.stringify(newHistory));
      return newEntry;
    },
    [exportHistory]
  );

  // Clear export history
  const clearExportHistory = useCallback(async () => {
    setExportHistory([]);
    await AsyncStorage.removeItem(STORAGE_KEYS.EXPORT_HISTORY);
  }, []);

  // Get completed session count
  const getCompletedCount = useCallback(() => {
    return Object.values(completedSessions).filter(Boolean).length;
  }, [completedSessions]);

  // Check if a session is completed
  const isSessionCompleted = useCallback(
    (sessionId: string) => {
      return !!completedSessions[sessionId];
    },
    [completedSessions]
  );

  // Get feedback for a session
  const getSessionFeedback = useCallback(
    (sessionId: string): -5 | 0 | 5 | undefined => {
      return adaptiveFeedback[sessionId];
    },
    [adaptiveFeedback]
  );

  // Export all data for backup
  const exportBackupData = useCallback(() => {
    return {
      completedSessions,
      adaptiveFeedback,
      sessionExecutionLog,
      sessionFavorites,
      exportHistory,
      exportedAt: new Date().toISOString(),
    };
  }, [completedSessions, adaptiveFeedback, sessionExecutionLog, sessionFavorites, exportHistory]);

  // Import backup data
  const importBackupData = useCallback(
    async (data: {
      completedSessions?: CompletedSessionsMap;
      adaptiveFeedback?: AdaptiveFeedbackMap;
      sessionExecutionLog?: SessionExecutionMap;
      sessionFavorites?: SessionFavorite[];
      exportHistory?: ExportHistoryEntry[];
    }) => {
      if (data.completedSessions) {
        setCompletedSessions(data.completedSessions);
        await AsyncStorage.setItem(
          STORAGE_KEYS.COMPLETED_SESSIONS,
          JSON.stringify(data.completedSessions)
        );
      }
      if (data.adaptiveFeedback) {
        setAdaptiveFeedback(data.adaptiveFeedback);
        await AsyncStorage.setItem(
          STORAGE_KEYS.ADAPTIVE_FEEDBACK,
          JSON.stringify(data.adaptiveFeedback)
        );
      }
      if (data.sessionExecutionLog) {
        setSessionExecutionLog(data.sessionExecutionLog);
        await AsyncStorage.setItem(
          STORAGE_KEYS.SESSION_EXECUTION_LOG,
          JSON.stringify(data.sessionExecutionLog)
        );
      }
      if (data.sessionFavorites) {
        setSessionFavorites(data.sessionFavorites);
        await AsyncStorage.setItem(
          STORAGE_KEYS.SESSION_FAVORITES,
          JSON.stringify(data.sessionFavorites)
        );
      }
      if (data.exportHistory) {
        setExportHistory(data.exportHistory);
        await AsyncStorage.setItem(STORAGE_KEYS.EXPORT_HISTORY, JSON.stringify(data.exportHistory));
      }
    },
    []
  );

  return {
    // State
    completedSessions,
    adaptiveFeedback,
    sessionExecutionLog,
    sessionChaosMap,
    sessionFavorites,
    exportHistory,
    isLoading,

    // Session completion
    markSessionCompleted,
    isSessionCompleted,
    getCompletedCount,

    // Adaptive feedback
    setSessionFeedback,
    getSessionFeedback,

    // Session execution
    logSessionExecution,

    // Chaos
    setSessionChaos,

    // Favorites
    addSessionFavorite,
    removeSessionFavorite,

    // Export history
    addExportHistoryEntry,
    clearExportHistory,

    // Backup
    exportBackupData,
    importBackupData,
  };
}

export type PersistenceHook = ReturnType<typeof usePersistence>;
