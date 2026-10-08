import test from "node:test";
import assert from "node:assert/strict";
import { TimerService, type TimerStorage } from "../src/services/timer-service.ts";
import type { Timer } from "../src/domain/timer.ts";

class InMemoryTimerStorage implements TimerStorage {
  private timers: Timer[] = [];
  private sequenceActive = false;

  async getTimers(): Promise<Timer[]> {
    return [...this.timers];
  }

  async saveTimers(timers: Timer[]): Promise<void> {
    this.timers = [...timers];
  }

  async getSequenceActive(): Promise<boolean> {
    return this.sequenceActive;
  }

  async setSequenceActive(active: boolean): Promise<void> {
    this.sequenceActive = active;
  }
}

test("TimerService adds and lists timers", async () => {
  let currentTime = 1000000;
  let changeBroadcastCount = 0;
  const storage = new InMemoryTimerStorage();
  const service = new TimerService(
    storage,
    () => {
      changeBroadcastCount++;
    },
    () => currentTime,
  );

  const t1 = await service.addTimer({
    title: "Тест 1",
    durationMinutes: 10,
    startImmediately: false,
  });

  assert.equal(t1.title, "Тест 1");
  assert.equal(t1.status, "idle");
  assert.equal(changeBroadcastCount, 1);

  const res = await service.listTimers();
  assert.equal(res.timers.length, 1);
  assert.equal(res.timers[0].id, t1.id);
});

test("TimerService controls timer lifecycle (start, pause, reset, remove)", async () => {
  let currentTime = 1000000;
  const storage = new InMemoryTimerStorage();
  const service = new TimerService(
    storage,
    undefined,
    () => currentTime,
  );

  const timer = await service.addTimer({
    title: "Помидор",
    durationMinutes: 25,
    startImmediately: false,
  });

  // Start
  const started = await service.startTimer(timer.id);
  assert.equal(started?.status, "running");
  assert.equal(started?.targetEndAt, currentTime + 1500 * 1000);

  // Advance 300s (5m) and pause
  currentTime += 300000;
  const paused = await service.pauseTimer(timer.id);
  assert.equal(paused?.status, "paused");
  assert.equal(paused?.remainingSeconds, 1200);

  // Reset
  const reset = await service.resetTimer(timer.id);
  assert.equal(reset?.status, "idle");
  assert.equal(reset?.remainingSeconds, 1500);

  // Remove
  const removed = await service.removeTimer(timer.id);
  assert.equal(removed, true);
  const res = await service.listTimers();
  assert.equal(res.timers.length, 0);
});

test("TimerService reconciles expired timers on list", async () => {
  let currentTime = 1000000;
  const storage = new InMemoryTimerStorage();
  const service = new TimerService(
    storage,
    undefined,
    () => currentTime,
  );

  const timer = await service.addTimer({
    title: "Короткий",
    durationMinutes: 1,
    startImmediately: true,
  });

  // Advance past expiry
  currentTime += 70000;
  const res = await service.listTimers();
  assert.equal(res.timers.length, 1);
  assert.equal(res.timers[0].id, timer.id);
  assert.equal(res.timers[0].status, "completed");
  assert.equal(res.timers[0].remainingSeconds, 0);
});

test("TimerService clearCompleted removes finished timers", async () => {
  let currentTime = 1000000;
  const storage = new InMemoryTimerStorage();
  const service = new TimerService(
    storage,
    undefined,
    () => currentTime,
  );

  await service.addTimer({
    title: "Т1",
    durationMinutes: 1,
    startImmediately: true,
  });
  await service.addTimer({
    title: "Т2",
    durationMinutes: 10,
    startImmediately: false,
  });

  // Fast forward past T1
  currentTime += 65000;
  await service.listTimers(); // reconciles T1 to completed

  const cleared = await service.clearCompleted();
  assert.equal(cleared, 1);

  const res = await service.listTimers();
  assert.equal(res.timers.length, 1);
  assert.equal(res.timers[0].title, "Т2");
});

test("TimerService startSequence and automatic progression", async () => {
  let currentTime = 1000000;
  const storage = new InMemoryTimerStorage();
  const service = new TimerService(
    storage,
    undefined,
    () => currentTime,
  );

  const t1 = await service.addTimer({ title: "Шаг 1", durationMinutes: 1, startImmediately: false });
  const t2 = await service.addTimer({ title: "Шаг 2", durationMinutes: 1, startImmediately: false });

  // Start sequence: t1 becomes running
  const seqRes = await service.startSequence();
  assert.equal(seqRes.isSequenceActive, true);
  assert.equal(seqRes.timers[0].status, "running");
  assert.equal(seqRes.timers[1].status, "idle");

  // Advance 65s: t1 finishes, t2 automatically starts
  currentTime += 65000;
  const res2 = await service.listTimers();
  assert.equal(res2.isSequenceActive, true);
  assert.equal(res2.timers[0].status, "completed");
  assert.equal(res2.timers[1].status, "running");

  // Advance 65s: t2 finishes, sequence completes
  currentTime += 65000;
  const res3 = await service.listTimers();
  assert.equal(res3.isSequenceActive, false);
  assert.equal(res3.timers[1].status, "completed");
});
