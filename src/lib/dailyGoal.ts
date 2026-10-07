import { useApp } from '../context/AppContext';
import { localDate } from './dates';

/** Today's progress toward the author's real daily goal (from the word-count log, not a visit counter). */
export const useDailyGoal = () => {
  const { profile, wordCountLogs } = useApp();
  const goal = profile?.daily_word_goal || 1000;
  const today = localDate();
  const log = wordCountLogs.find((l) => l.date === today);
  const written = log ? log.word_count : 0;
  const percent = Math.min(100, Math.round((written / goal) * 100));
  return { goal, written, percent };
};
