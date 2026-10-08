// bb-plugin-timer — backend entry
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { TimerService, type TimerStorage } from "./src/services/timer-service.ts";
import { formatTime, type Timer } from "./src/domain/timer.ts";

export const timerSchema = z.object({
  id: z.string(),
  title: z.string(),
  totalDurationSeconds: z.number(),
  remainingSeconds: z.number(),
  status: z.enum(["idle", "running", "paused", "completed"]),
  startedAt: z.number().nullable(),
  targetEndAt: z.number().nullable(),
  createdAt: z.number(),
});

export const rpcContract = defineRpcContract({
  timers_list: {
    input: z.null(),
    output: z.object({ timers: z.array(timerSchema) }),
  },
  timers_add: {
    input: z.object({
      title: z.string().trim().max(100),
      durationMinutes: z.number().positive(),
      startImmediately: z.boolean().optional(),
    }),
    output: timerSchema,
  },
  timers_start: {
    input: z.object({ id: z.string() }),
    output: timerSchema.nullable(),
  },
  timers_pause: {
    input: z.object({ id: z.string() }),
    output: timerSchema.nullable(),
  },
  timers_reset: {
    input: z.object({ id: z.string() }),
    output: timerSchema.nullable(),
  },
  timers_add_time: {
    input: z.object({ id: z.string(), extraSeconds: z.number().int() }),
    output: timerSchema.nullable(),
  },
  timers_rename: {
    input: z.object({ id: z.string(), title: z.string().trim().min(1).max(100) }),
    output: timerSchema.nullable(),
  },
  timers_remove: {
    input: z.object({ id: z.string() }),
    output: z.object({ removed: z.boolean() }),
  },
  timers_clear_completed: {
    input: z.null(),
    output: z.object({ clearedCount: z.number() }),
  },
});

export const TIMERS_CHANGED = "timers-changed";

class KvTimerStorage implements TimerStorage {
  private readonly bb: BbPluginApi;

  constructor(bb: BbPluginApi) {
    this.bb = bb;
  }

  async getTimers(): Promise<Timer[]> {
    return (await this.bb.storage.kv.get<Timer[]>("timers")) ?? [];
  }

