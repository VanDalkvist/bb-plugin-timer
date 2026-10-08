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
  } = useTimers({ soundEnabled });

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef<Position>({ x: 0, y: 0 });
  const overlayPosRef = useRef<Position>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync expanded/visible/sound state to localStorage
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

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) {
      return; // Do not drag when interacting with controls
    }

    isDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    const rect = cardRef.current?.getBoundingClientRect();
    overlayPosRef.current = rect
      ? { x: rect.left, y: rect.top }
      : position ?? { x: window.innerWidth - 380, y: window.innerHeight - 450 };

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;

    const newX = Math.max(10, Math.min(window.innerWidth - 120, overlayPosRef.current.x + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 60, overlayPosRef.current.y + dy));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      if (position) {
        localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(position));
      }
    } catch {}
  };

  // If user has timers but widget was closed, show pill if a timer completes
  useEffect(() => {
    if (completedCount > 0 && !isVisible) {
      setIsVisible(true);
    }
  }, [completedCount, isVisible]);

  if (!isVisible) {
    return null;
  }

  // Positioning style
  const stylePos: React.CSSProperties = position
    ? {
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="touch-none select-none"
      >
        <button
          type="button"
          onClick={() => handleSetExpanded(true)}
          className={cn(
            "group flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-2 shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-accent/20 hover:shadow-xl cursor-pointer text-xs font-medium text-foreground",
            completedCount > 0 && "border-amber-500/60 bg-amber-500/10 text-amber-500",
            activeRunningCount > 0 && "border-primary/50",
          )}
        >
          {completedCount > 0 ? (
            <>
              <span className="size-2 animate-ping rounded-full bg-amber-500" />
              <span>🔔 Готов таймер! ({completedCount})</span>
            </>
          ) : earliestRunning ? (
            <>
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="truncate max-w-[130px]">{earliestRunning.title}:</span>
              <span className="font-mono font-bold text-primary">
                {formatTime(earliestRunning.remainingSeconds)}
              </span>
              {activeRunningCount > 1 && (
                <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
                  +{activeRunningCount - 1}
                </span>
              )}
            </>
          ) : (
            <>
              <Icon name="Timer" className="size-4 text-muted-foreground group-hover:text-foreground" />
              <span>Таймеры {timers.length > 0 && `(${timers.length})`}</span>
            </>
          )}

          <Icon
            name="Maximize2"
            className="size-3 text-muted-foreground/60 transition-transform group-hover:text-foreground"
          />
        </button>
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex items-center justify-between border-b border-border bg-muted/30 px-3.5 py-2.5 cursor-grab active:cursor-grabbing shrink-0"
      >
        <div className="flex items-center gap-2">
          <Icon name="Timer" className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Таймеры</span>
          {activeRunningCount > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
              {activeRunningCount} активен
            </span>
          )}
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
        {/* Toggleable / Always accessible Creator */}
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

        {/* Timers List */}
        {timers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Нет активных таймеров.
            <br />
            Выберите пресет выше или введите минуты.
          </div>
        ) : (
          <div className="space-y-2.5">
            {timers.map((timer) => (
              <TimerCard
                key={timer.id}
                timer={timer}
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
        <span>Всего: {timers.length}</span>
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
