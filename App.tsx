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
  const [liveTranscription, setLiveTranscription] = useState("");
  const [liveSession, setLiveSession] = useState<any>(null);
  const nextStartTimeRef = useRef(0);

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoadingGame, setIsLoadingGame] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (progress.level) {
      setView(AppView.DASHBOARD);
    }
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
        text: `¡Hola! Welcome to "${subTopic.title}". Let's start!`,
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
          progress.level, currentTopic, currentSubTopic, progress.userName || "Student", progress.preferences.voiceName,
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
            onTranscription: (text) => setLiveTranscription(prev => prev + " " + text),
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
      const response = await sendMessageToGemini(messages, text, progress.level!, currentTopic, currentSubTopic, progress.userName || undefined);
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
    setShowGameMenu(false);
    setQuizSuggestion(null);
    try {
      const questions = await generateQuizForTopic(currentTopic, currentSubTopic, progress.level);
      if (questions) { setQuizQuestions(questions); setView(AppView.QUIZ); }
    } catch (e) { alert("Failed to load quiz."); } finally { setIsLoadingGame(false); }
  };

  const handleStartFlashcards = async () => {
    if (!currentTopic || !currentSubTopic || !progress.level) return;
    setIsLoadingGame(true);
    setShowGameMenu(false);
    try {
      const cards = await generateFlashcardsForTopic(currentTopic, currentSubTopic, progress.level);
      if (cards) { setFlashcards(cards); setView(AppView.FLASHCARDS); }
    } catch (e) { alert("Failed to load flashcards."); } finally { setIsLoadingGame(false); }
  };

  const handleQuizComplete = (score: number) => {
    if (score >= 7 && currentTopic && currentSubTopic) {
      setProgress(completeSubTopic(currentTopic.id, currentSubTopic.id, progress));
      alert(`Well done! Score: ${score}/10`);
    } else { alert(`Score: ${score}/10. Keep practicing!`); }
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

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping, liveTranscription]);

  if (view === AppView.LEVEL_SELECT) return <LevelSelector onSelect={handleLevelSelect} />;
  if (view === AppView.DASHBOARD) return (
    <>
      {showProfile && <ProfileModal progress={progress} onClose={() => setShowProfile(false)} onUpdateName={handleUpdateName} onUpdateLevel={handleUpdateLevel} />}
      {showSettings && <SettingsModal progress={progress} onClose={() => setShowSettings(false)} onUpdatePreferences={handleUpdatePreferences} onUnlockAll={() => { setProgress({ ...progress, unlockedTopicIds: CURRICULUM.map(t => t.id) }); setShowSettings(false); }} />}
      <Dashboard progress={progress} onSelectTopic={handleTopicSelect} onReset={() => { localStorage.clear(); window.location.reload(); }} onOpenProfile={() => setShowProfile(true)} onOpenSettings={() => setShowSettings(true)} />
    </>
  );

  if (view === AppView.QUIZ) return <Quiz questions={quizQuestions} onComplete={handleQuizComplete} onCancel={() => setView(AppView.DASHBOARD)} />;
  if (view === AppView.FLASHCARDS) return <Flashcards cards={flashcards} onComplete={() => setView(AppView.DASHBOARD)} onClose={() => setView(AppView.DASHBOARD)} />;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm z-10">
        <button onClick={() => setView(AppView.DASHBOARD)} className="text-gray-500 font-bold">‹ Back</button>
        <div className="text-center">
          <h1 className="font-bold text-gray-800 text-sm">{currentSubTopic?.title}</h1>
          <button onClick={toggleLiveMode} className={`text-[10px] font-black px-3 py-1 rounded-full mt-1 ${isLiveMode ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>{isLiveMode ? '● LIVE VOICE ON' : 'START LIVE VOICE'}</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGameMenu(true)} className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5 rounded-full font-bold">🎮 Play</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 max-w-2xl mx-auto w-full">
        {!isLiveMode ? messages.map((msg) => <MessageBubble key={msg.id} message={msg} onPlayAudio={handlePlayAudio} isLoadingAudio={loadingAudioId === msg.id} />) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
            <div className="w-32 h-32 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-pulse border-4 border-emerald-200">🎙️</div>
            <h2 className="text-2xl font-black text-gray-800 uppercase">Listening...</h2>
            <div className="w-full bg-white rounded-3xl p-6 shadow-xl mt-6 italic text-gray-700">{liveTranscription || "Waiting for your voice..."}</div>
          </div>
        )}
        {isTyping && <div className="text-xs text-gray-400 ml-4 animate-pulse">Maestro is typing...</div>}
        {quizSuggestion && !isTyping && <div className="bg-orange-100 p-4 rounded-2xl mx-4 mt-4 text-center"><p className="text-xs text-orange-800 mb-2 font-bold">{quizSuggestion}</p><button onClick={handleStartQuiz} className="bg-orange-500 text-white text-xs px-4 py-2 rounded-full font-bold">Start Quiz</button></div>}
        <div ref={messagesEndRef} />
      </div>

      {!isLiveMode && <InputArea onSend={handleSendMessage} disabled={isTyping} />}
      {showGameMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-4 w-full max-w-xs shadow-2xl">
              <h3 className="text-center font-black text-gray-800 mb-4">Practice Tools</h3>
              <button onClick={handleStartFlashcards} className="w-full text-left px-4 py-4 rounded-2xl bg-white hover:bg-emerald-50 text-gray-800 font-bold flex items-center gap-3 border mb-2">🎴 Flashcards</button>
              <button onClick={handleStartQuiz} disabled={messages.length < 2} className={`w-full text-left px-4 py-4 rounded-2xl font-bold flex items-center gap-3 border ${messages.length < 2 ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white hover:bg-emerald-50 text-gray-800'}`}>📝 Knowledge Quiz</button>
              <button onClick={() => setShowGameMenu(false)} className="w-full text-center py-3 text-gray-400 text-sm font-bold mt-2">Close</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;