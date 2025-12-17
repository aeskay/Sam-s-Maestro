import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";
import { UserLevel, Message, Topic, SubTopic, QuizQuestion, Flashcard } from "../types";

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

// Helper: Extract JSON from Markdown code blocks or return trimmed text
const cleanJson = (text: string): string => {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  if (match) {
    return match[1].trim();
  }
  return text.trim();
};

// Helper: Retry logic for API calls
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retrying Gemini call after error: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise(res => setTimeout(res, delay));
      return callWithRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

const getSystemInstruction = (level: UserLevel, topic?: Topic, subTopic?: SubTopic, userName?: string) => {
  let base = `You are "Sam's Maestro", a friendly, encouraging, and world-class Spanish language tutor. 
  Your goal is to help the user${userName ? ` named ${userName}` : ''} master Spanish from absolute zero to native fluency.
  
  CORE RULE: EXHAUSTIVE DEPTH. NO SKIMMING.
  You may only teach ONE concept at a time. Do not dump a list of vocabulary.
  Keep individual responses concise (2-3 sentences), but cover the topic deeply over multiple turns.`;

  if (topic && subTopic) {
    base += `\n\nCURRENT LESSON CONTEXT:
    [Current Level: ${level} | Module: ${subTopic.title} - ${topic.title}]
    Description: ${subTopic.description}
    
    YOU MUST FOLLOW THIS 5-STEP LESSON STRUCTURE FOR THIS SUB-TOPIC:
    1. Vocabulary Injection: Introduce relevant words/phrases gradually.
    2. Grammar Hook: Explain the specific grammar rule in this context.
    3. Cultural Nuance: How do natives actually say this? (Slang vs Formal).
    4. Immersion Drill: Engage the user in a roleplay dialogue.
    5. Assessment: When they succeed in the drill, call 'suggest_quiz'.

    MANDATORY OUTPUT FORMAT:
    Start every response with exactly this tag: [${subTopic.title}]
    Example: "[1.1 The Alphabet] Great work! Now let's look at vowels..."
    `;
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
    try {
      // Use 'gemini-3-flash-preview' for basic text/chat tasks
      const modelName = "gemini-3-flash-preview";
      const systemInstruction = getSystemInstruction(level, topic, subTopic, userName);

      // Filter history to ensure the current newMessage isn't duplicated
      const recentHistory = history
        .filter(msg => msg.text !== newMessage)
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        }));

      const chat = ai.chats.create({
        model: modelName,
        history: recentHistory,
        config: {
          systemInstruction,
          temperature: 0.7, 
          tools: [{ functionDeclarations: [suggestQuizTool] }]
        }
      });

      const result = await chat.sendMessage({ message: newMessage });
      
      const functionCall = result.functionCalls?.find(fc => fc.name === 'suggest_quiz');
      const suggestQuiz = !!functionCall;
      const suggestionReason = functionCall?.args?.reason as string | undefined;

      return {
        text: result.text || "",
        suggestQuiz,
        suggestionReason
      };

    } catch (error) {
      console.error("Gemini Chat Error:", error);
      throw error;
    }
  });
}

export async function generateQuizForTopic(topic: Topic, subTopic: SubTopic, level: UserLevel): Promise<QuizQuestion[]> {
  return callWithRetry(async () => {
    try {
      const prompt = `Generate 10 multiple-choice questions in Spanish to test the user's knowledge of the specific sub-module: "${subTopic.title}" (Context: ${topic.title}).
      Ensure questions cover vocabulary, grammar, and cultural nuances taught in this module.
      User Level: ${level}.`;

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
                question: { type: Type.STRING, description: "Question in Spanish" },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswerIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING, description: "Explanation in English" }
              },
              required: ["question", "options", "correctAnswerIndex", "explanation"]
            }
          }
        }
      });

      const text = response.text || "";
      const cleanedText = cleanJson(text);
      return JSON.parse(cleanedText) as QuizQuestion[];

    } catch (e) {
      console.error("Quiz generation failed:", e);
      throw e;
    }
  });
}

export async function generateFlashcardsForTopic(topic: Topic, subTopic: SubTopic, level: UserLevel): Promise<Flashcard[]> {
  return callWithRetry(async () => {
    try {
      const prompt = `Generate 10 flashcards for Spanish vocabulary strictly related to Module: "${subTopic.title}" (${subTopic.description}).
      Include a mix of core vocabulary and slang/cultural terms if relevant.
      User Level: ${level}.`;

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

      const text = response.text || "";
      const cleanedText = cleanJson(text);
      return JSON.parse(cleanedText) as Flashcard[];
    } catch (e) {
      console.error("Flashcard generation failed:", e);
      throw e;
    }
  });
}

export async function generateSpeechFromText(text: string, voiceName: string = 'Kore'): Promise<string | null> {
  const cleanText = text.replace(/\[.*?\]/, '').trim();

  return callWithRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: cleanText }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } }
          }
        }
      });

      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (error) {
      console.error("Gemini TTS Error:", error);
      throw error;
    }
  }, 2, 500);
}