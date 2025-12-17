import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";
import { UserLevel, Message, Topic, SubTopic, QuizQuestion, Flashcard } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const suggestQuizTool: FunctionDeclaration = {
  name: "suggest_quiz",
  description: "Call this function when the user has demonstrated sufficient understanding of the specific sub-topic lesson and should take a quiz to advance.",
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

// Updated to accept SubTopic
const getSystemInstruction = (level: UserLevel, topic?: Topic, subTopic?: SubTopic, userName?: string) => {
  let base = `You are "Sam's Maestro", a friendly, encouraging, and world-class Spanish language tutor. 
  Your goal is to help the user${userName ? ` named ${userName}` : ''} learn Spanish.
  Keep your responses concise (under 3-4 sentences).`;

  if (topic && subTopic) {
    base += `\n\nCURRENT LESSON: "${topic.title}" -> "${subTopic.title}".
    DESCRIPTION: ${subTopic.description}.
    
    Focus ONLY on the vocabulary and phrases for "${subTopic.title}". 
    Do not drift to other parts of the main topic yet.
    
    PROGRESSION LOGIC:
    1. Teach the specific concepts of this sub-lesson.
    2. Correct mistakes gently.
    3. After 3-5 exchanges where the user correctly uses the specific vocabulary for this sub-lesson, call 'suggest_quiz'.`;
  }

  switch (level) {
    case UserLevel.BEGINNER:
      return `${base} 
      User is Beginner. Explain in English, practice in Spanish. Translate new words immediately.`;
    case UserLevel.INTERMEDIATE:
      return `${base} 
      User is Intermediate. 50/50 English/Spanish.`;
    case UserLevel.EXPERT:
      return `${base} 
      User is Expert. 95% Spanish.`;
    default:
      return base;
  }
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
  try {
    const model = "gemini-2.5-flash";
    const systemInstruction = getSystemInstruction(level, topic, subTopic, userName);

    const recentHistory = history.slice(-10).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
      model,
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
    return {
      text: "Lo siento, I encountered an error. Please try again.",
      suggestQuiz: false
    };
  }
}

// Updated to generate quiz specific to SubTopic
export async function generateQuizForTopic(topic: Topic, subTopic: SubTopic, level: UserLevel): Promise<QuizQuestion[]> {
  try {
    const prompt = `Generate 3 multiple-choice questions in Spanish to test the user's knowledge of the specific lesson: "${topic.title} - ${subTopic.title}".
    Context/Vocab: ${subTopic.description}.
    User Level: ${level}.
    Return strictly JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

    if (response.text) {
      return JSON.parse(response.text) as QuizQuestion[];
    }
    throw new Error("No text returned");
  } catch (e) {
    console.error("Quiz generation failed", e);
    return [{
        question: "Error generating quiz",
        options: ["OK"],
        correctAnswerIndex: 0,
        explanation: "Please try again."
    }];
  }
}

export async function generateFlashcardsForTopic(topic: Topic, subTopic: SubTopic, level: UserLevel): Promise<Flashcard[]> {
  try {
     const prompt = `Generate 5 flashcards for Spanish vocabulary strictly related to: "${subTopic.title}" (${subTopic.description}).
     User Level: ${level}.
     Return strictly JSON.`;

     const response = await ai.models.generateContent({
       model: "gemini-2.5-flash",
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

    if (response.text) {
      return JSON.parse(response.text) as Flashcard[];
    }
    throw new Error("No text returned for flashcards");
  } catch (e) {
    console.error("Flashcard generation failed", e);
    return [];
  }
}

export async function generateSpeechFromText(text: string, voiceName: string = 'Kore'): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
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
    return null;
  }
}