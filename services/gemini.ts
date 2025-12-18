import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";
import { UserLevel, Message, Topic, SubTopic, QuizQuestion, Flashcard } from "../types";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set. Please configure it in your environment settings.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const suggestQuizTool: FunctionDeclaration = {
  name: "suggest_quiz",
  description: "Call this function ONLY when the user has completed the Immersion Drill and is ready for the Assessment.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: "A short encouraging reason why they are ready."
      }
    }
  }
};

/**
 * Helper: Extracts JSON from a string, handling markdown blocks if present.
 */
const robustParseJson = <T>(text: string | undefined): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        return JSON.parse(match[1].trim());
      }
    } catch (e2) {
      console.error("JSON Parsing Error:", e2);
    }
    return null;
  }
};

/**
 * Helper: Ensures chat history strictly alternates between 'user' and 'model' roles.
 */
const prepareHistory = (history: Message[]) => {
  const result: { role: string; parts: { text: string }[] }[] = [];
  let lastRole: string | null = null;

  for (const msg of history) {
    if (msg.role !== lastRole) {
      result.push({
        role: msg.role,
        parts: [{ text: msg.text }]
      });
      lastRole = msg.role;
    }
  }
  return result;
};

// Helper: Retry logic for API calls with exponential backoff
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 1500): Promise<T> {
  let delay = initialDelay;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = i === retries;
      const status = error?.status || error?.response?.status;
      
      if (!isLastAttempt && (status === 429 || status >= 500 || error.message?.includes('fetch'))) {
        console.warn(`Retry attempt ${i + 1} after error: ${error.message}`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Maximum retries exceeded");
}

const getSystemInstruction = (level: UserLevel, topic?: Topic, subTopic?: SubTopic, userName?: string) => {
  let base = `You are "Sam's Maestro", a world-class Spanish language tutor. 
  Your goal is to help ${userName || 'the user'} master Spanish from ${level} level.
  
  CORE RULE: ONE CONCEPT AT A TIME. 
  Keep responses concise (max 3 sentences) but provide deep explanation over multiple turns.
  Always be encouraging. Use a mix of Spanish and English appropriate for their level.`;

  if (topic && subTopic) {
    base += `\n\nCURRENT LESSON:
    [Topic: ${topic.title} | Sub-Topic: ${subTopic.title}]
    Goal: ${subTopic.description}
    
    STRUCTURE:
    1. Vocab -> 2. Grammar -> 3. Culture -> 4. Drill (Roleplay) -> 5. Assessment.
    
    When you feel they've mastered the drill for THIS specific sub-topic, call the 'suggest_quiz' tool.
    
    MANDATORY: Start every message with [${subTopic.title}].`;
  }

  return base;
};

export interface ChatResponse {
  text: string;
  suggestQuiz: boolean;
  suggestionReason?: string;
}

export async function sendMessageToGemini(
  history: Message[], 
  newMessage: string, 
  level: UserLevel,
  topic?: Topic,
  subTopic?: SubTopic,
  userName?: string
): Promise<ChatResponse> {
  return callWithRetry(async () => {
    const model = "gemini-3-flash-preview";
    const systemInstruction = getSystemInstruction(level, topic, subTopic, userName);
    const formattedHistory = prepareHistory(history.slice(-12));

    const chat = ai.chats.create({
      model,
      history: formattedHistory,
      config: {
        systemInstruction,
        temperature: 0.8,
        tools: [{ functionDeclarations: [suggestQuizTool] }]
      }
    });

    const result = await chat.sendMessage({ message: newMessage });
    
    const functionCall = result.functionCalls?.find(fc => fc.name === 'suggest_quiz');
    const suggestQuiz = !!functionCall;
    const suggestionReason = functionCall?.args?.reason as string | undefined;

    return {
      text: result.text || "Lo siento, I couldn't process that. Try again?",
      suggestQuiz,
      suggestionReason
    };
  });
}

export async function generateQuizForTopic(topic: Topic, subTopic: SubTopic, level: UserLevel): Promise<QuizQuestion[]> {
  return callWithRetry(async () => {
    const prompt = `Generate exactly 10 multiple-choice questions in Spanish testing: "${subTopic.title}" within the context of "${topic.title}".
    Target Level: ${level}.
    Coverage: Vocabulary, Grammar, and Usage.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswerIndex", "explanation"]
          }
        }
      }
    });

    const parsed = robustParseJson<QuizQuestion[]>(response.text);
    if (!parsed || !Array.isArray(parsed)) throw new Error("Invalid Quiz JSON or empty response");
    return parsed;
  });
}

export async function generateFlashcardsForTopic(topic: Topic, subTopic: SubTopic, level: UserLevel): Promise<Flashcard[]> {
  return callWithRetry(async () => {
    const prompt = `Generate exactly 10 Spanish vocabulary flashcards for: "${subTopic.title}" (${subTopic.description}).
    Level: ${level}.
    Include a front (Spanish), back (English), and a natural example sentence in Spanish.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING },
              example: { type: Type.STRING }
            },
            required: ["front", "back", "example"]
          }
        }
      }
    });

    const parsed = robustParseJson<Flashcard[]>(response.text);
    if (!parsed || !Array.isArray(parsed)) throw new Error("Invalid Flashcards JSON or empty response");
    return parsed;
  });
}

export async function generateSpeechFromText(text: string, voiceName: string = 'Kore'): Promise<string | null> {
  // Deep clean text for TTS to avoid model rejection
  const cleanText = text
    .replace(/\[.*?\]/g, '') // Remove [1.1 Greetings]
    .replace(/[*_#`~]/g, '') // Remove markdown formatting
    .replace(/\(.*?\)/g, '') // Remove parentheticals
    .trim();
  
  if (!cleanText || cleanText.length < 2) return null;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{
        parts: [{ text: `Say: ${cleanText}` }] // Concise instruction
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } }
        }
      }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error("TTS Model returned non-audio response content.");
    }
    return audioData;
  }, 2, 800);
}