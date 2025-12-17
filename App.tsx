import React, { useState, useEffect, useRef } from 'react';
import { UserLevel, Message, AppView, Topic, QuizQuestion, Flashcard } from './types';
import { loadProgress, saveProgress, unlockNextTopic, saveTopicHistory } from './services/storage';
import { sendMessageToGemini, generateSpeechFromText, generateQuizForTopic, generateFlashcardsForTopic } from './services/gemini';
import { decodeAudioData, playAudioBuffer } from './services/audioUtils';

import LevelSelector from './components/LevelSelector';
import Dashboard from './components/Dashboard';
import MessageBubble from './components/MessageBubble';
import InputArea from './components/InputArea';
import Quiz from './components/Quiz';
import Flashcards from './components/Flashcards';
import ProfileModal from './components/ProfileModal';

const App: React.FC = () => {
  // State
  const [view, setView] = useState<AppView>(AppView.LEVEL_SELECT);
  const [progress, setProgress] = useState(loadProgress());
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  
  // UI State
  const [showProfile, setShowProfile] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [quizSuggestion, setQuizSuggestion] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  // Game State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoadingGame, setIsLoadingGame] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (progress.level) {
      setView(AppView.DASHBOARD);
    } else {
      setView(AppView.LEVEL_SELECT);
    }
  }, []);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const handleLevelSelect = (level: UserLevel) => {
    const newProgress = { ...progress, level };
    setProgress(newProgress);
    saveProgress(newProgress);
    setView(AppView.DASHBOARD);
  };

  const handleUpdateName = (name: string) => {
    const newProgress = { ...progress, userName: name };
    setProgress(newProgress);
    saveProgress(newProgress);
  };

  const handleTopicSelect = (topic: Topic) => {
    setCurrentTopic(topic);
    setView(AppView.CHAT);
    setQuizSuggestion(null); // Reset suggestion
    
    const existingHistory = progress.topicHistory?.[topic.id];
    
    if (existingHistory && existingHistory.length > 0) {
      setMessages(existingHistory);
    } else {
      const initialMessage: Message = {
        id: `init-${topic.id}-${Date.now()}`,
        role: 'model',
        text: `¡Hola ${progress.userName || ''}! Welcome to "${topic.title}". ${topic.description} Let's start!`,
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
      const updatedProgress = saveTopicHistory(progress, topic.id, [initialMessage]);
      setProgress(updatedProgress);
    }
  };

  const handleSendMessage = async (text: string) => {
    initAudioContext();
    if (!currentTopic) return;
    setQuizSuggestion(null); // Hide suggestion if chatting continues

    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    const messagesAfterUser = [...messages, newUserMsg];
    setMessages(messagesAfterUser);
    const progressAfterUser = saveTopicHistory(progress, currentTopic.id, messagesAfterUser);
    setProgress(progressAfterUser);
    setIsTyping(true);

    try {
      const response = await sendMessageToGemini(
        messagesAfterUser, 
        text, 
        progress.level!, 
        currentTopic, 
        progress.userName || undefined
      );
      
      const newAiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        timestamp: Date.now()
      };
      
      const messagesAfterAi = [...messagesAfterUser, newAiMsg];
      setMessages(messagesAfterAi);
      const progressAfterAi = saveTopicHistory(progressAfterUser, currentTopic.id, messagesAfterAi);
      setProgress(progressAfterAi);

      // Handle Quiz Suggestion
      if (response.suggestQuiz) {
        setQuizSuggestion(response.suggestionReason || "You've mastered this topic!");
      }

    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  // --- Game Handlers ---
  const handleStartQuiz = async () => {
    if (!currentTopic || !progress.level) return;
    setIsLoadingGame(true);
    setShowGameMenu(false);
    setQuizSuggestion(null);
    try {
      const questions = await generateQuizForTopic(currentTopic, progress.level);
      setQuizQuestions(questions);
      setView(AppView.QUIZ);
    } catch (e) {
      alert("Failed to load quiz.");
    } finally {
      setIsLoadingGame(false);
    }
  };

  const handleStartFlashcards = async () => {
    if (!currentTopic || !progress.level) return;
    setIsLoadingGame(true);
    setShowGameMenu(false);
    try {
      const cards = await generateFlashcardsForTopic(currentTopic, progress.level);
      setFlashcards(cards);
      setView(AppView.FLASHCARDS);
    } catch (e) {
      alert("Failed to load flashcards.");
    } finally {
      setIsLoadingGame(false);
    }
  };

  const handleQuizComplete = (score: number) => {
    if (score >= 2 && currentTopic) {
      const updated = unlockNextTopic(currentTopic.id, progress);
      setProgress(updated);
      alert(`¡Felicidades! You earned 100 XP & 15 Words!`);
    } else {
      alert(`Nice try! You got ${score}/3.`);
    }
    setView(AppView.DASHBOARD);
  };

  const handleFlashcardsComplete = () => {
    // Award small XP for reviewing
    const updated = { ...progress, xp: progress.xp + 20 };
    setProgress(updated);
    saveProgress(updated);
    alert("Flashcards reviewed! +20 XP");
    setView(AppView.DASHBOARD);
  };

  // --- Audio Player ---
  const handlePlayAudio = async (msg: Message) => {
    initAudioContext();
    if (!audioContextRef.current) return;
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch (e) {}
      activeSourceRef.current = null;
      setMessages(prev => prev.map(m => ({ ...m, isAudioPlaying: false })));
      if (msg.isAudioPlaying) return;
    }
    setLoadingAudioId(msg.id);
    try {
      let buffer = msg.audioBuffer;
      if (!buffer) {
        const base64Data = await generateSpeechFromText(msg.text);
        if (base64Data) {
          buffer = await decodeAudioData(base64Data, audioContextRef.current);
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, audioBuffer: buffer } : m));
        }
      }
      if (buffer) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAudioPlaying: true } : { ...m, isAudioPlaying: false }));
        setLoadingAudioId(null);
        activeSourceRef.current = playAudioBuffer(audioContextRef.current, buffer, () => {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAudioPlaying: false } : m));
          activeSourceRef.current = null;
        });
      }
    } catch (e) {
      setLoadingAudioId(null);
      setMessages(prev => prev.map(m => ({ ...m, isAudioPlaying: false })));
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, quizSuggestion]);

  // --- Renders ---

  // Check if we need to show profile modal for first time users
  if (view === AppView.DASHBOARD && !progress.userName && !showProfile) {
     // Force open profile if no name
     setTimeout(() => setShowProfile(true), 500);
  }

  if (view === AppView.LEVEL_SELECT) {
    return <LevelSelector onSelect={handleLevelSelect} />;
  }

  if (view === AppView.DASHBOARD) {
    return (
      <>
        {showProfile && (
          <ProfileModal 
            progress={progress} 
            onClose={() => setShowProfile(false)} 
            onUpdateName={handleUpdateName} 
          />
        )}
        <Dashboard 
          progress={progress} 
          onSelectTopic={handleTopicSelect}
          onReset={() => {
            localStorage.clear();
            window.location.reload();
          }}
          onOpenProfile={() => setShowProfile(true)}
        />
      </>
    );
  }

  if (view === AppView.QUIZ) {
    return <Quiz questions={quizQuestions} onComplete={handleQuizComplete} onCancel={() => setView(AppView.DASHBOARD)} />;
  }

  if (view === AppView.FLASHCARDS) {
    return <Flashcards cards={flashcards} onComplete={handleFlashcardsComplete} onClose={() => setView(AppView.DASHBOARD)} />;
  }

  // Chat View
  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <header className="flex-none bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm z-10 relative">
        <button onClick={() => setView(AppView.DASHBOARD)} className="text-gray-500 hover:text-emerald-600 flex items-center gap-1">
           <span className="text-xl">‹</span> Back
        </button>
        <div className="text-center truncate px-2">
          <h1 className="font-bold text-gray-800 text-sm md:text-base truncate">{currentTopic?.title}</h1>
        </div>
        
        {/* Play Menu Button */}
        <div className="relative">
          <button 
            onClick={() => setShowGameMenu(!showGameMenu)}
            disabled={isLoadingGame}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all flex-shrink-0 ${
              isLoadingGame 
                ? 'bg-gray-100 text-gray-400'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
             {isLoadingGame ? 'Loading...' : '🎮 Play'}
          </button>

          {/* Dropdown Menu */}
          {showGameMenu && (
             <>
               <div className="fixed inset-0 z-10" onClick={() => setShowGameMenu(false)}></div>
               <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-20 animate-fade-in">
                  <button 
                    onClick={handleStartFlashcards}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-emerald-50 text-gray-700 text-sm font-medium flex items-center gap-2"
                  >
                    🎴 Flashcards
                  </button>
                  <button 
                    onClick={handleStartQuiz}
                    disabled={messages.length < 2} // Need some context
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
                        messages.length < 2 ? 'text-gray-300' : 'hover:bg-emerald-50 text-gray-700'
                    }`}
                  >
                    📝 Take Quiz
                  </button>
               </div>
             </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 scroll-smooth no-scrollbar max-w-2xl mx-auto w-full relative">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onPlayAudio={handlePlayAudio} isLoadingAudio={loadingAudioId === msg.id} />
        ))}
        {isTyping && <div className="text-xs text-gray-400 ml-4 animate-pulse">Sam's Maestro is typing...</div>}
        
        {/* AI Suggestion Bubble */}
        {quizSuggestion && !isTyping && (
          <div className="mx-4 mt-6 mb-2 animate-slide-up">
            <div className="bg-gradient-to-r from-amber-100 to-orange-100 border border-orange-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <h3 className="font-bold text-orange-900 text-sm mb-1">Lesson Complete!</h3>
                  <p className="text-orange-800 text-xs mb-3">{quizSuggestion}</p>
                  <button 
                    onClick={handleStartQuiz}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors shadow-sm"
                  >
                    Take Quiz to Unlock Next Level
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <InputArea onSend={handleSendMessage} disabled={isTyping} />
    </div>
  );
};

export default App;