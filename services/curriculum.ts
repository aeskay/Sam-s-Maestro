import { Topic, UserLevel } from "../types";

export const CURRICULUM: Topic[] = [
  {
    id: 'greetings',
    title: 'Greetings & Intros',
    description: 'Hola! Learn to say hello, goodbye, and introduce yourself.',
    emoji: '👋',
    requiredLevel: UserLevel.BEGINNER,
    order: 1
  },
  {
    id: 'food',
    title: 'Ordering Food',
    description: 'Tacos, coffee, and restaurant etiquette.',
    emoji: '🌮',
    requiredLevel: UserLevel.BEGINNER,
    order: 2
  },
  {
    id: 'directions',
    title: 'Getting Around',
    description: 'Where is the library? Asking for directions.',
    emoji: '🗺️',
    requiredLevel: UserLevel.BEGINNER,
    order: 3
  },
  {
    id: 'past-tense',
    title: 'Talking about Yesterday',
    description: 'Preterite vs Imperfect. The hard stuff!',
    emoji: '🕰️',
    requiredLevel: UserLevel.INTERMEDIATE,
    order: 4
  },
  {
    id: 'future',
    title: 'Dreams & Plans',
    description: 'Using the future tense and conditional.',
    emoji: '🚀',
    requiredLevel: UserLevel.INTERMEDIATE,
    order: 5
  },
  {
    id: 'business',
    title: 'Business Spanish',
    description: 'Formal language for professional settings.',
    emoji: '💼',
    requiredLevel: UserLevel.EXPERT,
    order: 6
  },
  {
    id: 'idioms',
    title: 'Slang & Idioms',
    description: 'Speak like a true local.',
    emoji: '🔥',
    requiredLevel: UserLevel.EXPERT,
    order: 7
  }
];