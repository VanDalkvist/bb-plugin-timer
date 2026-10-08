import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../../server.ts";
import {
  type Timer,
  reconcileSequentialTimers,
  formatTime,
} from "../domain/timer.ts";
import { playTimerCompletionChime } from "../lib/sound.ts";

export interface UseTimersOptions {
  soundEnabled?: boolean;
}

export function useTimers(options: UseTimersOptions = {}) {
  const { soundEnabled = true } = options;
  const rpc = useRpc<typeof rpcContract>();
  const [timers, setTimers] = useState<Timer[]>([]);
  const [isSequenceActive, setIsSequenceActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep track of which timers we already sounded an alert for
  const completedAlertedRef = useRef<Set<string>>(new Set());
  const isSequenceActiveRef = useRef(false);

  const report = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  const fetchTimers = useCallback(() => {
    rpc
      .call("timers_list")
      .then((res) => {
        setTimers(res.timers);
        setIsSequenceActive(res.isSequenceActive);
        isSequenceActiveRef.current = res.isSequenceActive;
        setIsLoading(false);
        setError(null);
      })
      .catch((err) => {
        report(err);
        setIsLoading(false);
      });
  }, [rpc, report]);

  useEffect(() => {
    fetchTimers();
  }, [fetchTimers]);

  // Realtime subscription
  useRealtime("timers-changed", fetchTimers);

  // Local tick interval for smooth second countdowns and sequential transitions
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((currentTimers) => {
        const now = Date.now();
        const prevSeq = isSequenceActiveRef.current;

        const result = reconcileSequentialTimers(currentTimers, prevSeq, now);

        // Check if any timer newly completed
        for (const timer of result.timers) {
          if (timer.status === "completed" && !completedAlertedRef.current.has(timer.id)) {
            completedAlertedRef.current.add(timer.id);
            if (soundEnabled) {
              playTimerCompletionChime();
            }
          }
        }

        // Check if sequence state changed
        if (result.isSequenceActive !== prevSeq) {
          isSequenceActiveRef.current = result.isSequenceActive;
          setIsSequenceActive(result.isSequenceActive);
        }

        // If next timer started in sequence, sync with server
        if (result.nextStartedTimer) {
          if (soundEnabled) {
            playTimerCompletionChime();
          }
          // Server reconciliation via rpc
          rpc.call("timers_list").catch(() => {});
        }

        return result.timers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [soundEnabled, rpc]);

  const addTimer = useCallback(
    async (title: string, durationMinutes: number, startImmediately = true) => {
      try {
        const newTimer = await rpc.call("timers_add", {
          title,
          durationMinutes,
          startImmediately,
        });
        setTimers((prev) => [...prev, newTimer]);
        return newTimer;
      } catch (err) {
        report(err);
        return null;
      }
    },
    [rpc, report],
  );

  const start = useCallback(
    async (id: string) => {
      completedAlertedRef.current.delete(id);
      try {
        const updated = await rpc.call("timers_start", { id });
        if (updated) {
          setTimers((prev) => prev.map((t) => (t.id === id ? updated : t)));
        }
      } catch (err) {
        report(err);
      }
    },
    [rpc, report],
  );

  const pause = useCallback(
    async (id: string) => {
      try {
        const updated = await rpc.call("timers_pause", { id });
        if (updated) {
          setTimers((prev) => prev.map((t) => (t.id === id ? updated : t)));
        }
      } catch (err) {
        report(err);
      }
    },
    [rpc, report],
  );

  const reset = useCallback(
    async (id: string) => {
      completedAlertedRef.current.delete(id);
      try {
        const updated = await rpc.call("timers_reset", { id });
        if (updated) {
          setTimers((prev) => prev.map((t) => (t.id === id ? updated : t)));
        }
      } catch (err) {
        report(err);
      }
    },
    [rpc, report],
  );

  const addTime = useCallback(
    async (id: string, extraSeconds: number) => {
      completedAlertedRef.current.delete(id);
      try {
        const updated = await rpc.call("timers_add_time", { id, extraSeconds });
        if (updated) {
          setTimers((prev) => prev.map((t) => (t.id === id ? updated : t)));
        }
      } catch (err) {
        report(err);
      }
    },
    [rpc, report],
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      try {
        const updated = await rpc.call("timers_rename", { id, title });
        if (updated) {
          setTimers((prev) => prev.map((t) => (t.id === id ? updated : t)));
        }
      } catch (err) {
        report(err);
      }
    },
    [rpc, report],
  );

  const remove = useCallback(
    async (id: string) => {
      completedAlertedRef.current.delete(id);
      try {
        await rpc.call("timers_remove", { id });
        setTimers((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        report(err);
      }
    },
    [rpc, report],
  );

  const clearCompleted = useCallback(async () => {
    try {
      await rpc.call("timers_clear_completed");
      setTimers((prev) => prev.filter((t) => t.status !== "completed"));
    } catch (err) {
      report(err);
    }
  }, [rpc, report]);

  const startSequence = useCallback(async () => {
    try {
      const res = await rpc.call("timers_start_sequence");
      setIsSequenceActive(res.isSequenceActive);
      isSequenceActiveRef.current = res.isSequenceActive;
      fetchTimers();
    } catch (err) {
      report(err);
    }
  }, [rpc, fetchTimers, report]);

  const stopSequence = useCallback(async () => {
    try {
      const res = await rpc.call("timers_stop_sequence");
      setIsSequenceActive(res.isSequenceActive);
      isSequenceActiveRef.current = res.isSequenceActive;
      fetchTimers();
    } catch (err) {
      report(err);
    }
  }, [rpc, fetchTimers, report]);

  const resetAll = useCallback(async () => {
    completedAlertedRef.current.clear();
    try {
      await rpc.call("timers_reset_all");
      setIsSequenceActive(false);
      isSequenceActiveRef.current = false;
      fetchTimers();
    } catch (err) {
      report(err);
    }
  }, [rpc, fetchTimers, report]);

  const activeRunningCount = timers.filter((t) => t.status === "running").length;
  const completedCount = timers.filter((t) => t.status === "completed").length;

  // The currently running timer or earliest ending timer
  const currentRunningTimer = timers.find((t) => t.status === "running") ?? null;
  const earliestRunning =
    currentRunningTimer ??
    timers
      .filter((t) => t.status === "running")
      .sort((a, b) => a.remainingSeconds - b.remainingSeconds)[0] ??
    null;

  return {
    timers,
    isSequenceActive,
    isLoading,
    error,
    activeRunningCount,
    completedCount,
    earliestRunning,
    addTimer,
    start,
    pause,
    reset,
    addTime,
    rename,
    remove,
    clearCompleted,
    startSequence,
    stopSequence,
    resetAll,
    refetch: fetchTimers,
  };
}
