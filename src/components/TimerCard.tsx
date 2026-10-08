import { useState } from "react";
import type { Timer } from "../domain/timer.ts";
import { formatTime, calculateProgressPercent } from "../domain/timer.ts";
import { Button } from "../../components/ui/button.tsx";
import { Icon } from "../../components/ui/icon.tsx";
import { Input } from "../../components/ui/input.tsx";
import { cn } from "../../lib/utils.ts";

export interface TimerCardProps {
  timer: Timer;
  index?: number;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onReset: (id: string) => void;
  onAddTime: (id: string, extraSeconds: number) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}

export function TimerCard({
  timer,
  index,
  onStart,
  onPause,
  onReset,
  onAddTime,
  onRename,
  onRemove,
}: TimerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(timer.title);

  const progress = calculateProgressPercent(timer);
  const formattedTime = formatTime(timer.remainingSeconds);

  const handleSaveTitle = () => {
    if (draftTitle.trim() && draftTitle.trim() !== timer.title) {
      onRename(timer.id, draftTitle.trim());
    }
    setIsEditing(false);
  };

  const isCompleted = timer.status === "completed";
  const isRunning = timer.status === "running";

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card/90 p-3.5 shadow-sm transition-all duration-200 hover:bg-accent/10 hover:shadow-md",
        isCompleted && "border-amber-500/50 bg-amber-500/5",
        isRunning && "border-primary/40",
      )}
    >
      {/* Top row: Title and Status */}
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") {
                  setDraftTitle(timer.title);
                  setIsEditing(false);
                }
              }}
              autoFocus
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleSaveTitle}
            >
              OK
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5 text-left text-xs font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
            onClick={() => {
              setDraftTitle(timer.title);
              setIsEditing(true);
            }}
            title="Нажмите, чтобы переименовать"
          >
            {typeof index === "number" && (
              <span className="text-[11px] font-mono text-muted-foreground/80 shrink-0">
                {index + 1}.
              </span>
            )}
            <span className="truncate">{timer.title}</span>
            <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:opacity-100">
              ✏️
            </span>
          </button>
        )}

        {/* Status chip */}
        <div className="shrink-0">
          {isRunning && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Идёт
            </span>
          )}
          {timer.status === "paused" && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Пауза
            </span>
          )}
          {timer.status === "idle" && (
            <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Ожидает
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-500">
              🔔 Готов!
            </span>
          )}
        </div>
      </div>

      {/* Main Countdown Display */}
      <div className="mt-2.5 flex items-baseline justify-between">
        <div
          className={cn(
            "font-mono text-2xl font-bold tracking-tight text-foreground select-none",
            isCompleted && "text-amber-500 animate-pulse",
          )}
        >
          {formattedTime}
        </div>
        <div className="text-[11px] text-muted-foreground select-none">
          всего {formatTime(timer.totalDurationSeconds)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isCompleted
              ? "bg-amber-500"
              : isRunning
              ? "bg-primary"
              : "bg-muted-foreground/40",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Action Controls & Quick Time Extension */}
      <div className="mt-3 flex items-center justify-between gap-1">
        {/* Quick +1m and +5m chips */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onAddTime(timer.id, 60)}
            title="Добавить 1 минуту"
          >
            +1м
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onAddTime(timer.id, 300)}
            title="Добавить 5 минут"
          >
            +5м
          </Button>
        </div>

        {/* Play/Pause, Reset, Remove */}
        <div className="flex items-center gap-1">
          {isRunning ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onPause(timer.id)}
              title="Пауза"
            >
              <Icon name="Pause" className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onStart(timer.id)}
              title="Запустить"
            >
              <Icon name="Play" className="size-3.5 fill-current" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onReset(timer.id)}
            title="Сбросить"
          >
            <Icon name="RotateCcw" className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(timer.id)}
            title="Удалить"
          >
            <Icon name="Trash2" className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
