import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage } from "@google/genai";
import { UserLevel, Message, Topic, SubTopic, QuizQuestion, Flashcard } from "../types";

/**
 * Helper to safely get an AI instance.
 */
const getAI = () => {
  const apiKey = process.env.API_KEY!;
  if (!apiKey) {
    throw new Error('API_KEY is not defined in the environment.');
  }
  return new GoogleGenAI({ apiKey });
};

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

function decodeBase64Manual(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64Manual(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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

const prepareHistory = (history: Message[]) => {
  const result: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  let lastRole: string | null = null;

  for (const msg of history) {
    if (msg.role !== lastRole) {
      result.push({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.text }]
      });
      lastRole = msg.role;
    }
  }

  if (result.length > 0 && result[result.length - 1].role === 'user') {
    result.pop();
  }

  return result;
};

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 1500): Promise<T> {
  let delay = initialDelay;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = i === retries;
      const status = error?.status || error?.response?.status;
      if (!isLastAttempt && (status === 429 || status >= 500 || error.message?.includes('fetch'))) {
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
  
  BILINGUAL SCAFFOLDING RULES (STRICT ADHERENCE):
  - IF Level is Beginner: Speak Spanish ONLY for the specific vocabulary being taught. Explain everything else in English. Every time you say something in Spanish, IMMEDIATELY follow it with the English translation in parentheses. Example: "Hola (Hello), how are you today?"
  - IF Level is Intermediate: Speak 50% Spanish, 50% English. Provide translations for any complex Spanish sentences. Use English to explain grammar.
  - IF Level is Expert: Speak 100% Spanish.
  
  CORE RULE: ONE CONCEPT AT A TIME. Keep responses short. 
  MANDATORY: Start every message with [${subTopic?.title || 'Maestro'}].`;

  if (topic && subTopic) {
    base += `\n\nCURRENT LESSON: [Topic: ${topic.title} | Sub-Topic: ${subTopic.title}] Goal: ${subTopic.description}`;
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
    const ai = getAI();
    const model = "gemini-3-flash-preview";
    const systemInstruction = getSystemInstruction(level, topic, subTopic, userName);
    const formattedHistory = prepareHistory(history.slice(-20));

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

    return {
      text: result.text || "Lo siento, I couldn't process that. Try again?",
      suggestQuiz: !!functionCall,
      suggestionReason: functionCall?.args?.reason as string | undefined
    };
  });
}

export async function generateQuizForTopic(topic: Topic, subTopic: SubTopic, level: UserLevel): Promise<QuizQuestion[]> {
  return callWithRetry(async () => {
    const ai = getAI();
    const prompt = `Generate 10 multiple-choice questions for: "${subTopic.title}" at ${level} level. 
    If Beginner: Questions and options must be in English (except Spanish vocab being tested).
    If Expert: Everything in Spanish. Return as JSON array.`;

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
    if (!parsed) throw new Error("Invalid Quiz JSON");
    return parsed;
  });
}

export async function generateFlashcardsForTopic(topic: Topic, subTopic: SubTopic, level: UserLevel): Promise<Flashcard[]> {
  return callWithRetry(async () => {
    const ai = getAI();
    const prompt = `Generate 10 Spanish flashcards for: "${subTopic.title}" at ${level} level. 
    Front: Spanish word/phrase. Back: English translation. Example: A simple sentence using the word in Spanish.`;
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
    if (!parsed) throw new Error("Invalid Flashcards JSON");
    return parsed;
  });
}

export async function generateSpeechFromText(text: string, voiceName: string = 'Kore'): Promise<string | null> {
  const cleanText = text.replace(/\[.*?\]/g, '').replace(/[*_#`~]/g, '').trim();
  if (!cleanText) return null;

  return callWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say: ${cleanText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } }
        }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  });
}

export const connectLiveMaestro = (
  level: UserLevel,
  topic: Topic,
  subTopic: SubTopic,
  userName: string,
  voiceName: string,
  callbacks: {
    onAudio: (base64: string) => void,
    onTranscription: (text: string, isModel: boolean) => void,
    onTurnComplete: () => void,
    onError: (err: any) => void
  }
) => {
  const ai = getAI();
  const systemInstruction = getSystemInstruction(level, topic, subTopic, userName) + 
    "\nLIVE VOICE MODE: You are currently talking to the user. " +
    "IF USER IS BEGINNER OR INTERMEDIATE: ALWAYS say a sentence in Spanish, then IMMEDIATELY repeat it in English for comprehension. Example: '¿Cómo estás? How are you?'";

  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      systemInstruction,
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } }
      },
      outputAudioTranscription: {},
      inputAudioTranscription: {}
    },
    callbacks: {
      onopen: () => console.log("Live Opened"),
      onmessage: async (message: LiveServerMessage) => {
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          callbacks.onAudio(audioData);
        }

        const outputTranscription = message.serverContent?.outputTranscription?.text;
        if (outputTranscription) {
          callbacks.onTranscription(outputTranscription, true);
        }

        const inputTranscription = message.serverContent?.inputTranscription?.text;
        if (inputTranscription) {
          callbacks.onTranscription(inputTranscription, false);
        }

        if (message.serverContent?.turnComplete) {
          callbacks.onTurnComplete();
        }
      },
      onerror: callbacks.onError,
      onclose: () => console.log("Live Closed")
    }
  });
};

export { decodeBase64Manual as decode, encodeBase64Manual as encode };
