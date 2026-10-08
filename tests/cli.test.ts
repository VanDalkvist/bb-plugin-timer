import test from "node:test";
import assert from "node:assert/strict";
import { TimerService, type TimerStorage } from "../src/services/timer-service.ts";
import type { Timer } from "../src/domain/timer.ts";
import { formatTime } from "../src/domain/timer.ts";

class MockStorage implements TimerStorage {
  private timers: Timer[] = [];
  async getTimers(): Promise<Timer[]> {
    return [...this.timers];
  }
  async saveTimers(timers: Timer[]): Promise<void> {
    this.timers = [...timers];
  }
}

test("CLI flow: add, list, pause, reset, remove", async () => {
  let currentTime = 1000000;
  const storage = new MockStorage();
  const service = new TimerService(storage, undefined, () => currentTime);

  // 1. Add timer via service (as CLI `bb timer add 15 "Фокус"`)
  const t = await service.addTimer({
    title: "Фокус",
    durationMinutes: 15,
    startImmediately: true,
  });
  assert.equal(t.status, "running");
  assert.equal(t.remainingSeconds, 900);

  // 2. List
  const list1 = await service.listTimers();
  assert.equal(list1.length, 1);
  assert.equal(list1[0].id, t.id);

  // 3. Pause
  const paused = await service.pauseTimer(t.id);
  assert.equal(paused?.status, "paused");

  // 4. Reset
  const reset = await service.resetTimer(t.id);
  assert.equal(reset?.status, "idle");
  assert.equal(reset?.remainingSeconds, 900);

  // 5. Remove
  const removed = await service.removeTimer(t.id);
  assert.equal(removed, true);
  const list2 = await service.listTimers();
  assert.equal(list2.length, 0);
});
