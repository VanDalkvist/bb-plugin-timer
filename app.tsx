// bb-plugin-timer — Floating Timer plugin frontend
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { FloatingTimerOverlay } from "./src/components/FloatingTimerOverlay.tsx";
import { TimerHeaderButton } from "./src/components/TimerHeaderButton.tsx";
import { TimersNavPage } from "./src/components/TimersNavPage.tsx";

export default definePluginApp((app) => {
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
