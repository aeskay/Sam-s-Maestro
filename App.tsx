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

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-emerald-600 text-white animate-fade-in">
    <div className="relative mb-8">
      <div className="w-24 h-24 border-4 border-emerald-400 border-t-white rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center text-4xl">🦉</div>
    </div>
    <h2 className="text-2xl font-black uppercase tracking-widest mb-2">Preparing Lesson</h2>
    <p className="text-emerald-100 italic animate-pulse px-8 text-center">{message}</p>
    <div className="mt-12 flex gap-2">
      <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
    </div>
  </div>
);

interface LiveChatMessage {
  text: string;
  role: 'user' | 'model';
}

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LEVEL_SELECT);
  const [progress, setProgress] = useState(loadProgress());
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  const [currentSubTopic, setCurrentSubTopic] = useState<SubTopic | null>(null);
  
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [quizSuggestion, setQuizSuggestion] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveMessages, setLiveMessages] = useState<LiveChatMessage[]>([]);
  const [liveSession, setLiveSession] = useState<any>(null);
  const nextStartTimeRef = useRef(0);

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const [loadingGameText, setLoadingGameText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (progress.level) setView(AppView.DASHBOARD);
  }, []);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const handleLevelSelect = (level: UserLevel) => {
    let unlocked = ['module-1'];
    
    if (level === UserLevel.INTERMEDIATE) {
      unlocked = CURRICULUM
        .filter(t => t.requiredLevel === UserLevel.BEGINNER || t.id === 'module-7')
        .map(t => t.id);
    } else if (level === UserLevel.EXPERT) {
      unlocked = CURRICULUM
        .filter(t => t.requiredLevel === UserLevel.BEGINNER || t.requiredLevel === UserLevel.INTERMEDIATE || t.id === 'module-11')
        .map(t => t.id);
    }

    const newProgress = { 
      ...progress, 
      level, 
      unlockedTopicIds: unlocked,
      completedSubTopicIds: level === UserLevel.BEGINNER ? [] : 
        CURRICULUM
          .filter(t => (level === UserLevel.INTERMEDIATE && t.requiredLevel === UserLevel.BEGINNER) || 
                       (level === UserLevel.EXPERT && (t.requiredLevel === UserLevel.BEGINNER || t.requiredLevel === UserLevel.INTERMEDIATE)))
          .flatMap(t => t.subTopics.map(st => st.id))
    };
    
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
        text: `¡Hola! Welcome to "${subTopic.title}". Let's start!`,
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
      const updatedProgress = saveTopicHistory(progress, subTopic.id, [initialMessage]);
      setProgress(updatedProgress);
    }
  };

  const handleRestartLesson = () => {
    if (!currentSubTopic) return;
    if (confirm("Restart this lesson? This will clear your chat history for this topic.")) {
      const updated = clearTopicHistory(progress, currentSubTopic.id);
      setProgress(updated);
      handleTopicSelect(currentTopic!, currentSubTopic!);
      setShowSettings(false);
    }
  };

  const handleSkipLesson = () => {
    if (!currentTopic || !currentSubTopic) return;
    const updated = completeSubTopic(currentTopic.id, currentSubTopic.id, progress);
    setProgress(updated);
    setView(AppView.DASHBOARD);
    setShowSettings(false);
    alert("Lesson marked as complete!");
  };

  const handleUnlockAll = () => {
    const updated = { ...progress, unlockedTopicIds: CURRICULUM.map(t => t.id) };
    setProgress(updated);
    saveProgress(updated);
    setShowSettings(false);
    alert("All topics unlocked!");
  };

  const toggleLiveMode = async () => {
    if (isLiveMode) {
      // PERSIST LIVE CONVERSATION BACK TO HISTORY
      if (liveMessages.length > 0) {
        const newMessagesFromLive: Message[] = liveMessages.map((m, idx) => ({
          id: `live-persisted-${Date.now()}-${idx}`,
          role: m.role,
          text: m.text,
          timestamp: Date.now()
        }));
        
        const updatedMessages = [...messages, ...newMessagesFromLive];
        setMessages(updatedMessages);
        if (currentSubTopic) {
          const updatedProgress = saveTopicHistory(progress, currentSubTopic.id, updatedMessages);
          setProgress(updatedProgress);
        }
      }

      liveSession?.close();
      setLiveSession(null);
      setIsLiveMode(false);
      nextStartTimeRef.current = 0;
    } else {
      initAudioContext();
      if (!currentTopic || !currentSubTopic || !progress.level) return;
      setIsLiveMode(true);
      setLiveMessages([]);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const sessionPromise = connectLiveMaestro(
          progress.level, 
          currentTopic, 
          currentSubTopic, 
          progress.userName || "Student", 
          progress.preferences.voiceName,
          messages, // Pass existing messages as context
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
              if (!text.trim()) return;
              setLiveMessages(prev => {
                const role = isModel ? 'model' : 'user';
                if (prev.length > 0 && prev[prev.length - 1].role === role) {
                  const last = prev[prev.length - 1];
                  return [...prev.slice(0, -1), { ...last, text: last.text + " " + text }];
                }
                return [...prev, { text, role }];
              });
            },
            onTurnComplete: () => console.log("Turn Complete"),
            onError: (err) => { console.error(err); setIsLiveMode(false); }
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
          sessionPromise.then(activeSession => activeSession.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } }));
        };
        source.connect(processor);
        processor.connect(inputCtx.destination);
      } catch (err) {
        console.error(err);
        setIsLiveMode(false);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentTopic || !currentSubTopic) return;
    initAudioContext();
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    const messagesAfterUser = [...messages, newUserMsg];
    setMessages(messagesAfterUser);
    setIsTyping(true);
    try {
      const response = await sendMessageToGemini(messagesAfterUser, text, progress.level!, currentTopic, currentSubTopic, progress.userName || undefined);
      const newAiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: response.text, timestamp: Date.now() };
      const messagesAfterAi = [...messagesAfterUser, newAiMsg];
      setMessages(messagesAfterAi);
      setProgress(saveTopicHistory(progress, currentSubTopic.id, messagesAfterAi));
      if (response.suggestQuiz) setQuizSuggestion(response.suggestionReason || "Ready for a quiz?");
      if (progress.preferences.autoPlayAudio) handlePlayAudio(newAiMsg, true);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: 'err', role: 'model', text: 'Error connecting to Maestro.', timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!currentTopic || !currentSubTopic || !progress.level) return;
    setIsLoadingGame(true);
    setLoadingGameText("Maestro is crafting a personalized quiz for you...");
    setShowGameMenu(false);
    setQuizSuggestion(null);
    try {
      const questions = await generateQuizForTopic(currentTopic, currentSubTopic, progress.level);
      if (questions && questions.length > 0) { 
        setQuizQuestions(questions); 
        setView(AppView.QUIZ); 
      } else {
        throw new Error("No questions generated");
      }
    } catch (e) { 
      alert("Lo siento, I couldn't generate the quiz. Please try again."); 
    } finally { 
      setIsLoadingGame(false); 
    }
  };

  const handleStartFlashcards = async () => {
    if (!currentTopic || !currentSubTopic || !progress.level) return;
    setIsLoadingGame(true);
    setLoadingGameText("Maestro is generating 15 detailed flashcards for you...");
    setShowGameMenu(false);
    try {
      const cards = await generateFlashcardsForTopic(currentTopic, currentSubTopic, progress.level);
      if (cards && cards.length > 0) { 
        setFlashcards(cards); 
        setView(AppView.FLASHCARDS); 
      } else {
        throw new Error("No cards generated");
      }
    } catch (e) { 
      alert("Lo siento, I couldn't generate flashcards. Please try again."); 
    } finally { 
      setIsLoadingGame(false); 
    }
  };

  const handleQuizComplete = (score: number) => {
    if (score >= 7 && currentTopic && currentSubTopic) {
      setProgress(completeSubTopic(currentTopic.id, currentSubTopic.id, progress));
      alert(`¡Excelente! Score: ${score}/10. You've unlocked the next part of your journey.`);
    } else { alert(`Score: ${score}/10. Keep practicing! You need 7/10 to advance.`); }
    setView(AppView.DASHBOARD);
  };

  const handlePlayAudio = async (msg: Message, isAutoPlay = false) => {
    initAudioContext();
    if (!audioContextRef.current) return;
    if (activeSourceRef.current) { activeSourceRef.current.stop(); activeSourceRef.current = null; }
    setLoadingAudioId(msg.id);
    try {
      const base64Data = await generateSpeechFromText(msg.text, progress.preferences.voiceName);
      if (base64Data) {
        const buffer = await decodeAudioData(base64Data, audioContextRef.current);
        setLoadingAudioId(null);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAudioPlaying: true } : m));
        activeSourceRef.current = playAudioBuffer(audioContextRef.current, buffer, () => {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAudioPlaying: false } : m));
        });
      }
    } catch (e) { setLoadingAudioId(null); }
  };

  const handleQuickSpeak = async (text: string) => {
    initAudioContext();
    if (!audioContextRef.current) return;
    if (activeSourceRef.current) { activeSourceRef.current.stop(); activeSourceRef.current = null; }
    try {
      const base64Data = await generateSpeechFromText(text, progress.preferences.voiceName);
      if (base64Data) {
        const buffer = await decodeAudioData(base64Data, audioContextRef.current);
        activeSourceRef.current = playAudioBuffer(audioContextRef.current, buffer);
      }
    } catch (e) { console.error("TTS failed", e); }
  };

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, isTyping, liveMessages]);

  if (view === AppView.LEVEL_SELECT) return <LevelSelector onSelect={handleLevelSelect} />;
  
  if (view === AppView.DASHBOARD) return (
    <>
      {isLoadingGame && <LoadingOverlay message={loadingGameText} />}
      {showProfile && <ProfileModal progress={progress} onClose={() => setShowProfile(false)} onUpdateName={handleUpdateName} onUpdateLevel={handleUpdateLevel} />}
      {showSettings && <SettingsModal progress={progress} onClose={() => setShowSettings(false)} onUpdatePreferences={handleUpdatePreferences} onUnlockAll={handleUnlockAll} />}
      <Dashboard progress={progress} onSelectTopic={handleTopicSelect} onReset={() => { localStorage.clear(); window.location.reload(); }} onOpenProfile={() => setShowProfile(true)} onOpenSettings={() => setShowSettings(true)} />
    </>
  );

  if (view === AppView.QUIZ) return <Quiz questions={quizQuestions} onComplete={handleQuizComplete} onCancel={() => setView(AppView.DASHBOARD)} />;
  if (view === AppView.FLASHCARDS) return (
    <Flashcards 
      cards={flashcards} 
      onComplete={() => setView(AppView.DASHBOARD)} 
      onClose={() => setView(AppView.DASHBOARD)} 
      onSpeak={handleQuickSpeak}
    />
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {isLoadingGame && <LoadingOverlay message={loadingGameText} />}
      {showSettings && (
        <SettingsModal 
          progress={progress} 
          onClose={() => setShowSettings(false)} 
          onUpdatePreferences={handleUpdatePreferences} 
          onRestartLesson={handleRestartLesson} 
          onSkipCurrentLesson={handleSkipLesson}
          onUnlockAll={handleUnlockAll}
        />
      )}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm z-10">
        <button onClick={() => setView(AppView.DASHBOARD)} className="text-gray-500 font-bold">‹ Back</button>
        <div className="text-center">
          <h1 className="font-bold text-gray-800 text-sm">{currentSubTopic?.title}</h1>
          <button onClick={toggleLiveMode} className={`text-[10px] font-black px-3 py-1 rounded-full mt-1 ${isLiveMode ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>{isLiveMode ? '● LIVE VOICE ON' : 'START LIVE VOICE'}</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGameMenu(true)} className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5 rounded-full font-bold">🎮 Play</button>
          <button onClick={() => setShowSettings(true)} className="p-1.5 text-gray-400 hover:text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.922-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 max-w-2xl mx-auto w-full no-scrollbar">
        {!isLiveMode ? (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onPlayAudio={handlePlayAudio} isLoadingAudio={loadingAudioId === msg.id} />
          ))
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <div className="bg-red-50 px-4 py-2 rounded-full flex items-center gap-2 border border-red-100 shadow-sm animate-pulse">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Live Voice Chat Active</span>
              </div>
            </div>
            
            {liveMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm text-sm ${
                  msg.role === 'user' 
                    ? 'bg-emerald-500 text-white rounded-tr-none' 
                    : 'bg-white text-gray-800 border rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {liveMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-pulse border-4 border-emerald-200 text-4xl">🎙️</div>
                <h2 className="text-xl font-black text-gray-800 uppercase">Listening...</h2>
                <p className="mt-2 text-xs text-gray-400">Speak now, Maestro is waiting.</p>
              </div>
            )}
            
            <div className="flex justify-center mt-8">
               <button onClick={toggleLiveMode} className="bg-red-500 text-white font-bold px-8 py-3 rounded-full shadow-lg active:scale-95 transition-transform">STOP VOICE</button>
            </div>
          </div>
        )}
        {isTyping && <div className="text-xs text-gray-400 ml-4 animate-pulse">Maestro is thinking...</div>}
        {quizSuggestion && !isTyping && (
          <div className="bg-orange-100 p-4 rounded-2xl mx-4 mt-4 text-center border border-orange-200 animate-slide-up">
            <p className="text-xs text-orange-800 mb-2 font-bold">{quizSuggestion}</p>
            <button onClick={handleStartQuiz} className="bg-orange-500 text-white text-xs px-4 py-2 rounded-full font-bold shadow-sm active:scale-95 transition-transform">Start Quiz</button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!isLiveMode && <InputArea onSend={handleSendMessage} disabled={isTyping} />}
      
      {showGameMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl p-4 w-full max-w-xs shadow-2xl animate-slide-up">
              <h3 className="text-center font-black text-gray-800 mb-4 uppercase text-sm tracking-widest">Practice Tools</h3>
              <button onClick={handleStartFlashcards} className="w-full text-left px-4 py-4 rounded-2xl bg-white hover:bg-emerald-50 text-gray-800 font-bold flex items-center gap-3 border mb-2 transition-colors">
                <span className="text-xl">🎴</span> Flashcards
              </button>
              <button onClick={handleStartQuiz} className={`w-full text-left px-4 py-4 rounded-2xl font-bold flex items-center gap-3 border bg-white hover:bg-emerald-50 text-gray-800 transition-colors`}>
                <span className="text-xl">📝</span> Knowledge Quiz
              </button>
              <button onClick={() => setShowGameMenu(false)} className="w-full text-center py-3 text-gray-400 text-sm font-bold mt-2 hover:text-gray-600 transition-colors">Close</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;