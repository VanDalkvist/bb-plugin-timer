import { useTimers } from "../hooks/use-timers.ts";
import { formatTime } from "../domain/timer.ts";
import { Button } from "../../components/ui/button.tsx";
import { Icon } from "../../components/ui/icon.tsx";
import { cn } from "../../lib/utils.ts";

export function TimerHeaderButton() {
  const { earliestRunning, completedCount, activeRunningCount, isSequenceActive } = useTimers({
    soundEnabled: false, // The overlay handles audio
  });

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("bb:timer:toggle"));
  };

  const isIdle = !earliestRunning && completedCount === 0;

  if (isIdle) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-state-hover cursor-pointer transition-colors"
        onClick={handleClick}
        title="Таймеры (Focus Timers)"
        aria-label="Таймеры"
      >
        <Icon name="Timer" className="size-3.5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors max-w-[240px]",
        activeRunningCount > 0
          ? "text-primary font-medium"
          : "text-amber-500 hover:text-amber-400 font-medium",
      )}
      onClick={handleClick}
      title={
        earliestRunning
          ? `Таймер: ${earliestRunning.title} (${formatTime(earliestRunning.remainingSeconds)} осталось)`
          : `Готово (${completedCount})`
      }
      aria-label={
        earliestRunning
          ? `Таймер: ${earliestRunning.title} (${formatTime(earliestRunning.remainingSeconds)})`
          : `Таймеры завершены (${completedCount})`
      }
    >
      <Icon
        name="Timer"
        className={cn(
          "size-3.5 shrink-0",
          activeRunningCount > 0 ? "text-primary animate-pulse" : "text-amber-500 animate-bounce",
        )}
      />

      {earliestRunning ? (
        <div className="flex items-center gap-1 min-w-0 text-[11px]">
          {isSequenceActive && (
            <span className="text-[10px] text-primary/70 shrink-0 font-mono">▶▶</span>
          )}
          <span className="truncate max-w-[100px] text-foreground font-medium">
            {earliestRunning.title}:
          </span>
          <span className="font-mono font-semibold text-primary shrink-0">
            {formatTime(earliestRunning.remainingSeconds)}
          </span>
        </div>
      ) : (
        <span className="text-[11px] truncate">Готово ({completedCount})</span>
      )}
    </Button>
  );
}
