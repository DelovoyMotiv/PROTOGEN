import { SchedulerState } from "../types";

// PROTOGEN-01 AUTONOMOUS SCHEDULER
// Manages the "Life Loop" of recurring missions.
// Persists state to survive process restarts (page reloads).

const STORAGE_KEY_SCHEDULER = 'protogen_scheduler_v1';
const DEFAULT_INTERVAL = 24 * 60 * 60 * 1000; // 24 Hours

export class MissionScheduler {
  private state: SchedulerState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): SchedulerState {
    if (typeof window === 'undefined') {
        return this.getDefaultState();
    }
    
    const raw = localStorage.getItem(STORAGE_KEY_SCHEDULER);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return this.getDefaultState();
      }
    }
    return this.getDefaultState();
  }

  private getDefaultState(): SchedulerState {
    return {
      lastRun: 0,
      nextRun: Date.now() + 10000, // Bootup grace period
      intervalMs: DEFAULT_INTERVAL,
      missionTarget: "target-alpha.anoteroslogos.com",
      isActive: true
    };
  }

  public saveState() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SCHEDULER, JSON.stringify(this.state));
    }
  }

  public getStatus(): SchedulerState {
    return this.state;
  }

  /**
   * Checks if mission is due.
   * Returns true ONLY if due and active.
   */
  public isDue(): boolean {
    if (!this.state.isActive) return false;
    return Date.now() >= this.state.nextRun;
  }

  /**
   * Records a successful or attempted execution and advances the timer.
   */
  public markExecuted() {
    const now = Date.now();
    this.state.lastRun = now;
    this.state.nextRun = now + this.state.intervalMs;
    this.saveState();
  }

  /**
   * Delays the next execution (e.g., due to low battery/funds).
   */
  public snooze(ms: number = 300000) { // Default 5 min
    this.state.nextRun = Date.now() + ms;
    this.saveState();
  }
}

export const schedulerService = new MissionScheduler();