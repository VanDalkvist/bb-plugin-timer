import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../../server.ts";
import {
  type Timer,
  computeRemainingSeconds,
  formatTime,
  calculateProgressPercent,
} from "../domain/timer.ts";
import { playTimerCompletionChime } from "../lib/sound.ts";

export interface UseTimersOptions {
  soundEnabled?: boolean;
}

export function useTimers(options: UseTimersOptions = {}) {
  const { soundEnabled = true } = options;
  const rpc = useRpc<typeof rpcContract>();
  const [timers, setTimers] = useState<Timer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep track of which timers we already sounded an alert for
  const completedAlertedRef = useRef<Set<string>>(new Set());

  const report = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  const fetchTimers = useCallback(() => {
    rpc
      .call("timers_list")
      .then((res) => {
        setTimers(res.timers);
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

  // Local tick interval for smooth second countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((currentTimers) => {
        const now = Date.now();
        let changed = false;
        let newlyCompleted = false;

        const updated = currentTimers.map((timer) => {
          if (timer.status !== "running") return timer;

          const rem = computeRemainingSeconds(timer, now);
          if (rem <= 0) {
            changed = true;
            if (!completedAlertedRef.current.has(timer.id)) {
              completedAlertedRef.current.add(timer.id);
              newlyCompleted = true;
            }
            return {
              ...timer,
              remainingSeconds: 0,
              status: "completed" as const,
              targetEndAt: null,
            };
          }

          if (rem !== timer.remainingSeconds) {
            changed = true;
            return {
              ...timer,
              remainingSeconds: rem,
            };
          }

          return timer;
        });

        if (newlyCompleted && soundEnabled) {
          playTimerCompletionChime();
        }

        return changed ? updated : currentTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [soundEnabled]);

  const addTimer = useCallback(
    async (title: string, durationMinutes: number, startImmediately = true) => {
      try {
        const newTimer = await rpc.call("timers_add", {
          title,
          durationMinutes,
          startImmediately,
        });
        setTimers((prev) => [newTimer, ...prev]);
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

  const startAll = useCallback(async () => {
    try {
      const res = await rpc.call("timers_start_all");
      setTimers(res.timers);
    } catch (err) {
      report(err);
    }
  }, [rpc, report]);

  const addBatch = useCallback(
    async (batch: Array<{ title: string; durationMinutes: number }>, startImmediately = false) => {
      try {
        await rpc.call("timers_add_batch", { timers: batch, startImmediately });
        fetchTimers();
      } catch (err) {
        report(err);
      }
    },
    [rpc, report, fetchTimers],
  );

  const activeRunningCount = timers.filter((t) => t.status === "running").length;
  const completedCount = timers.filter((t) => t.status === "completed").length;

  // Find the running timer with the least remaining seconds
  const earliestRunning = timers
    .filter((t) => t.status === "running")
    .sort((a, b) => a.remainingSeconds - b.remainingSeconds)[0] ?? null;

  return {
    timers,
    isLoading,
    error,
    activeRunningCount,
    completedCount,
    earliestRunning,
    addTimer,
    start,
    startAll,
    addBatch,
    pause,
    reset,
    addTime,
    rename,
    remove,
    clearCompleted,
    refetch: fetchTimers,
  };
}
