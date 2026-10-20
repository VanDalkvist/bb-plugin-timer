// bb-plugin-timer — Floating Timer plugin frontend
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { FloatingTimerOverlay } from "./src/components/FloatingTimerOverlay.tsx";
import { TimerHeaderButton } from "./src/components/TimerHeaderButton.tsx";
import { TimersNavPage } from "./src/components/TimersNavPage.tsx";

function TimerSvgIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}

export default definePluginApp((app) => {
  // 0. Register crisp Timer SVG icon into BB runtime
  try {
    app.experimental_icons.register({
      name: "Timer",
      component: TimerSvgIcon,
    });
  } catch {}

  // 1. App-wide floating overlay: renders everywhere across all BB threads and views
  app.slots.experimental_appOverlay({
    id: "floating-timer-overlay",
    component: FloatingTimerOverlay,
  });

  // 2. Thread header action: shows quick live countdown and toggles the floating timer
  app.slots.experimental_threadHeaderAction({
    id: "timer-header-action",
    title: "Timer",
    component: TimerHeaderButton,
  });

  // 3. Sidebar Nav Panel: full-page dashboard for timers and focus sessions
  app.slots.navPanel({
    id: "timers-nav",
    title: "Таймеры",
    icon: "Timer",
    path: "timers",
    component: TimersNavPage,
  });
});
