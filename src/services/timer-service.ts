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
  reconcileSequentialTimers,
  findNextPendingTimerIndex,
} from "../domain/timer.ts";

export interface TimerStorage {
  getTimers(): Promise<Timer[]>;
  saveTimers(timers: Timer[]): Promise<void>;
  getSequenceActive?(): Promise<boolean>;
  setSequenceActive?(active: boolean): Promise<void>;
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

  async listTimers(): Promise<{ timers: Timer[]; isSequenceActive: boolean }> {
    const rawTimers = await this.storage.getTimers();
    const seqActive = (await this.storage.getSequenceActive?.()) ?? false;
    const now = this.nowProvider();

    const result = reconcileSequentialTimers(rawTimers, seqActive, now);
    let hasChanges = false;

    if (result.isSequenceActive !== seqActive) {
      hasChanges = true;
      await this.storage.setSequenceActive?.(result.isSequenceActive);
    }

    for (let i = 0; i < rawTimers.length; i++) {
      const orig = rawTimers[i]!;
      const rec = result.timers[i]!;
      if (
        orig.status !== rec.status ||
        orig.remainingSeconds !== rec.remainingSeconds ||
        orig.targetEndAt !== rec.targetEndAt
      ) {
        hasChanges = true;
        break;
      }
    }

    if (hasChanges) {
      await this.storage.saveTimers(result.timers);
      this.onTimersChanged?.(result.timers);
    }

    return { timers: result.timers, isSequenceActive: result.isSequenceActive };
  }

  async addTimer(input: CreateTimerInput): Promise<Timer> {
    const id = randomUUID().slice(0, 8);
    const now = this.nowProvider();
    const newTimer = createTimer(id, input, now);

    const existing = await this.storage.getTimers();
    // Append to list so sequential order is natural (top to bottom)
    const updated = [...existing, newTimer];
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

  async resetAllTimers(): Promise<Timer[]> {
    const existing = await this.storage.getTimers();
    const reset = existing.map((t) => resetTimer(t));

    await this.storage.saveTimers(reset);
    await this.storage.setSequenceActive?.(false);
    this.onTimersChanged?.(reset);
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

  async startSequence(): Promise<{ timers: Timer[]; isSequenceActive: boolean }> {
    let existing = await this.storage.getTimers();
    const now = this.nowProvider();

    if (existing.length === 0) {
      return { timers: [], isSequenceActive: false };
    }

    // If all timers were completed, reset them all
    const allCompleted = existing.every((t) => t.status === "completed");
    if (allCompleted) {
      existing = existing.map((t) => resetTimer(t));
    }

    // Check if any timer is running already
    const running = existing.find((t) => t.status === "running");
    let updated = existing;

    if (!running) {
      const nextIdx = findNextPendingTimerIndex(existing);
      if (nextIdx !== -1) {
        const started = startTimer(existing[nextIdx]!, now);
        updated = [...existing];
        updated[nextIdx] = started;
      }
    }

    await this.storage.saveTimers(updated);
    await this.storage.setSequenceActive?.(true);
    this.onTimersChanged?.(updated);
    return { timers: updated, isSequenceActive: true };
  }

  async stopSequence(): Promise<{ timers: Timer[]; isSequenceActive: boolean }> {
    const existing = await this.storage.getTimers();
    await this.storage.setSequenceActive?.(false);
    this.onTimersChanged?.(existing);
    return { timers: existing, isSequenceActive: false };
  }
}
