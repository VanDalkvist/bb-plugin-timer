import { randomUUID } from "node:crypto";
import {
  type Timer,
  type CreateTimerInput,
  createTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  addExtraTime,
  renameTimer,
  reconcileTimerState,
} from "../domain/timer.ts";

export interface TimerStorage {
  getTimers(): Promise<Timer[]>;
  saveTimers(timers: Timer[]): Promise<void>;
}

export class TimerService {
  private readonly storage: TimerStorage;
  private readonly onTimersChanged?: (timers: Timer[]) => void;
  private readonly nowProvider: () => number;

  constructor(
    storage: TimerStorage,
    onTimersChanged?: (timers: Timer[]) => void,
    nowProvider: () => number = () => Date.now(),
  ) {
    this.storage = storage;
    this.onTimersChanged = onTimersChanged;
    this.nowProvider = nowProvider;
  }

  async listTimers(): Promise<Timer[]> {
    const rawTimers = await this.storage.getTimers();
    const now = this.nowProvider();
    let hasChanges = false;

    const reconciled = rawTimers.map((t) => {
      const updated = reconcileTimerState(t, now);
      if (updated.status !== t.status || updated.remainingSeconds !== t.remainingSeconds) {
        hasChanges = true;
      }
      return updated;
    });

    if (hasChanges) {
      await this.storage.saveTimers(reconciled);
      this.onTimersChanged?.(reconciled);
    }

    return reconciled;
  }

  async addTimer(input: CreateTimerInput): Promise<Timer> {
    const id = randomUUID().slice(0, 8);
    const now = this.nowProvider();
    const newTimer = createTimer(id, input, now);

    const existing = await this.storage.getTimers();
    const updated = [newTimer, ...existing];
    await this.storage.saveTimers(updated);
    this.onTimersChanged?.(updated);
    return newTimer;
  }

  async startTimer(id: string): Promise<Timer | null> {
    const existing = await this.storage.getTimers();
    const target = existing.find((t) => t.id === id);
    if (!target) return null;

    const now = this.nowProvider();
    const started = startTimer(target, now);
    const updated = existing.map((t) => (t.id === id ? started : t));

    await this.storage.saveTimers(updated);
    this.onTimersChanged?.(updated);
    return started;
  }

  async pauseTimer(id: string): Promise<Timer | null> {
    const existing = await this.storage.getTimers();
    const target = existing.find((t) => t.id === id);
    if (!target) return null;

    const now = this.nowProvider();
    const paused = pauseTimer(target, now);
    const updated = existing.map((t) => (t.id === id ? paused : t));

    await this.storage.saveTimers(updated);
    this.onTimersChanged?.(updated);
    return paused;
  }

  async resetTimer(id: string): Promise<Timer | null> {
    const existing = await this.storage.getTimers();
    const target = existing.find((t) => t.id === id);
    if (!target) return null;

    const reset = resetTimer(target);
    const updated = existing.map((t) => (t.id === id ? reset : t));

    await this.storage.saveTimers(updated);
    this.onTimersChanged?.(updated);
    return reset;
  }

  async addExtraTime(id: string, extraSeconds: number): Promise<Timer | null> {
    const existing = await this.storage.getTimers();
    const target = existing.find((t) => t.id === id);
    if (!target) return null;

    const now = this.nowProvider();
    const extended = addExtraTime(target, extraSeconds, now);
    const updated = existing.map((t) => (t.id === id ? extended : t));

    await this.storage.saveTimers(updated);
    this.onTimersChanged?.(updated);
    return extended;
  }

  async renameTimer(id: string, title: string): Promise<Timer | null> {
    const existing = await this.storage.getTimers();
    const target = existing.find((t) => t.id === id);
    if (!target) return null;

    const renamed = renameTimer(target, title);
    const updated = existing.map((t) => (t.id === id ? renamed : t));

    await this.storage.saveTimers(updated);
    this.onTimersChanged?.(updated);
    return renamed;
  }

  async removeTimer(id: string): Promise<boolean> {
    const existing = await this.storage.getTimers();
    const filtered = existing.filter((t) => t.id !== id);
    if (filtered.length === existing.length) return false;

    await this.storage.saveTimers(filtered);
    this.onTimersChanged?.(filtered);
    return true;
  }

  async clearCompleted(): Promise<number> {
    const existing = await this.storage.getTimers();
    const active = existing.filter((t) => t.status !== "completed");
    const clearedCount = existing.length - active.length;
    if (clearedCount > 0) {
      await this.storage.saveTimers(active);
      this.onTimersChanged?.(active);
    }
    return clearedCount;
  }

  async startAllTimers(): Promise<Timer[]> {
    const existing = await this.storage.getTimers();
    const now = this.nowProvider();
    const updated = existing.map((t) => {
      if (t.status === "idle" || t.status === "paused") {
        return startTimer(t, now);
      }
      return t;
    });
    await this.storage.saveTimers(updated);
    this.onTimersChanged?.(updated);
    return updated;
  }

  async addBatchTimers(
    batch: Array<{ title: string; durationMinutes: number }>,
    startImmediately = false,
  ): Promise<Timer[]> {
    const now = this.nowProvider();
    const newTimers: Timer[] = batch.map((item) => {
      const id = randomUUID().slice(0, 8);
      return createTimer(id, { ...item, startImmediately }, now);
    });

    const existing = await this.storage.getTimers();
    const updated = [...newTimers, ...existing];
    await this.storage.saveTimers(updated);
    this.onTimersChanged?.(updated);
    return newTimers;
  }
}
