import { Topic, UserLevel } from "../types";

export const CURRICULUM: Topic[] = [
  // --- BEGINNER (A1/A2) ---
  {
    id: 'module-1',
    title: 'Phonetics & Script',
    description: 'The Alphabet, Sounds, and Intonation.',
    emoji: '🗣️',
    requiredLevel: UserLevel.BEGINNER,
    order: 1,
    subTopics: [
      { id: '1.1', title: '1.1 The Alphabet', description: 'Writing & Reading characters.' },
      { id: '1.2', title: '1.2 Vowel Sounds', description: 'Vowels & Diacritics.' },
      { id: '1.3', title: '1.3 Consonants', description: 'Clusters & Difficult Sounds.' },
      { id: '1.4', title: '1.4 Intonation', description: 'Tone and Stress rules.' }
    ]
  },
  {
    id: 'module-2',
    title: 'Identity & Intro',
    description: 'Who you are and where you fit in.',
    emoji: '👋',
    requiredLevel: UserLevel.BEGINNER,
    order: 2,
    subTopics: [
      { id: '2.1', title: '2.1 Greetings', description: 'Morning, Noon, Night, Formal, Slang.' },
      { id: '2.2', title: '2.2 The Verb "To Be"', description: 'Ser/Estar & Self-Introduction.' },
      { id: '2.3', title: '2.3 Professions', description: 'Titles & Jobs.' },
      { id: '2.4', title: '2.4 Family', description: 'Immediate vs. Extended relationships.' }
    ]
  },
  {
    id: 'module-3',
    title: 'Survival Navigation',
    description: 'Numbers, Time, and Getting around.',
    emoji: '🧭',
    requiredLevel: UserLevel.BEGINNER,
    order: 3,
    subTopics: [
      { id: '3.1', title: '3.1 Numbers', description: 'Cardinals, Ordinals, Phone #s, Prices.' },
      { id: '3.2', title: '3.2 Time', description: 'Clock, Days, Months, Seasons.' },
      { id: '3.3', title: '3.3 Locations', description: 'City infrastructure & "Where is...?"' },
      { id: '3.4', title: '3.4 Transport', description: 'Bus, Train, Taxi, Tickets.' }
    ]
  },
  {
    id: 'module-4',
    title: 'The Physical World',
    description: 'Objects, Body, and Clothing.',
    emoji: '🌎',
    requiredLevel: UserLevel.BEGINNER,
    order: 4,
    subTopics: [
      { id: '4.1', title: '4.1 Colors & Shapes', description: 'Visual descriptions.' },
      { id: '4.2', title: '4.2 Common Objects', description: 'Classroom, Office, Daily items.' },
      { id: '4.3', title: '4.3 Clothing', description: 'Accessories & Weather-appropriate dressing.' },
      { id: '4.4', title: '4.4 The Body', description: 'Body parts & basic hygiene.' }
    ]
  },
  {
    id: 'module-5',
    title: 'Food & Dining',
    description: 'Ingredients, Restaurants, and Shopping.',
    emoji: '🥘',
    requiredLevel: UserLevel.BEGINNER,
    order: 5,
    subTopics: [
      { id: '5.1', title: '5.1 Ingredients', description: 'Fruits, Veggies, Meats, Dairy.' },
      { id: '5.2', title: '5.2 Utensils', description: 'Table Setting & Cutlery.' },
      { id: '5.3', title: '5.3 Restaurants', description: 'Ordering & Dietary restrictions.' },
      { id: '5.4', title: '5.4 Shopping', description: 'Supermarket, weights & measures.' }
    ]
  },
  {
    id: 'module-6',
    title: 'Basic Actions',
    description: 'Present tense and questions.',
    emoji: '⚡',
    requiredLevel: UserLevel.BEGINNER,
    order: 6,
    subTopics: [
      { id: '6.1', title: '6.1 Regular Verbs', description: 'Present Tense & Daily routine.' },
      { id: '6.2', title: '6.2 Irregular Verbs', description: 'Present Tense exceptions.' },
      { id: '6.3', title: '6.3 Negatives', description: 'Making negative statements.' },
      { id: '6.4', title: '6.4 Questions', description: 'Who, What, Where, When, Why, How.' }
    ]
  },

  // --- INTERMEDIATE (B1/B2) ---
  {
    id: 'module-7',
    title: 'Expanding Time',
    description: 'Past, Future, and Conditionals.',
    emoji: '⏳',
    requiredLevel: UserLevel.INTERMEDIATE,
    order: 7,
    subTopics: [
      { id: '7.1', title: '7.1 Past Tense', description: 'Completed actions (Preterite).' },
      { id: '7.2', title: '7.2 Imperfect Tense', description: 'Past habits & descriptions.' },
      { id: '7.3', title: '7.3 Future Tense', description: 'Plans & Predictions.' },
      { id: '7.4', title: '7.4 Conditional', description: 'Would, Could, Should.' }
    ]
  },
  {
    id: 'module-8',
    title: 'Home & Environment',
    description: 'Housing, Chores, and Nature.',
    emoji: '🏡',
    requiredLevel: UserLevel.INTERMEDIATE,
    order: 8,
    subTopics: [
      { id: '8.1', title: '8.1 Housing', description: 'Rent, furniture, rooms.' },
      { id: '8.2', title: '8.2 Chores', description: 'Maintenance & Cleaning.' },
      { id: '8.3', title: '8.3 Nature', description: 'Animals, landscapes, weather.' }
    ]
  },
  {
    id: 'module-9',
    title: 'Health & Emergency',
    description: 'Medical and Safety.',
    emoji: '🚑',
    requiredLevel: UserLevel.INTERMEDIATE,
    order: 9,
    subTopics: [
      { id: '9.1', title: '9.1 Pharmacy', description: 'Medicine & prescriptions.' },
      { id: '9.2', title: '9.2 Doctor', description: 'Symptoms, injuries, anatomy.' },
      { id: '9.3', title: '9.3 Emergency', description: 'Police, Fire, Theft reporting.' }
    ]
  },
  {
    id: 'module-10',
    title: 'Social & Opinions',
    description: 'Hobbies, Emotions, and Debate.',
    emoji: '🎭',
    requiredLevel: UserLevel.INTERMEDIATE,
    order: 10,
    subTopics: [
      { id: '10.1', title: '10.1 Hobbies', description: 'Sports, Music, Art.' },
      { id: '10.2', title: '10.2 Emotions', description: 'Joy, Anger, Fear, Surprise.' },
      { id: '10.3', title: '10.3 Debate', description: 'Agreeing, Disagreeing, Persuading.' },
      { id: '10.4', title: '10.4 Personality', description: 'Describing character.' }
    ]
  },

  // --- EXPERT (C1/C2) ---
  {
    id: 'module-11',
    title: 'Professional',
    description: 'Business and Career.',
    emoji: '💼',
    requiredLevel: UserLevel.EXPERT,
    order: 11,
    subTopics: [
      { id: '11.1', title: '11.1 Interviews', description: 'CVs & Job Interviews.' },
      { id: '11.2', title: '11.2 Negotiation', description: 'Business Etiquette.' },
      { id: '11.3', title: '11.3 Office', description: 'Admin & Tech terms.' },
      { id: '11.4', title: '11.4 Finance', description: 'Banking & Economy.' }
    ]
  },
  {
    id: 'module-12',
    title: 'Media & Events',
    description: 'Politics, Law, and News.',
    emoji: '📰',
    requiredLevel: UserLevel.EXPERT,
    order: 12,
    subTopics: [
      { id: '12.1', title: '12.1 Politics', description: 'Government & Systems.' },
      { id: '12.2', title: '12.2 Law', description: 'Justice vocabulary.' },
      { id: '12.3', title: '12.3 Sci-Tech', description: 'Trends & Innovation.' },
      { id: '12.4', title: '12.4 The News', description: 'Reading vs Watching.' }
    ]
  },
  {
    id: 'module-13',
    title: 'Culture & Idioms',
    description: 'Proverbs, Slang, and Humor.',
    emoji: '🎨',
    requiredLevel: UserLevel.EXPERT,
    order: 13,
    subTopics: [
      { id: '13.1', title: '13.1 Proverbs', description: 'Old Sayings.' },
      { id: '13.2', title: '13.2 Slang', description: 'Street Language by region.' },
      { id: '13.3', title: '13.3 Humor', description: 'Sarcasm & Irony.' },
      { id: '13.4', title: '13.4 Pop Culture', description: 'References & Trends.' }
    ]
  },
  {
    id: 'module-14',
    title: 'Complex Grammar',
    description: 'Subjunctive and Advanced Tenses.',
    emoji: '🧠',
    requiredLevel: UserLevel.EXPERT,
    order: 14,
    subTopics: [
      { id: '14.1', title: '14.1 Subjunctive', description: 'Wishes, doubts, hypotheticals.' },
      { id: '14.2', title: '14.2 Passive Voice', description: 'Active vs Passive.' },
      { id: '14.3', title: '14.3 Compounds', description: 'Compound Tenses.' }
    ]
  },
  {
    id: 'module-15',
    title: 'Arts & Literature',
    description: 'Analysis and Creative Writing.',
    emoji: '📚',
    requiredLevel: UserLevel.EXPERT,
    order: 15,
    subTopics: [
      { id: '15.1', title: '15.1 Analysis', description: 'Poetry & Prose.' },
      { id: '15.2', title: '15.2 History', description: 'Historical texts.' },
      { id: '15.3', title: '15.3 Writing', description: 'Creative Writing.' }
    ]
  }
];