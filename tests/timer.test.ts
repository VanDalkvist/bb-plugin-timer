import test from "node:test";
import assert from "node:assert/strict";
import {
  createTimer,
  computeRemainingSeconds,
  reconcileTimerState,
  startTimer,
  pauseTimer,
  resetTimer,
  addExtraTime,
  renameTimer,
  formatTime,
  calculateProgressPercent,
  reconcileSequentialTimers,
  findNextPendingTimerIndex,
} from "../src/domain/timer.ts";

test("createTimer creates idle timer by default", () => {
  const now = 1000000;
  const timer = createTimer("t1", { title: "Фокус", durationMinutes: 25 }, now);

  assert.equal(timer.id, "t1");
  assert.equal(timer.title, "Фокус");
  assert.equal(timer.totalDurationSeconds, 1500);
  assert.equal(timer.remainingSeconds, 1500);
  assert.equal(timer.status, "idle");
  assert.equal(timer.targetEndAt, null);
});

test("createTimer creates running timer when startImmediately is true", () => {
  const now = 1000000;
  const timer = createTimer(
    "t2",
    { title: "Чай", durationMinutes: 5, startImmediately: true },
    now,
  );

  assert.equal(timer.status, "running");
  assert.equal(timer.totalDurationSeconds, 300);
  assert.equal(timer.targetEndAt, now + 300 * 1000);
});

test("computeRemainingSeconds accurately computes time left while running", () => {
  const now = 1000000;
  const timer = createTimer(
    "t3",
    { title: "Тест", durationMinutes: 1, startImmediately: true },
    now,
  );

  // After 20 seconds
  const remaining = computeRemainingSeconds(timer, now + 20000);
  assert.equal(remaining, 40);

  // After 60 seconds (finished)
  const remainingZero = computeRemainingSeconds(timer, now + 60000);
  assert.equal(remainingZero, 0);

  // After 70 seconds (overtime)
  const remainingNegative = computeRemainingSeconds(timer, now + 70000);
  assert.equal(remainingNegative, 0);
});

test("reconcileTimerState marks expired timer as completed", () => {
  const now = 1000000;
  const timer = createTimer(
    "t4",
    { title: "Тест", durationMinutes: 1, startImmediately: true },
    now,
  );

  const reconciledBefore = reconcileTimerState(timer, now + 30000);
  assert.equal(reconciledBefore.status, "running");
  assert.equal(reconciledBefore.remainingSeconds, 30);

  const reconciledAfter = reconcileTimerState(timer, now + 65000);
  assert.equal(reconciledAfter.status, "completed");
  assert.equal(reconciledAfter.remainingSeconds, 0);
  assert.equal(reconciledAfter.targetEndAt, null);
});

test("pause and resume transitions", () => {
  const now = 1000000;
  let timer = createTimer(
    "t5",
    { title: "Помидор", durationMinutes: 10, startImmediately: true },
    now,
  );

  // 1 minute passes, then pause
  timer = pauseTimer(timer, now + 60000);
  assert.equal(timer.status, "paused");
  assert.equal(timer.remainingSeconds, 540);
  assert.equal(timer.targetEndAt, null);

  // Resume after a delay of 50000ms
  const resumeTime = now + 110000;
  timer = startTimer(timer, resumeTime);
  assert.equal(timer.status, "running");
  assert.equal(timer.targetEndAt, resumeTime + 540 * 1000);

  // Another minute passes
  const remaining = computeRemainingSeconds(timer, resumeTime + 60000);
  assert.equal(remaining, 480);
});

test("resetTimer resets to initial total duration", () => {
  const now = 1000000;
  let timer = createTimer(
    "t6",
    { title: "Тест", durationMinutes: 5, startImmediately: true },
    now,
  );
  timer = pauseTimer(timer, now + 100000);
  timer = resetTimer(timer);

  assert.equal(timer.status, "idle");
  assert.equal(timer.remainingSeconds, 300);
  assert.equal(timer.targetEndAt, null);
});

test("addExtraTime extends running or paused timers", () => {
  const now = 1000000;
  let timer = createTimer(
    "t7",
    { title: "Тест", durationMinutes: 5, startImmediately: true },
    now,
  );

  // Add 60s while running
  timer = addExtraTime(timer, 60, now);
  assert.equal(timer.totalDurationSeconds, 360);
  assert.equal(computeRemainingSeconds(timer, now), 360);

  // Add 120s while paused
  timer = pauseTimer(timer, now + 10000);
  timer = addExtraTime(timer, 120, now + 10000);
  assert.equal(timer.totalDurationSeconds, 480);
  assert.equal(timer.remainingSeconds, 470);
});

test("renameTimer updates title", () => {
  let timer = createTimer("t8", { title: "Старое", durationMinutes: 5 });
  timer = renameTimer(timer, "Новое имя");
  assert.equal(timer.title, "Новое имя");

  timer = renameTimer(timer, "   "); // Empty should be ignored
  assert.equal(timer.title, "Новое имя");
});

test("formatTime formats MM:SS and HH:MM:SS", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(5), "00:05");
  assert.equal(formatTime(65), "01:05");
  assert.equal(formatTime(1500), "25:00");
  assert.equal(formatTime(3600), "01:00:00");
  assert.equal(formatTime(3665), "01:01:05");
});

test("calculateProgressPercent computes percentage of elapsed time", () => {
  const now = 1000000;
  const timer = createTimer(
    "t9",
    { title: "Тест", durationMinutes: 10, startImmediately: true },
    now,
  );

  assert.equal(calculateProgressPercent(timer, now), 0);
  assert.equal(calculateProgressPercent(timer, now + 300000), 50); // half elapsed
  assert.equal(calculateProgressPercent(timer, now + 600000), 100); // fully elapsed
});

test("Sequential Execution: automatically transitions to next timer when current finishes", () => {
  const now = 1000000;
  const t1 = createTimer("1", { title: "Этап 1", durationMinutes: 1, startImmediately: true }, now);
  const t2 = createTimer("2", { title: "Этап 2", durationMinutes: 1, startImmediately: false }, now);
  const t3 = createTimer("3", { title: "Этап 3", durationMinutes: 1, startImmediately: false }, now);

  const list = [t1, t2, t3];
  assert.equal(list[0].status, "running");
  assert.equal(list[1].status, "idle");

  // Advance 65 seconds: t1 should finish, and t2 should automatically start!
  const res1 = reconcileSequentialTimers(list, true, now + 65000);
  assert.equal(res1.isSequenceActive, true);
  assert.equal(res1.timers[0].status, "completed");
  assert.equal(res1.timers[1].status, "running");
  assert.equal(res1.timers[2].status, "idle");
  assert.equal(res1.nextStartedTimer?.id, "2");

  // Advance another 65 seconds: t2 finishes, t3 starts!
  const res2 = reconcileSequentialTimers(res1.timers, true, now + 130000);
  assert.equal(res2.isSequenceActive, true);
  assert.equal(res2.timers[1].status, "completed");
  assert.equal(res2.timers[2].status, "running");
  assert.equal(res2.nextStartedTimer?.id, "3");

  // Advance another 65 seconds: t3 finishes, sequence ends!
  const res3 = reconcileSequentialTimers(res2.timers, true, now + 195000);
  assert.equal(res3.isSequenceActive, false);
  assert.equal(res3.timers[2].status, "completed");
  assert.equal(res3.nextStartedTimer, null);
});
