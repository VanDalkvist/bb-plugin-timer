import { useState, useEffect, useRef, useCallback } from "react";
import { useTimers } from "../hooks/use-timers.ts";
import { TimerCard } from "./TimerCard.tsx";
import { TimerCreator } from "./TimerCreator.tsx";
import { formatTime } from "../domain/timer.ts";
import { Button } from "../../components/ui/button.tsx";
import { Icon } from "../../components/ui/icon.tsx";
import { cn } from "../../lib/utils.ts";

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY_POS = "bb-timer-overlay-pos";
const STORAGE_KEY_SOUND = "bb-timer-overlay-sound";
const STORAGE_KEY_EXPANDED = "bb-timer-overlay-expanded";
const STORAGE_KEY_VISIBLE = "bb-timer-overlay-visible";

export function FloatingTimerOverlay() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SOUND) !== "false";
    } catch {
      return true;
    }
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_EXPANDED) === "true";
    } catch {
      return false;
    }
  });

  const [isVisible, setIsVisible] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VISIBLE);
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  const [position, setPosition] = useState<Position | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showCreator, setShowCreator] = useState(false);

  const {
    timers,
    isSequenceActive,
    activeRunningCount,
    completedCount,
    earliestRunning,
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
  } = useTimers({ soundEnabled });

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartClientRef = useRef<Position>({ x: 0, y: 0 });
  const dragStartPosRef = useRef<Position>({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY_SOUND, String(next));
    } catch {}
  };

  const handleSetExpanded = (expanded: boolean) => {
    setIsExpanded(expanded);
    try {
      localStorage.setItem(STORAGE_KEY_EXPANDED, String(expanded));
    } catch {}
  };

  const handleSetVisible = (visible: boolean) => {
    setIsVisible(visible);
    try {
      localStorage.setItem(STORAGE_KEY_VISIBLE, String(visible));
    } catch {}
  };

  // Custom event listeners for app-wide control (e.g. from header button)
  useEffect(() => {
    const handleToggle = () => {
      setIsVisible(true);
      handleSetExpanded(!isExpanded);
    };
    const handleOpen = () => {
      setIsVisible(true);
      handleSetExpanded(true);
    };

    window.addEventListener("bb:timer:toggle", handleToggle);
    window.addEventListener("bb:timer:open", handleOpen);

    return () => {
      window.removeEventListener("bb:timer:toggle", handleToggle);
      window.removeEventListener("bb:timer:open", handleOpen);
    };
  }, [isExpanded]);

  // Unified Drag Handlers
  const startDrag = useCallback(
    (e: React.PointerEvent, defaultWidth: number, defaultHeight: number) => {
      isDraggingRef.current = true;
      hasMovedRef.current = false;
      dragStartClientRef.current = { x: e.clientX, y: e.clientY };

      const rect = cardRef.current?.getBoundingClientRect();
      const currentX = rect
        ? rect.left
        : position?.x ?? Math.max(10, window.innerWidth - defaultWidth - 24);
      const currentY = rect
        ? rect.top
        : position?.y ?? Math.max(10, window.innerHeight - defaultHeight - 24);

      dragStartPosRef.current = { x: currentX, y: currentY };

      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    },
    [position],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;

      const dx = e.clientX - dragStartClientRef.current.x;
      const dy = e.clientY - dragStartClientRef.current.y;

      if (!hasMovedRef.current && Math.hypot(dx, dy) > 3) {
        hasMovedRef.current = true;
      }

      if (hasMovedRef.current) {
        const targetWidth = cardRef.current?.offsetWidth || (isExpanded ? 384 : 200);
        const targetHeight = cardRef.current?.offsetHeight || (isExpanded ? 400 : 40);

        const newX = Math.max(10, Math.min(window.innerWidth - targetWidth - 10, dragStartPosRef.current.x + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - targetHeight - 10, dragStartPosRef.current.y + dy));

        setPosition({ x: newX, y: newY });
      }
    },
    [isExpanded],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent, onClickAction?: () => void) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      if (hasMovedRef.current) {
        setPosition((currentPos) => {
          if (currentPos) {
            try {
              localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(currentPos));
            } catch {}
          }
          return currentPos;
        });
      } else {
        onClickAction?.();
      }
    },
    [],
  );

  useEffect(() => {
    if (completedCount > 0 && !isVisible) {
      setIsVisible(true);
    }
  }, [completedCount, isVisible]);

  if (!isVisible) {
    return null;
  }

  // Calculate clamped positioning style to avoid rendering off-screen
  const targetWidth = isExpanded ? 384 : 240;
  const targetHeight = isExpanded ? 480 : 44;

  const stylePos: React.CSSProperties = position
    ? {
        position: "fixed",
        left: `${Math.max(10, Math.min(window.innerWidth - targetWidth - 10, position.x))}px`,
        top: `${Math.max(10, Math.min(window.innerHeight - targetHeight - 10, position.y))}px`,
        zIndex: 9999,
      }
    : {
        position: "fixed",
        right: "24px",
        bottom: "24px",
        zIndex: 9999,
      };

  // 1. Minimized Floating Pill Mode
  if (!isExpanded) {
    return (
      <div
        ref={cardRef}
        style={stylePos}
        onPointerDown={(e) => startDrag(e, 240, 44)}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerUp(e, () => handleSetExpanded(true))}
        role="button"
        tabIndex={0}
        title="Зажмите, чтобы перетащить; нажмите, чтобы открыть окно"
        className={cn(
          "touch-none select-none cursor-grab active:cursor-grabbing group flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-2 shadow-lg backdrop-blur-md transition-[shadow,background-color] duration-150 hover:bg-accent/20 hover:shadow-xl text-xs font-medium text-foreground max-w-[320px]",
          completedCount > 0 && "border-amber-500/60 bg-amber-500/10 text-amber-500",
          activeRunningCount > 0 && "border-primary/50",
        )}
      >
        {/* Grip indicator */}
        <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-80 transition-opacity shrink-0">
          <div className="flex gap-0.5">
            <span className="size-0.5 rounded-full bg-current" />
            <span className="size-0.5 rounded-full bg-current" />
          </div>
          <div className="flex gap-0.5">
            <span className="size-0.5 rounded-full bg-current" />
            <span className="size-0.5 rounded-full bg-current" />
          </div>
        </div>

        {completedCount > 0 ? (
          <>
            <span className="size-2 animate-ping rounded-full bg-amber-500 shrink-0" />
            <span className="truncate">🔔 Готов таймер! ({completedCount})</span>
          </>
        ) : earliestRunning ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500 shrink-0" />
            {isSequenceActive && (
              <span className="text-[10px] text-primary/80 font-mono font-bold shrink-0">
                ▶▶
              </span>
            )}
            <span className="truncate max-w-[130px] font-medium text-foreground">
              {earliestRunning.title}:
            </span>
            <span className="font-mono font-bold text-primary shrink-0">
              {formatTime(earliestRunning.remainingSeconds)}
            </span>
            {activeRunningCount > 1 && !isSequenceActive && (
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground shrink-0">
                +{activeRunningCount - 1}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Icon name="Timer" className="size-4 text-muted-foreground group-hover:text-foreground shrink-0" />
            <span>Таймеры {timers.length > 0 && `(${timers.length})`}</span>
          </div>
        )}

        <Icon
          name="Maximize2"
          className="size-3 text-muted-foreground/60 transition-transform group-hover:text-foreground ml-auto shrink-0"
        />
      </div>
    );
  }

  // 2. Expanded Floating Window Mode
  return (
    <div
      ref={cardRef}
      style={stylePos}
      className="touch-none flex flex-col w-84 sm:w-96 max-h-[85vh] rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-md overflow-hidden select-none transition-shadow"
    >
      {/* Draggable Window Header */}
      <div
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) {
            return;
          }
          startDrag(e, 384, 450);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerUp(e)}
        className="flex items-center justify-between border-b border-border bg-muted/30 px-3.5 py-2.5 cursor-grab active:cursor-grabbing shrink-0"
      >
        <div className="flex items-center gap-2">
          {/* Grip dots */}
          <div className="flex flex-col gap-0.5 opacity-40 hover:opacity-80 transition-opacity">
            <div className="flex gap-0.5">
              <span className="size-0.5 rounded-full bg-current" />
              <span className="size-0.5 rounded-full bg-current" />
            </div>
            <div className="flex gap-0.5">
              <span className="size-0.5 rounded-full bg-current" />
              <span className="size-0.5 rounded-full bg-current" />
            </div>
          </div>
          <Icon name="Timer" className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Таймеры</span>
          {isSequenceActive ? (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500 animate-pulse flex items-center gap-1">
              <span>▶▶</span>
              <span>Цепочка</span>
            </span>
          ) : activeRunningCount > 0 ? (
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
              {activeRunningCount} активен
            </span>
          ) : null}
          {completedCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
              {completedCount} готов
            </span>
          )}
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={toggleSound}
            title={soundEnabled ? "Звук включен (нажмите для выключения)" : "Звук выключен"}
          >
            <Icon name={soundEnabled ? "Volume2" : "VolumeX"} className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => handleSetExpanded(false)}
            title="Свернуть в мини-виджет"
          >
            <Icon name="Minimize2" className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => handleSetVisible(false)}
            title="Закрыть виджет"
          >
            <Icon name="X" className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Creator */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {timers.length > 0 ? "Быстрый запуск:" : "Создать таймер:"}
            </span>
            {timers.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setShowCreator(!showCreator)}
              >
                {showCreator ? "Скрыть форму" : "+ Создать свой"}
              </Button>
            )}
          </div>

          {(showCreator || timers.length === 0) && (
            <TimerCreator
              onAddTimer={(title, mins, startNow) => {
                addTimer(title, mins, startNow);
                if (timers.length > 0) setShowCreator(false);
              }}
            />
          )}
        </div>

        {/* Completed Alert Banner */}
        {completedCount > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-500">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Завершено таймеров: {completedCount}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] text-amber-500 hover:bg-amber-500/20"
              onClick={clearCompleted}
            >
              Очистить
            </Button>
          </div>
        )}

        {/* Sequential Mode and Reset All Controls */}
        {timers.length > 0 && (
          <div className="flex items-center gap-1.5">
            {timers.length > 1 && (
              isSequenceActive ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={stopSequence}
                  className="flex-1 h-8 text-xs gap-1.5 font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  <Icon name="Pause" className="size-3.5" />
                  <span>Остановить цепочку</span>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={startSequence}
                  className="flex-1 h-8 text-xs gap-1.5 font-medium hover:bg-accent/40 shadow-sm border border-border/60"
                  title="Запустить все таймеры по очереди: когда завершится один, автоматически стартует следующий"
                >
                  <Icon name="Play" className="size-3.5 fill-current text-primary" />
                  <span>Запустить последовательно</span>
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={resetAll}
              className="h-8 px-2.5 text-xs gap-1.5 shrink-0 text-muted-foreground hover:text-foreground"
              title="Сбросить все таймеры к начальному времени, чтобы запустить заново"
            >
              <Icon name="RotateCcw" className="size-3.5" />
              <span>Сбросить все</span>
            </Button>
          </div>
        )}

        {/* Timers List */}
        {timers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Нет активных таймеров.
            <br />
            Выберите пресет выше или введите минуты.
          </div>
        ) : (
          <div className="space-y-2.5">
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

      {/* Footer Status Bar */}
      <div className="border-t border-border bg-muted/20 px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5">
          <span>Всего: {timers.length}</span>
          {isSequenceActive && (
            <span className="text-emerald-500 font-semibold">• Цепочка активна</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <button
              type="button"
              onClick={clearCompleted}
              className="text-[11px] text-amber-500 hover:underline cursor-pointer"
            >
              Очистить завершённые
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
