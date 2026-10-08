import { useTimers } from "../hooks/use-timers.ts";
import { formatTime } from "../domain/timer.ts";
import { Button } from "../../components/ui/button.tsx";
import { Icon } from "../../components/ui/icon.tsx";
import { cn } from "../../lib/utils.ts";

export function TimerHeaderButton() {
  const { earliestRunning, completedCount, activeRunningCount } = useTimers({
    soundEnabled: false, // The overlay handles audio
  });

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("bb:timer:toggle"));
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
        completedCount > 0 && "text-amber-500 hover:text-amber-400 font-medium",
        activeRunningCount > 0 && "text-primary font-medium",
      )}
      onClick={handleClick}
      title="Открыть / скрыть плавающий таймер"
    >
      <Icon
        name="Timer"
        className={cn(
          "size-3.5",
          completedCount > 0 && "text-amber-500 animate-bounce",
          activeRunningCount > 0 && "text-primary animate-pulse",
        )}
      />
      {earliestRunning ? (
        <span className="font-mono text-[11px] font-semibold">
          {formatTime(earliestRunning.remainingSeconds)}
        </span>
      ) : completedCount > 0 ? (
        <span className="text-[11px]">Готово ({completedCount})</span>
      ) : (
        <span className="hidden sm:inline text-[11px]">Таймер</span>
      )}
    </Button>
  );
}
