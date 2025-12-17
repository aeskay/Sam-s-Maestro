import { GoogleGenAI, Modality, Type } from "@google/genai";
import { UserLevel, Message, Topic, QuizQuestion, Flashcard } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System instructions based on user level and Topic
const getSystemInstruction = (level: UserLevel, topic?: Topic, userName?: string) => {
  let base = `You are "Sam's Maestro", a friendly, encouraging, and world-class Spanish language tutor. 
  Your goal is to help the user${userName ? ` named ${userName}` : ''} learn Spanish through conversation.
  Keep your responses concise (under 3-4 sentences usually) to fit well on a mobile screen.
  Always correct the user's mistakes gently but clearly.`;

  if (topic) {
    base += `\n\nCURRENT LESSON TOPIC: "${topic.title}" - ${topic.description}.
    Focus the conversation strictly on this topic. Introduce vocabulary related to this topic.
    If the user strays, gently guide them back to ${topic.title}.`;
  }

  switch (level) {
    case UserLevel.BEGINNER:
      return `${base} 
      The user is a Beginner. Speak mostly in English (70%), introducing basic Spanish words and phrases related to the topic. 
      Translate any new Spanish words immediately.`;
    case UserLevel.INTERMEDIATE:
      return `${base} 
      The user is Intermediate. Speak 50/50 Spanish and English. 
      Challenge them with fuller sentences. Only translate complex phrases.`;
    case UserLevel.EXPERT:
      return `${base} 
      The user is an Expert. Speak almost entirely in Spanish (95%+). 
      Discuss nuances. Only switch to English if explicitly asked.`;
    default:
      return base;
  }
};

export async function sendMessageToGemini(
  history: Message[], 
  newMessage: string, 
  level: UserLevel,
  topic?: Topic,
  userName?: string
): Promise<string> {
  try {
    const model = "gemini-2.5-flash";
    const systemInstruction = getSystemInstruction(level, topic, userName);

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
      }
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "¡Hola! I'm having trouble connecting. ¿Puedes repetir?";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Lo siento, I encountered an error. Please try again.";
  }
}

export async function generateQuizForTopic(topic: Topic, level: UserLevel): Promise<QuizQuestion[]> {
  try {
    const prompt = `Generate 3 multiple-choice questions in Spanish to test the user's knowledge of the topic: "${topic.title}".
    The user level is ${level}.
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
              question: { type: Type.STRING, description: "The question text in Spanish" },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "4 possible answers"
              },
              correctAnswerIndex: { type: Type.INTEGER, description: "Index of the correct answer (0-3)" },
              explanation: { type: Type.STRING, description: "Explanation of why it is correct, in English" }
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
    return [
      {
        question: "¿Cómo se dice 'Hello'?",
        options: ["Adios", "Hola", "Gracias", "Por favor"],
        correctAnswerIndex: 1,
        explanation: "Hola means Hello."
      }
    ];
  }
}

export async function generateFlashcardsForTopic(topic: Topic, level: UserLevel): Promise<Flashcard[]> {
  try {
     const prompt = `Generate 5 flashcards for Spanish vocabulary related to the topic: "${topic.title}".
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
               front: { type: Type.STRING, description: "The Spanish word or phrase" },
               back: { type: Type.STRING, description: "The English translation" },
               example: { type: Type.STRING, description: "A simple example sentence in Spanish using the word" }
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
    return [
      { front: "Hola", back: "Hello", example: "Hola, amigo." },
      { front: "Gracias", back: "Thank you", example: "Muchas gracias." }
    ];
  }
}

export async function generateSpeechFromText(text: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        }
      }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
}