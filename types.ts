export enum UserLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  EXPERT = 'Expert',
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isAudioPlaying?: boolean;
  audioBuffer?: AudioBuffer | null;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number; // 0-3
  explanation: string;
}

export interface Flashcard {
  front: string; // Spanish word/phrase
  back: string; // English translation
  example: string; // Example sentence in Spanish
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  emoji: string;
  requiredLevel: UserLevel; // Minimum level recommendation
  order: number;
}

export interface UserProgress {
  userName: string | null;
  level: UserLevel | null;
  xp: number;
  streak: number;
  lastLoginDate: string | null; // ISO Date string
  wordsLearned: number;
  completedTopicIds: string[];
  unlockedTopicIds: string[];
  topicHistory: Record<string, Message[]>; // Persist chat history per topic
}

export enum AppView {
  LEVEL_SELECT = 'LEVEL_SELECT',
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  QUIZ = 'QUIZ',
  FLASHCARDS = 'FLASHCARDS'
}