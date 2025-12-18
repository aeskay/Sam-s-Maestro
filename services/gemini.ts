
import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage } from "@google/genai";
import { UserLevel, Message, Topic, SubTopic, QuizQuestion, Flashcard } from "../types";

// Always use process.env.API_KEY directly as per standard integration guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
 * Manual Base64 decoding as per guidelines
 */
function decodeBase64Manual(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Manual Base64 encoding as per guidelines
 */
function encodeBase64Manual(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
  const result: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
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

  // Gemini API sendMessage adds a 'user' turn automatically, 
  // so the history passed to chats.create MUST end with a 'model' turn.
  if (result.length > 0 && result[result.length - 1].role === 'user') {
    result.pop();
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
    let languageGuideline = "";
    if (level === UserLevel.BEGINNER) {
      languageGuideline = `
      MANDATORY BEGINNER RULES:
      1. THE 'question' FIELD MUST BE IN ENGLISH.
      2. THE 'options' MUST BE IN ENGLISH (except for the Spanish word being tested).
      3. THE 'explanation' MUST BE IN ENGLISH.
      Example Question: 'What is the Spanish word for "Apple"?'
      Example Options: ['Manzana', 'Pera', 'Naranja', 'Uva']
      DO NOT ASK QUESTIONS IN SPANISH FOR BEGINNERS.`;
    } else if (level === UserLevel.INTERMEDIATE) {
      languageGuideline = "Use a mix of English and Spanish for questions. Options should mostly be in Spanish.";
    } else {
      languageGuideline = "Use Spanish only for everything (Advanced/Expert).";
    }

    const prompt = `Generate exactly 10 multiple-choice questions for: "${subTopic.title}" within the context of "${topic.title}".
    Target Proficiency: ${level}.
    ${languageGuideline}`;

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
  const cleanText = text
    .replace(/\[.*?\]/g, '')
    .replace(/[*_#`~]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();
  
  if (!cleanText || cleanText.length < 2) return null;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{
        parts: [{ text: `Say: ${cleanText}` }]
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

/**
 * LIVE API Support
 */
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
  const systemInstruction = getSystemInstruction(level, topic, subTopic, userName) + 
    "\n\nLIVE MODE: You are in a voice call. Speak naturally. Use short sentences. Provide instant audio feedback.";

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
      onopen: () => {
        console.log("Live Maestro Session Opened");
      },
      onmessage: async (message: LiveServerMessage) => {
        if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
          callbacks.onAudio(message.serverContent.modelTurn.parts[0].inlineData.data);
        }
        if (message.serverContent?.outputTranscription) {
          callbacks.onTranscription(message.serverContent.outputTranscription.text, true);
        }
        if (message.serverContent?.inputTranscription) {
          callbacks.onTranscription(message.serverContent.inputTranscription.text, false);
        }
        if (message.serverContent?.turnComplete) {
          callbacks.onTurnComplete();
        }
      },
      onerror: callbacks.onError,
      onclose: () => {
        console.log("Live Maestro Session Closed");
      }
    }
  });
};

export { decodeBase64Manual as decode, encodeBase64Manual as encode };
