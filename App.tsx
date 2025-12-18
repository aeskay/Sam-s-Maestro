import React, { useState, useEffect, useRef } from 'react';
import { UserLevel, Message, AppView, Topic, SubTopic, QuizQuestion, Flashcard, UserPreferences } from './types';
import { loadProgress, saveProgress, completeSubTopic, saveTopicHistory, clearTopicHistory } from './services/storage';
import { sendMessageToGemini, generateSpeechFromText, generateQuizForTopic, generateFlashcardsForTopic, connectLiveMaestro, encode } from './services/gemini';
import { decodeAudioData, playAudioBuffer } from './services/audioUtils';
import { CURRICULUM } from './services/curriculum';

import LevelSelector from './components/LevelSelector';
import Dashboard from './components/Dashboard';
import MessageBubble from './components/MessageBubble';
import InputArea from './components/InputArea';
import Quiz from './components/Quiz';
import Flashcards from './components/Flashcards';
import ProfileModal from './components/ProfileModal';
import SettingsModal from './components/SettingsModal';

const App: React.FC = () => {
  // State
  const [view, setView] = useState<AppView>(AppView.LEVEL_SELECT);
  const [progress, setProgress] = useState(loadProgress());
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  const [currentSubTopic, setCurrentSubTopic] = useState<SubTopic | null>(null);
  
  // UI State
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [quizSuggestion, setQuizSuggestion] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  // Live Mode State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState("");
  const [liveSession, setLiveSession] = useState<any>(null);
  const nextStartTimeRef = useRef(0);

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

  const handleUpdateLevel = (level: UserLevel) => {
     const newProgress = { ...progress, level };
     setProgress(newProgress);
     saveProgress(newProgress);
  };

  const handleUpdatePreferences = (prefs: UserPreferences) => {
    const newProgress = { ...progress, preferences: prefs };
    setProgress(newProgress);
    saveProgress(newProgress);
  };

  const handleTopicSelect = (topic: Topic, subTopic: SubTopic) => {
    setCurrentTopic(topic);
    setCurrentSubTopic(subTopic);
    setView(AppView.CHAT);
    setQuizSuggestion(null);
    setIsLiveMode(false);
    
    const existingHistory = progress.topicHistory?.[subTopic.id];
    
    if (existingHistory && existingHistory.length > 0) {
      setMessages(existingHistory);
    } else {
      const initialMessage: Message = {
        id: `init-${subTopic.id}-${Date.now()}`,
        role: 'model',
        text: `¡Hola! Welcome to "${subTopic.title}". ${subTopic.description} Vamos a empezar!`,
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
      const updatedProgress = saveTopicHistory(progress, subTopic.id, [initialMessage]);
      setProgress(updatedProgress);
    }
  };

  const toggleLiveMode = async () => {
    if (isLiveMode) {
      liveSession?.close();
      setLiveSession(null);
      setIsLiveMode(false);
      nextStartTimeRef.current = 0;
    } else {
      initAudioContext();
      if (!currentTopic || !currentSubTopic || !progress.level) return;

      setIsLiveMode(true);
      setLiveTranscription("");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const sessionPromise = connectLiveMaestro(
          progress.level,
          currentTopic,
          currentSubTopic,
          progress.userName || "Student",
          progress.preferences.voiceName,
          {
            onAudio: async (base64) => {
              if (!audioContextRef.current) return;
              const buffer = await decodeAudioData(base64, audioContextRef.current);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(audioContextRef.current.destination);
              
              const now = audioContextRef.current.currentTime;
              const startAt = Math.max(now, nextStartTimeRef.current);
              source.start(startAt);
              nextStartTimeRef.current = startAt + buffer.duration;
            },
            onTranscription: (text, isModel) => {
              setLiveTranscription(prev => prev + " " + text);
            },
            onTurnComplete: () => {
              console.log("Turn Complete");
            },
            onError: (err) => {
              console.error("Live Mode Error:", err);
              setIsLiveMode(false);
            }
          }
        );

        const session = await sessionPromise;
        setLiveSession(session);

        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
          
          const base64Data = encode(new Uint8Array(int16.buffer));
          
          sessionPromise.then(activeSession => {
            activeSession.sendRealtimeInput({
              media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
            });
          });
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);

      } catch (err) {
        console.error("Failed to start Live Mode:", err);
        setIsLiveMode(false);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    initAudioContext();
    if (!currentTopic || !currentSubTopic) return;
    setQuizSuggestion(null);

    const historySnapshot = [...messages];
    
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    const messagesAfterUser = [...messages, newUserMsg];
    setMessages(messagesAfterUser);
    
    const progressAfterUser = saveTopicHistory(progress, currentSubTopic.id, messagesAfterUser);
    setProgress(progressAfterUser);
    setIsTyping(true);

    try {
      const response = await sendMessageToGemini(
        historySnapshot, 
        text, 
        progress.level!, 
        currentTopic, 
        currentSubTopic,
        progress.userName || undefined
      );
      
      const newAiMsgId = (Date.now() + 1).toString();
      const newAiMsg: Message = {
        id: newAiMsgId,
        role: 'model',
        text: response.text,
        timestamp: Date.now()
      };
      
      const messagesAfterAi = [...messagesAfterUser, newAiMsg];
      setMessages(messagesAfterAi);
      const progressAfterAi = saveTopicHistory(progressAfterUser, currentSubTopic.id, messagesAfterAi);
      setProgress(progressAfterAi);

      if (response.suggestQuiz) {
        setQuizSuggestion(response.suggestionReason || "Great job! Ready for a quick quiz?");
      }

      if (progress.preferences.autoPlayAudio) {
        handlePlayAudio(newAiMsg, true); 
      }

    } catch (e: any) {
      console.error("AI Maestro Error Details:", e);
      const errorMsg: Message = {
        id: 'error-' + Date.now(),
        role: 'model',
        text: `Lo siento, I lost connection properly. (Error: ${e.message || 'Unknown'}). Please retry!`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSkipCurrentLesson = () => {
    if (!currentTopic || !currentSubTopic) return;
    const updated = completeSubTopic(currentTopic.id, currentSubTopic.id, progress);
    setProgress(updated);
    setShowSettings(false);
    setView(AppView.DASHBOARD);
  };

  const handleRestartLesson = () => {
    if (!currentTopic || !currentSubTopic) return;
    if (confirm(`Restarting will clear your chat for this lesson. Are you sure?`)) {
      const updated = clearTopicHistory(progress, currentSubTopic.id);
      setProgress(updated);
      const initialMessage: Message = {
        id: `init-${currentSubTopic.id}-${Date.now()}`,
        role: 'model',
        text: `¡Hola! Let's start "${currentSubTopic.title}" again. Vamos!`,
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
      saveTopicHistory(updated, currentSubTopic.id, [initialMessage]);
      setShowSettings(false);
      setQuizSuggestion(null);
    }
  };

  const handleUnlockAll = () => {
    const allTopicIds = CURRICULUM.map(t => t.id);
    const updated = { ...progress, unlockedTopicIds: allTopicIds };
    setProgress(updated);
    saveProgress(updated);
    setShowSettings(false);
    setView(AppView.DASHBOARD);
  };

  const handleStartQuiz = async () => {
    if (!currentTopic || !currentSubTopic || !progress.level) return;
    setIsLoadingGame(true);
    setShowGameMenu(false);
    setQuizSuggestion(null);
    try {
      const questions = await generateQuizForTopic(currentTopic, currentSubTopic, progress.level);
      if (questions && questions.length > 0) {
          setQuizQuestions(questions);
          setView(AppView.QUIZ);
      } else {
        throw new Error("Empty quiz generated");
      }
    } catch (e) {
      console.error("Quiz Gen Error:", e);
      alert("Failed to load level-aware quiz. Please try again.");
    } finally {
      setIsLoadingGame(false);
    }
  };

  const handleStartFlashcards = async () => {
    if (!currentTopic || !currentSubTopic || !progress.level) return;
    setIsLoadingGame(true);
    setShowGameMenu(false);
    try {
      const cards = await generateFlashcardsForTopic(currentTopic, currentSubTopic, progress.level);
      if (cards && cards.length > 0) {
        setFlashcards(cards);
        setView(AppView.FLASHCARDS);
      } else {
        throw new Error("Empty flashcards generated");
      }
    } catch (e) {
      console.error("Flashcard Gen Error:", e);
      alert("Failed to load flashcards.");
    } finally {
      setIsLoadingGame(false);
    }
  };

  const handleQuizComplete = (score: number) => {
    const passingScore = Math.ceil(quizQuestions.length * 0.7);
    if (score >= passingScore && currentTopic && currentSubTopic) {
      const updated = completeSubTopic(currentTopic.id, currentSubTopic.id, progress);
      setProgress(updated);
      alert(`¡Muy bien! You got ${score}/${quizQuestions.length}. Lesson complete!`);
    } else {
      alert(`Nice try! You got ${score}/${quizQuestions.length}. You need ${passingScore} to pass.`);
    }
    setView(AppView.DASHBOARD);
  };

  const handleFlashcardsComplete = () => {
    const updated = { ...progress, xp: progress.xp + 15 };
    setProgress(updated);
    saveProgress(updated);
    alert("Flashcards reviewed! +15 XP");
    setView(AppView.DASHBOARD);
  };

  const handlePlayAudio = async (msg: Message, isAutoPlay = false) => {
    initAudioContext();
    if (!audioContextRef.current) return;
    
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch (e) {}
      activeSourceRef.current = null;
      setMessages(prev => prev.map(m => ({ ...m, isAudioPlaying: false })));
      if (msg.isAudioPlaying && !isAutoPlay) return;
    }

    setLoadingAudioId(msg.id);
    
    try {
      let buffer = msg.audioBuffer;
      if (!buffer) {
        const base64Data = await generateSpeechFromText(msg.text, progress.preferences.voiceName);
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
      console.error("Audio playback failed", e);
      setLoadingAudioId(null);
      setMessages(prev => prev.map(m => ({ ...m, isAudioPlaying: false })));
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, quizSuggestion, liveTranscription]);

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
            onUpdateLevel={handleUpdateLevel}
          />
        )}
        {showSettings && (
          <SettingsModal
            progress={progress}
            onClose={() => setShowSettings(false)}
            onUpdatePreferences={handleUpdatePreferences}
            onUnlockAll={handleUnlockAll}
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
          onOpenSettings={() => setShowSettings(true)}
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

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <header className="flex-none bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm z-10 relative">
        <button onClick={() => setView(AppView.DASHBOARD)} className="text-gray-500 hover:text-emerald-600 flex items-center gap-1 font-bold">
           ‹ Back
        </button>
        <div className="text-center truncate px-2 flex flex-col items-center">
          <h1 className="font-bold text-gray-800 text-sm truncate">{currentTopic?.title}</h1>
          <button 
            onClick={toggleLiveMode}
            className={`flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full mt-0.5 transition-all shadow-sm active:scale-95 ${
              isLiveMode 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            {isLiveMode ? '● LIVE VOICE ON' : 'START LIVE VOICE'}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowGameMenu(!showGameMenu)}
              disabled={isLoadingGame}
              className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
                isLoadingGame 
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}
            >
               {isLoadingGame ? '...' : '🎮 Play'}
            </button>
            <button onClick={() => setShowSettings(true)} className="p-1 text-gray-400">
               ⚙️
            </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 scroll-smooth no-scrollbar max-w-2xl mx-auto w-full relative">
        {!isLiveMode ? (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onPlayAudio={(m) => handlePlayAudio(m, false)} isLoadingAudio={loadingAudioId === msg.id} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in text-center p-8">
            <div className="w-32 h-32 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-pulse border-4 border-emerald-200 shadow-lg">
               <span className="text-5xl">🎙️</span>
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Maestro is Listening</h2>
            <p className="text-emerald-600 text-sm max-w-xs mx-auto font-medium italic mb-8">
              "Just start speaking, I'll answer instantly."
            </p>
            <div className="w-full bg-white rounded-3xl border border-gray-100 p-6 shadow-xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 animate-pulse"></div>
               <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-3 opacity-60">Real-time Stream</p>
               <p className="text-base text-gray-700 font-medium leading-relaxed italic">
                 {liveTranscription || "Waiting for your voice..."}
               </p>
            </div>
            <button 
              onClick={toggleLiveMode}
              className="mt-12 bg-gray-800 text-white font-bold py-4 px-10 rounded-full shadow-lg active:scale-95 transition-transform"
            >
              Stop Session
            </button>
          </div>
        )}
        
        {isTyping && !isLiveMode && <div className="text-xs text-gray-400 ml-4 animate-pulse">Maestro is typing...</div>}
        
        {quizSuggestion && !isTyping && !isLiveMode && (
          <div className="mx-4 mt-6 mb-2 animate-slide-up">
            <div className="bg-gradient-to-r from-amber-100 to-orange-100 border border-orange-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <h3 className="font-bold text-orange-900 text-sm mb-1">Immersion Check!</h3>
                  <p className="text-orange-800 text-xs mb-3">{quizSuggestion}</p>
                  <button 
                    onClick={handleStartQuiz}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors shadow-sm"
                  >
                    Start Quick Quiz
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {!isLiveMode && <InputArea onSend={handleSendMessage} disabled={isTyping} />}

      {showSettings && (
        <SettingsModal
            progress={progress}
            onClose={() => setShowSettings(false)}
            onUpdatePreferences={handleUpdatePreferences}
            onSkipCurrentLesson={handleSkipCurrentLesson}
            onRestartLesson={handleRestartLesson}
            onUnlockAll={handleUnlockAll}
        />
      )}

      {showGameMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl p-4 w-full max-w-xs shadow-2xl">
              <h3 className="text-center font-black text-gray-800 mb-4">Practice Tools</h3>
              <button 
                onClick={handleStartFlashcards}
                className="w-full text-left px-4 py-4 rounded-2xl hover:bg-emerald-50 text-gray-700 font-bold flex items-center gap-3 transition-colors border border-gray-100 mb-2"
              >
                <span className="text-xl">🎴</span>
                Vocab Flashcards
              </button>
              <button 
                onClick={handleStartQuiz}
                disabled={messages.length < 2}
                className={`w-full text-left px-4 py-4 rounded-2xl font-bold flex items-center gap-3 transition-colors border ${
                    messages.length < 2 
                      ? 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed' 
                      : 'bg-white hover:bg-emerald-50 border-gray-100 text-gray-800'
                }`}
              >
                <span className="text-xl">📝</span>
                Knowledge Quiz
              </button>
              <button onClick={() => setShowGameMenu(false)} className="w-full text-center py-3 text-gray-400 text-sm font-bold mt-2">
                Close
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;