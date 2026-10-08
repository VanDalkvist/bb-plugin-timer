import { useTimers } from "../hooks/use-timers.ts";
import { TimerCard } from "./TimerCard.tsx";
import { TimerCreator } from "./TimerCreator.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Icon } from "../../components/ui/icon.tsx";

export function TimersNavPage() {
  const {
    timers,
    isSequenceActive,
    activeRunningCount,
    completedCount,
    addTimer,
    start,
    pause,
    reset,
    addTime,
    rename,
    remove,
    clearCompleted,
    startSequence,
    stopSequence,
    resetAll,
  } = useTimers({ soundEnabled: false });

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Icon name="Timer" className="size-5 text-primary" />
              <span>Таймеры и фокус-сессии</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Управляйте рабочими спринтами, помидорками и интервалами отдыха.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {timers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetAll}
                className="text-xs gap-1.5"
                title="Сбросить все таймеры к начальному времени"
              >
                <Icon name="RotateCcw" className="size-3.5" />
                <span>Сбросить все</span>
              </Button>
            )}
            {timers.length > 1 && (
              isSequenceActive ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={stopSequence}
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Icon name="Pause" className="size-3.5" />
                  <span>Остановить цепочку</span>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={startSequence}
                  className="text-xs gap-1.5"
                  title="Запустить все таймеры по очереди"
                >
                  <Icon name="Play" className="size-3.5 fill-current" />
                  <span>Запустить последовательно</span>
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("bb:timer:open"))}
              className="text-xs gap-1.5"
            >
              <Icon name="Maximize2" className="size-3.5" />
              <span>Открыть плавающий</span>
            </Button>
          </div>
        </div>

        {/* Creator Section */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Новый таймер</h2>
          <TimerCreator onAddTimer={addTimer} />
        </div>

        {/* Completed Alert */}
        {completedCount > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-500">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-medium">Завершено таймеров: {completedCount}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-amber-500 hover:bg-amber-500/20"
              onClick={clearCompleted}
            >
              Очистить завершённые
            </Button>
          </div>
        )}

        {/* List of active timers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Список таймеров</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {timers.length}
              </span>
              {isSequenceActive && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500 animate-pulse">
                  ▶▶ Цепочка активна
                </span>
              )}
            </h2>

            {activeRunningCount > 0 && !isSequenceActive && (
              <span className="text-xs text-emerald-500 font-medium">
                {activeRunningCount} активно сейчас
              </span>
            )}
          </div>

          {timers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Нет таймеров. Запустите первый таймер выше!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {timers.map((timer, idx) => (
                <TimerCard
                  key={timer.id}
                  timer={timer}
                  index={idx}
                  onStart={start}
                  onPause={pause}
                  onReset={reset}
                  onAddTime={addTime}
                  onRename={rename}
                  onRemove={remove}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
