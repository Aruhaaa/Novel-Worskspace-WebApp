import { daysUntil } from './dates';

/** A target length for the whole manuscript, with an optional finish date. Kept in this browser, per project. */
export interface ProjectGoal {
  target: number;
  deadline: string | null; // YYYY-MM-DD
  /** When this was last changed on this device (ms), so the device copy and the cloud copy can tell which is newer */
  updatedAt?: number;
}

const key = (projectId: string) => `novelist_goal_${projectId}`;

/** The stored record, including a "cleared" marker (target 0) that stops an old cloud goal coming back. */
export const readGoalRecord = (projectId: string): ProjectGoal | null => {
  try {
    const raw = localStorage.getItem(key(projectId));
    return raw ? (JSON.parse(raw) as ProjectGoal) : null;
  } catch {
    return null;
  }
};

export const writeGoalRecord = (projectId: string, goal: ProjectGoal): void => {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(goal));
  } catch {
    // ignore
  }
};

export const loadProjectGoal = (projectId: string): ProjectGoal | null => {
  const goal = readGoalRecord(projectId);
  return goal && goal.target > 0 ? goal : null;
};

export const saveProjectGoal = (projectId: string, goal: ProjectGoal | null): ProjectGoal => {
  const record: ProjectGoal = goal && goal.target > 0 ? { ...goal, updatedAt: Date.now() } : { target: 0, deadline: null, updatedAt: Date.now() };
  writeGoalRecord(projectId, record);
  return record;
};

export interface GoalPlan {
  target: number;
  written: number;
  remaining: number;
  percent: number;
  daysLeft: number | null;
  /** Words per day to finish on time; null with no deadline, or once the date has passed */
  perDay: number | null;
  state: 'no-deadline' | 'on-track' | 'overdue' | 'reached';
}

export const planGoal = (goal: ProjectGoal, written: number): GoalPlan => {
  const remaining = Math.max(0, goal.target - written);
  const percent = Math.min(100, Math.round((written / goal.target) * 100));
  const daysLeft = goal.deadline ? daysUntil(goal.deadline) : null;
  if (remaining === 0) return { target: goal.target, written, remaining, percent, daysLeft, perDay: null, state: 'reached' };
  if (daysLeft === null) return { target: goal.target, written, remaining, percent, daysLeft, perDay: null, state: 'no-deadline' };
  if (daysLeft < 1) return { target: goal.target, written, remaining, percent, daysLeft, perDay: null, state: 'overdue' };
  return { target: goal.target, written, remaining, percent, daysLeft, perDay: Math.ceil(remaining / daysLeft), state: 'on-track' };
};
