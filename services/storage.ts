import { UserProgress, Message } from "../types";
import { CURRICULUM } from "./curriculum";

const STORAGE_KEY = 'sams_maestro_progress_v3';

const INITIAL_PROGRESS: UserProgress = {
  userName: null,
  level: null,
  xp: 0,
  streak: 0,
  lastLoginDate: null,
  wordsLearned: 0,
  completedTopicIds: [],
  unlockedTopicIds: ['greetings'],
  topicHistory: {},
};

const sanitizeMessages = (messages: Message[]): Message[] => {
  return messages.map(msg => ({
    ...msg,
    isAudioPlaying: false,
    audioBuffer: undefined
  }));
};

export const saveProgress = (progress: UserProgress) => {
  const progressToSave = {
    ...progress,
    topicHistory: Object.keys(progress.topicHistory).reduce((acc, topicId) => {
      acc[topicId] = sanitizeMessages(progress.topicHistory[topicId]);
      return acc;
    }, {} as Record<string, Message[]>)
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progressToSave));
  } catch (e) {
    console.error("Failed to save progress", e);
  }
};

export const loadProgress = (): UserProgress => {
  const stored = localStorage.getItem(STORAGE_KEY);
  let progress = INITIAL_PROGRESS;
  
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      progress = { ...INITIAL_PROGRESS, ...parsed };
    } catch (e) {
      console.error("Failed to parse progress", e);
    }
  }
  
  // Calculate Streak
  const today = new Date().toDateString();
  const lastLogin = progress.lastLoginDate ? new Date(progress.lastLoginDate).toDateString() : null;

  if (lastLogin !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastLogin === yesterday.toDateString()) {
      progress.streak += 1;
    } else if (!lastLogin) {
       progress.streak = 1; // First day
    } else {
      progress.streak = 1; // Broken streak
    }
    progress.lastLoginDate = new Date().toISOString();
    saveProgress(progress);
  }

  return progress;
};

export const unlockNextTopic = (currentTopicId: string, currentProgress: UserProgress): UserProgress => {
  const currentIdx = CURRICULUM.findIndex(t => t.id === currentTopicId);
  const nextTopic = CURRICULUM[currentIdx + 1];
  
  const newCompleted = [...new Set([...currentProgress.completedTopicIds, currentTopicId])];
  let newUnlocked = [...currentProgress.unlockedTopicIds];

  if (nextTopic && !newUnlocked.includes(nextTopic.id)) {
    newUnlocked.push(nextTopic.id);
  }

  const updated = {
    ...currentProgress,
    completedTopicIds: newCompleted,
    unlockedTopicIds: newUnlocked,
    xp: currentProgress.xp + 100,
    wordsLearned: currentProgress.wordsLearned + 15 // Arbitrary reward for completion
  };

  saveProgress(updated);
  return updated;
};

export const saveTopicHistory = (progress: UserProgress, topicId: string, messages: Message[]): UserProgress => {
  const updated = {
    ...progress,
    topicHistory: {
      ...progress.topicHistory,
      [topicId]: messages
    }
  };
  saveProgress(updated);
  return updated;
};