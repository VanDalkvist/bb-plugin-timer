export type TimerStatus = "idle" | "running" | "paused" | "completed";

export interface Timer {
  id: string;
  title: string;
  totalDurationSeconds: number;
  remainingSeconds: number;
  status: TimerStatus;
  startedAt: number | null;
  targetEndAt: number | null;
  createdAt: number;
}

export interface CreateTimerInput {
  title: string;
  durationMinutes: number;
  startImmediately?: boolean;
}

export function createTimer(
  id: string,
  input: CreateTimerInput,
  nowMs = Date.now(),
): Timer {
  const durationMinutes = Math.max(0.1, Number(input.durationMinutes) || 1);
  const totalDurationSeconds = Math.round(durationMinutes * 60);
  const title = input.title.trim() || `Таймер ${durationMinutes}м`;
  const startImmediately = Boolean(input.startImmediately);

  if (startImmediately) {
    return {
      id,
      title,
      totalDurationSeconds,
      remainingSeconds: totalDurationSeconds,
      status: "running",
      startedAt: nowMs,
      targetEndAt: nowMs + totalDurationSeconds * 1000,
      createdAt: nowMs,
    };
  }

  return {
    id,
    title,
    totalDurationSeconds,
    remainingSeconds: totalDurationSeconds,
    status: "idle",
    startedAt: null,
    targetEndAt: null,
    createdAt: nowMs,
  };
}

export function computeRemainingSeconds(timer: Timer, nowMs = Date.now()): number {
  if (timer.status === "idle") {
    return timer.remainingSeconds;
  }
  if (timer.status === "paused") {
    return timer.remainingSeconds;
  }
  if (timer.status === "completed") {
    return 0;
  }
  if (timer.status === "running") {
    if (!timer.targetEndAt) {
      return timer.remainingSeconds;
    }
    const diff = timer.targetEndAt - nowMs;
    if (diff <= 0) {
      return 0;
    }
    return Math.ceil(diff / 1000);
  }
  return timer.remainingSeconds;
}

export function reconcileTimerState(timer: Timer, nowMs = Date.now()): Timer {
  if (timer.status !== "running") {
    return timer;
  }
  const remaining = computeRemainingSeconds(timer, nowMs);
  if (remaining <= 0) {
    return {
      ...timer,
      remainingSeconds: 0,
      status: "completed",
      targetEndAt: null,
    };
  }
  return {
    ...timer,
    remainingSeconds: remaining,
  };
}

export function startTimer(timer: Timer, nowMs = Date.now()): Timer {
  if (timer.status === "running") {
    return timer;
  }
  const remaining =
    timer.status === "completed" || timer.remainingSeconds <= 0
      ? timer.totalDurationSeconds
      : timer.remainingSeconds;

  return {
    ...timer,
    remainingSeconds: remaining,
    status: "running",
    startedAt: nowMs,
    targetEndAt: nowMs + remaining * 1000,
  };
}

export function pauseTimer(timer: Timer, nowMs = Date.now()): Timer {
  if (timer.status !== "running") {
    return timer;
  }
  const remaining = computeRemainingSeconds(timer, nowMs);
  if (remaining <= 0) {
    return {
      ...timer,
      remainingSeconds: 0,
      status: "completed",
      targetEndAt: null,
    };
  }
  return {
    ...timer,
    remainingSeconds: remaining,
    status: "paused",
    targetEndAt: null,
  };
}

export function resetTimer(timer: Timer): Timer {
  return {
    ...timer,
    status: "idle",
    remainingSeconds: timer.totalDurationSeconds,
    startedAt: null,
    targetEndAt: null,
  };
}

export function addExtraTime(
  timer: Timer,
  extraSeconds: number,
  nowMs = Date.now(),
): Timer {
  const safeExtra = Math.max(1, Math.round(extraSeconds));
  const newTotal = timer.totalDurationSeconds + safeExtra;

  if (timer.status === "running" && timer.targetEndAt) {
    const newTarget = timer.targetEndAt + safeExtra * 1000;
    const newRemaining = Math.max(0, Math.ceil((newTarget - nowMs) / 1000));
    return {
      ...timer,
      totalDurationSeconds: newTotal,
      targetEndAt: newTarget,
      remainingSeconds: newRemaining,
    };
  }

  if (timer.status === "completed") {
    return {
      ...timer,
      totalDurationSeconds: newTotal,
      status: "paused",
      remainingSeconds: safeExtra,
      targetEndAt: null,
    };
  }

  return {
    ...timer,
    totalDurationSeconds: newTotal,
    remainingSeconds: timer.remainingSeconds + safeExtra,
  };
}

export function renameTimer(timer: Timer, title: string): Timer {
  const cleanTitle = title.trim();
  if (!cleanTitle) return timer;
  return {
    ...timer,
    title: cleanTitle,
  };
}

export function formatTime(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;

  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  if (hrs > 0) {
    const hh = String(hrs).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function calculateProgressPercent(
  timer: Timer,
  nowMs = Date.now(),
): number {
  if (timer.totalDurationSeconds <= 0) return 100;
  const remaining = computeRemainingSeconds(timer, nowMs);
  const elapsed = timer.totalDurationSeconds - remaining;
  const percent = (elapsed / timer.totalDurationSeconds) * 100;
  return Math.min(100, Math.max(0, Math.round(percent * 10) / 10));
}

// Sequential Execution Helpers
export function findNextPendingTimerIndex(timers: Timer[]): number {
  return timers.findIndex(
    (t) => t.status === "idle" || t.status === "paused",
  );
}

export interface SequentialReconciliationResult {
  timers: Timer[];
  isSequenceActive: boolean;
  nextStartedTimer: Timer | null;
}

export function reconcileSequentialTimers(
  timers: Timer[],
  isSequenceActive: boolean,
  nowMs = Date.now(),
): SequentialReconciliationResult {
  if (timers.length === 0) {
    return { timers: [], isSequenceActive: false, nextStartedTimer: null };
  }

  let runningTimerCompleted = false;

  // Reconcile each timer
  const reconciled = timers.map((timer) => {
    if (timer.status !== "running") return timer;
    const updated = reconcileTimerState(timer, nowMs);
    if (updated.status === "completed" && timer.status === "running") {
      runningTimerCompleted = true;
    }
    return updated;
  });

  if (!isSequenceActive) {
    return {
      timers: reconciled,
      isSequenceActive: false,
      nextStartedTimer: null,
    };
  }

  // Check if any timer is still running
  const currentlyRunning = reconciled.find((t) => t.status === "running");
  if (currentlyRunning) {
    return {
      timers: reconciled,
      isSequenceActive: true,
      nextStartedTimer: null,
    };
  }

  // If no timer is running and sequence is active:
  // Find next pending timer in list
  const nextPendingIdx = findNextPendingTimerIndex(reconciled);
  if (nextPendingIdx !== -1) {
    const nextTimer = startTimer(reconciled[nextPendingIdx]!, nowMs);
    const updatedList = [...reconciled];
    updatedList[nextPendingIdx] = nextTimer;
    return {
      timers: updatedList,
      isSequenceActive: true,
      nextStartedTimer: nextTimer,
    };
  }

  // No pending timers left in sequence
  return {
    timers: reconciled,
    isSequenceActive: false,
    nextStartedTimer: null,
  };
}
