import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Icon } from "../../components/ui/icon.tsx";
import { Input } from "../../components/ui/input.tsx";

const PRESET_MINUTES = [1, 5, 10, 15, 25, 45, 60];
const SUGGESTED_NAMES = ["Помидорка", "Фокус", "Чай", "Отдых", "Встреча"];

export interface TimerCreatorProps {
  onAddTimer: (title: string, durationMinutes: number, startImmediately?: boolean) => void;
}

export function TimerCreator({ onAddTimer }: TimerCreatorProps) {
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [customTitle, setCustomTitle] = useState("");
  const [isCustomMinutes, setIsCustomMinutes] = useState(false);
  const [rawMinutesInput, setRawMinutesInput] = useState("25");

  const handleSelectPreset = (mins: number) => {
    setSelectedMinutes(mins);
    setIsCustomMinutes(false);
    setRawMinutesInput(String(mins));
  };

  const handleCustomMinutesChange = (val: string) => {
    setRawMinutesInput(val);
    const parsed = parseFloat(val);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setSelectedMinutes(parsed);
    }
  };

  const handleCreate = (startImmediately: boolean) => {
    const minutes = Math.max(0.1, Number(rawMinutesInput) || selectedMinutes);
    const title = customTitle.trim() || `Таймер ${minutes}м`;
    onAddTimer(title, minutes, startImmediately);
    setCustomTitle("");
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/60 p-3">
      {/* Presets Row */}
      <div>
        <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
          <span>Быстрые пресеты:</span>
          {isCustomMinutes && <span className="text-primary font-mono">{rawMinutesInput} мин</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESET_MINUTES.map((mins) => {
            const isSelected = !isCustomMinutes && selectedMinutes === mins;
            return (
              <button
                key={mins}
                type="button"
                onClick={() => handleSelectPreset(mins)}
                className={`rounded-lg px-2 py-1 text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/80 text-foreground hover:bg-muted hover:shadow-sm"
                }`}
              >
                {mins}м
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsCustomMinutes(true)}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-all cursor-pointer ${
              isCustomMinutes
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/80 text-foreground hover:bg-muted hover:shadow-sm"
            }`}
          >
            Своё…
          </button>
        </div>
      </div>

      {/* Custom minutes input if activated */}
      {isCustomMinutes && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Минут:</span>
          <Input
            type="number"
            min="0.5"
            step="0.5"
            value={rawMinutesInput}
            onChange={(e) => handleCustomMinutesChange(e.target.value)}
            className="h-7 w-24 text-xs font-mono"
            autoFocus
          />
        </div>
      )}

      {/* Suggested name chips */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-muted-foreground mr-1">Тема:</span>
        {SUGGESTED_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setCustomTitle(name)}
            className="rounded-full bg-muted/60 hover:bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {name}
          </button>
        ))}
      </div>

      {/* Custom title input and submit buttons */}
      <div className="flex items-center gap-1.5">
        <Input
          placeholder="Название таймера (опционально)..."
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate(true);
          }}
          className="h-8 text-xs flex-1"
        />
        <Button
          size="sm"
          variant="default"
          className="h-8 px-2.5 text-xs gap-1 shrink-0"
          onClick={() => handleCreate(true)}
          title="Запустить немедленно"
        >
          <Icon name="Play" className="size-3 fill-current" />
          <span>Старт</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2.5 text-xs gap-1 shrink-0"
          onClick={() => handleCreate(false)}
          title="Добавить в список без немедленного запуска"
        >
          <Icon name="Plus" className="size-3" />
        </Button>
      </div>
    </div>
  );
}
