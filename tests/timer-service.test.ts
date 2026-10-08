import test from "node:test";
import assert from "node:assert/strict";
import { TimerService, type TimerStorage } from "../src/services/timer-service.ts";
import type { Timer } from "../src/domain/timer.ts";

class InMemoryTimerStorage implements TimerStorage {
  private timers: Timer[] = [];

  async getTimers(): Promise<Timer[]> {
    return [...this.timers];
  }

  async saveTimers(timers: Timer[]): Promise<void> {
    this.timers = [...timers];
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

  const list = await service.listTimers();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, t1.id);
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
  const list = await service.listTimers();
  assert.equal(list.length, 0);
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
  const list = await service.listTimers();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, timer.id);
  assert.equal(list[0].status, "completed");
  assert.equal(list[0].remainingSeconds, 0);
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

  const remainingList = await service.listTimers();
  assert.equal(remainingList.length, 1);
  assert.equal(remainingList[0].title, "Т2");
});
