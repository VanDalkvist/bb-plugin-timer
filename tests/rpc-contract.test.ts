import test from "node:test";
import assert from "node:assert/strict";
import { rpcContract } from "../server.ts";

test("rpcContract defines all required methods and validates schemas", () => {
  assert.ok("timers_list" in rpcContract);
  assert.ok("timers_add" in rpcContract);
  assert.ok("timers_start" in rpcContract);
  assert.ok("timers_pause" in rpcContract);
  assert.ok("timers_reset" in rpcContract);
  assert.ok("timers_add_time" in rpcContract);
  assert.ok("timers_rename" in rpcContract);
  assert.ok("timers_remove" in rpcContract);
  assert.ok("timers_clear_completed" in rpcContract);
  assert.ok("timers_start_sequence" in rpcContract);
  assert.ok("timers_stop_sequence" in rpcContract);
  assert.ok("timers_reset_all" in rpcContract);

  // Validate timers_add input
  const validAdd = rpcContract.timers_add.input.safeParse({
    title: "Помидор",
    durationMinutes: 25,
    startImmediately: true,
  });
  assert.equal(validAdd.success, true);

  const invalidAdd = rpcContract.timers_add.input.safeParse({
    durationMinutes: -5,
  });
  assert.equal(invalidAdd.success, false);
});
