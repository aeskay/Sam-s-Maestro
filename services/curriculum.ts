import { Topic, UserLevel } from "../types";

export const CURRICULUM: Topic[] = [
  {
    id: 'greetings',
    title: 'Greetings & Intros',
    description: 'Master the art of saying hello and introducing yourself.',
    emoji: '👋',
    requiredLevel: UserLevel.BEGINNER,
    order: 1,
    subTopics: [
      { id: 'greetings-1', title: 'The Basics', description: 'Hola, Adiós, Por favor, Gracias.' },
      { id: 'greetings-2', title: 'How are you?', description: 'Asking ¿Cómo estás? and replying Bien/Mal.' },
      { id: 'greetings-3', title: 'Identity', description: 'Me llamo..., Mucho gusto (Nice to meet you).' },
      { id: 'greetings-4', title: 'Origins', description: 'Asking ¿De dónde eres? (Where are you from?).' },
      { id: 'greetings-5', title: 'Time of Day', description: 'Buenos días, Buenas tardes, Buenas noches.' }
    ]
  },
  {
    id: 'food',
    title: 'Ordering Food',
    description: 'Navigating menus and restaurants.',
    emoji: '🌮',
    requiredLevel: UserLevel.BEGINNER,
    order: 2,
    subTopics: [
      { id: 'food-1', title: 'Basic Foods', description: 'Agua, Pan, Carne, Fruta.' },
      { id: 'food-2', title: 'I want...', description: 'Using "Quiero" and "Me gustaría".' },
      { id: 'food-3', title: 'At the Table', description: 'Fork, knife, napkin, and "The check, please".' }
    ]
  },
  {
    id: 'directions',
    title: 'Getting Around',
    description: 'asking for directions and travel.',
    emoji: '🗺️',
    requiredLevel: UserLevel.BEGINNER,
    order: 3,
    subTopics: [
      { id: 'directions-1', title: 'Places', description: 'Donde está el baño, hotel, banco?' },
      { id: 'directions-2', title: 'Directions', description: 'Izquierda, Derecha, Derecho (Left, Right, Straight).' }
    ]
  },
  {
    id: 'past-tense',
    title: 'Yesterday',
    description: 'Preterite vs Imperfect.',
    emoji: '🕰️',
    requiredLevel: UserLevel.INTERMEDIATE,
    order: 4,
    subTopics: [
      { id: 'past-1', title: 'I did it', description: 'Basic Preterite (Comí, Hablé).' },
      { id: 'past-2', title: 'I used to...', description: 'Basic Imperfect (Comía, Hablaba).' }
    ]
  },
  {
    id: 'future',
    title: 'Dreams & Plans',
    description: 'Future tense and conditional.',
    emoji: '🚀',
    requiredLevel: UserLevel.INTERMEDIATE,
    order: 5,
    subTopics: [
        { id: 'future-1', title: 'I will', description: 'Simple future tense.' }
    ]
  },
  {
    id: 'business',
    title: 'Business Spanish',
    description: 'Professional settings.',
    emoji: '💼',
    requiredLevel: UserLevel.EXPERT,
    order: 6,
    subTopics: [
        { id: 'biz-1', title: 'The Meeting', description: 'Formal greetings and scheduling.' }
    ]
  }
];