  async saveTimers(timers: Timer[]): Promise<void> {
    await this.bb.storage.kv.set("timers", timers);
  }
}

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("Floating Timer plugin loaded");

  const storage = new KvTimerStorage(bb);
  const service = new TimerService(storage, (timers) => {
    bb.realtime.publish(TIMERS_CHANGED, { count: timers.length });
  });

  bb.rpc.register(rpcContract, {
    async timers_list() {
      const timers = await service.listTimers();
      return { timers };
    },
    async timers_add(input) {
      return await service.addTimer(input);
    },
    async timers_start(input) {
      return await service.startTimer(input.id);
    },
    async timers_pause(input) {
      return await service.pauseTimer(input.id);
    },
    async timers_reset(input) {
      return await service.resetTimer(input.id);
    },
    async timers_add_time(input) {
      return await service.addExtraTime(input.id, input.extraSeconds);
    },
    async timers_rename(input) {
      return await service.renameTimer(input.id, input.title);
    },
    async timers_remove(input) {
      const removed = await service.removeTimer(input.id);
      return { removed };
    },
    async timers_clear_completed() {
      const clearedCount = await service.clearCompleted();
      return { clearedCount };
    },
  });

  bb.cli.register({
    name: "timer",
    summary: "Manage floating timers and focus sessions",
    commands: [
      {
        name: "list",
        summary: "List all active, paused, and completed timers",
        usage: "bb timer list",
      },
      {
        name: "add",
        summary: "Create and immediately start a timer for N minutes",
        usage: "bb timer add <minutes> [name]",
      },
      {
        name: "pause",
        summary: "Pause a running timer by id",
        usage: "bb timer pause <id>",
      },
      {
        name: "start",
        summary: "Resume or start a timer by id",
        usage: "bb timer start <id>",
      },
      {
        name: "reset",
        summary: "Reset a timer to its initial duration",
        usage: "bb timer reset <id>",
      },
      {
        name: "remove",
        summary: "Delete a timer by id",
        usage: "bb timer remove <id>",
      },
      {
        name: "clear",
        summary: "Clear all completed timers",
        usage: "bb timer clear",
      },
    ],
    async run(argv) {
      const subcommand = argv[0];

      if (!subcommand || subcommand === "list") {
        const timers = await service.listTimers();
        if (timers.length === 0) {
          return {
            exitCode: 0,
            stdout: "No timers configured. Add one with `bb timer add <minutes> [name]`.\n",
          };
        }

        const lines = timers.map((t) => {
          const statusMap: Record<string, string> = {
            running: "RUNNING",
            paused: "PAUSED",
            idle: "IDLE",
            completed: "DONE",
          };
          const badge = statusMap[t.status] ?? t.status.toUpperCase();
          const rem = formatTime(t.remainingSeconds);
          return `[${badge}] ${t.id.padEnd(8)} "${t.title}" — ${rem} left (total ${formatTime(t.totalDurationSeconds)})`;
        });

        return {
          exitCode: 0,
          stdout: lines.join("\n") + "\n",
        };
      }

      if (subcommand === "add") {
        const minutesArg = argv[1];
        const minutes = Number(minutesArg);
        if (Number.isNaN(minutes) || minutes <= 0) {
          return {
            exitCode: 1,
            stderr: "Usage: bb timer add <minutes> [name]\n",
          };
        }
        const name = argv.slice(2).join(" ") || `Таймер ${minutes}м`;
        const timer = await service.addTimer({
          durationMinutes: minutes,
          title: name,
          startImmediately: true,
        });
        return {
          exitCode: 0,
          stdout: `Started timer "${timer.title}" (${formatTime(timer.remainingSeconds)}) [id: ${timer.id}]\n`,
        };
      }

      if (subcommand === "pause") {
        const id = argv[1];
        if (!id) {
          return {
            exitCode: 1,
            stderr: "Usage: bb timer pause <id>\n",
          };
        }
        const paused = await service.pauseTimer(id);
        if (!paused) {
          return {
            exitCode: 1,
            stderr: `Timer with id "${id}" not found.\n`,
          };
        }
        return {
          exitCode: 0,
          stdout: `Paused timer "${paused.title}" at ${formatTime(paused.remainingSeconds)} [id: ${paused.id}]\n`,
        };
      }

      if (subcommand === "start" || subcommand === "resume") {
        const id = argv[1];
        if (!id) {
          return {
            exitCode: 1,
            stderr: "Usage: bb timer start <id>\n",
          };
        }
        const started = await service.startTimer(id);
        if (!started) {
          return {
            exitCode: 1,
            stderr: `Timer with id "${id}" not found.\n`,
          };
        }
        return {
          exitCode: 0,
          stdout: `Started timer "${started.title}" (${formatTime(started.remainingSeconds)}) [id: ${started.id}]\n`,
        };
      }

      if (subcommand === "reset") {
        const id = argv[1];
        if (!id) {
          return {
            exitCode: 1,
            stderr: "Usage: bb timer reset <id>\n",
          };
        }
        const reset = await service.resetTimer(id);
        if (!reset) {
          return {
            exitCode: 1,
            stderr: `Timer with id "${id}" not found.\n`,
          };
        }
        return {
          exitCode: 0,
          stdout: `Reset timer "${reset.title}" to ${formatTime(reset.totalDurationSeconds)} [id: ${reset.id}]\n`,
        };
      }

      if (subcommand === "remove" || subcommand === "rm") {
        const id = argv[1];
        if (!id) {
          return {
            exitCode: 1,
            stderr: "Usage: bb timer remove <id>\n",
          };
        }
        const removed = await service.removeTimer(id);
        if (!removed) {
          return {
            exitCode: 1,
            stderr: `Timer with id "${id}" not found.\n`,
          };
        }
        return {
          exitCode: 0,
          stdout: `Removed timer ${id}\n`,
        };
      }

      if (subcommand === "clear") {
        const count = await service.clearCompleted();
        return {
          exitCode: 0,
          stdout: `Cleared ${count} completed timer(s).\n`,
        };
      }

      return {
        exitCode: 1,
        stderr: `Unknown subcommand "${subcommand}". Available: list, add, start, pause, reset, remove, clear\n`,
      };
    },
  });
}
