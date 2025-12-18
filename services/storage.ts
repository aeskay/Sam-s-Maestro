
import { UserProgress, Message } from "../types";
import { CURRICULUM } from "./curriculum";

const STORAGE_KEY = 'sams_maestro_progress_v6';

const INITIAL_PROGRESS: UserProgress = {
  userName: null,
  level: null,
  xp: 0,
  streak: 0,
  lastLoginDate: null,
  wordsLearned: 0,
  completedTopicIds: [],
  completedSubTopicIds: [],
  unlockedTopicIds: ['module-1'], 
  topicHistory: {},
  preferences: {
    autoPlayAudio: false,
    voiceName: 'Kore',
    playbackSpeed: 1.0
  }
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
      progress = { 
        ...INITIAL_PROGRESS, 
        ...parsed,
        preferences: {
          ...INITIAL_PROGRESS.preferences,
          ...(parsed.preferences || {})
        },
        completedSubTopicIds: parsed.completedSubTopicIds || [],
        unlockedTopicIds: (parsed.unlockedTopicIds && parsed.unlockedTopicIds.length > 0) 
          ? parsed.unlockedTopicIds 
          : ['module-1']
      };
      
      if (progress.unlockedTopicIds.includes('greetings') && !progress.unlockedTopicIds.includes('module-1')) {
          progress.unlockedTopicIds.push('module-1');
      }

    } catch (e) {
      console.error("Failed to parse progress", e);
    }
  }
  
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

export const completeSubTopic = (topicId: string, subTopicId: string, currentProgress: UserProgress): UserProgress => {
  const newCompletedSubTopics = [...new Set([...currentProgress.completedSubTopicIds, subTopicId])];
  const topic = CURRICULUM.find(t => t.id === topicId);
  let newCompletedTopics = [...currentProgress.completedTopicIds];
  let newUnlockedTopics = [...currentProgress.unlockedTopicIds];

  if (topic) {
    const allSubTopicsDone = topic.subTopics.every(st => newCompletedSubTopics.includes(st.id));
    
    if (allSubTopicsDone) {
      if (!newCompletedTopics.includes(topicId)) {
        newCompletedTopics.push(topicId);
        const currentIdx = CURRICULUM.findIndex(t => t.id === topicId);
        const nextTopic = CURRICULUM[currentIdx + 1];
        if (nextTopic && !newUnlockedTopics.includes(nextTopic.id)) {
          newUnlockedTopics.push(nextTopic.id);
        }
      }
    }
  }

  const updated = {
    ...currentProgress,
    completedSubTopicIds: newCompletedSubTopics,
    completedTopicIds: newCompletedTopics,
    unlockedTopicIds: newUnlockedTopics,
    xp: currentProgress.xp + 50,
    wordsLearned: currentProgress.wordsLearned + 5
  };

  saveProgress(updated);
  return updated;
};

export const saveTopicHistory = (progress: UserProgress, subTopicId: string, messages: Message[]): UserProgress => {
  const updated = {
    ...progress,
    topicHistory: {
      ...progress.topicHistory,
      [subTopicId]: messages
    }
  };
  saveProgress(updated);
  return updated;
};

export const clearTopicHistory = (progress: UserProgress, subTopicId: string): UserProgress => {
  const newHistory = { ...progress.topicHistory };
  delete newHistory[subTopicId];
  
  const updated = {
    ...progress,
    topicHistory: newHistory
  };
  saveProgress(updated);
  return updated;
};
