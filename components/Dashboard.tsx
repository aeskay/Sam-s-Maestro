import React from 'react';
import { Topic, UserProgress, UserLevel } from '../types';
import { CURRICULUM } from '../services/curriculum';

interface DashboardProps {
  progress: UserProgress;
  onSelectTopic: (topic: Topic) => void;
  onReset: () => void;
  onOpenProfile: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ progress, onSelectTopic, onReset, onOpenProfile }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Stats */}
      <div className="bg-emerald-600 pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg text-white">
        <div className="flex justify-between items-start mb-6">
           <div>
             <h1 className="text-2xl font-bold">Sam's Maestro</h1>
             <p className="text-emerald-200 text-sm">Welcome back, {progress.userName || 'Student'}!</p>
           </div>
           
           <button onClick={onOpenProfile} className="relative group">
              <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-emerald-400 flex items-center justify-center text-lg font-bold shadow-md overflow-hidden hover:bg-white/30 transition-colors">
                {progress.userName ? progress.userName.charAt(0).toUpperCase() : '👤'}
              </div>
           </button>
        </div>
        
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4">
              <div className="bg-emerald-700/50 px-4 py-2 rounded-2xl flex items-center gap-2">
                 <span className="text-xl">🔥</span>
                 <div>
                    <span className="block text-xl font-bold leading-none">{progress.streak}</span>
                    <span className="text-[10px] text-emerald-200 uppercase">Streak</span>
                 </div>
              </div>
              <div className="bg-emerald-700/50 px-4 py-2 rounded-2xl flex items-center gap-2">
                 <span className="text-xl">⭐</span>
                 <div>
                    <span className="block text-xl font-bold leading-none">{progress.xp}</span>
                    <span className="text-[10px] text-emerald-200 uppercase">XP</span>
                 </div>
              </div>
          </div>
        </div>
      </div>

      {/* Curriculum Path */}
      <div className="flex-1 px-4 -mt-6 pb-safe-area-inset-bottom">
        <div className="space-y-4 max-w-md mx-auto">
          {CURRICULUM.map((topic, index) => {
            const isUnlocked = progress.unlockedTopicIds.includes(topic.id);
            const isCompleted = progress.completedTopicIds.includes(topic.id);
            const isCurrent = isUnlocked && !isCompleted;

            return (
              <button
                key={topic.id}
                onClick={() => isUnlocked && onSelectTopic(topic)}
                disabled={!isUnlocked}
                className={`w-full relative flex items-center p-4 rounded-2xl border-2 text-left transition-all duration-300 transform ${
                  isUnlocked 
                    ? 'bg-white border-gray-100 shadow-sm hover:scale-[1.02] active:scale-95' 
                    : 'bg-gray-100 border-transparent opacity-60 cursor-not-allowed'
                } ${isCurrent ? 'ring-2 ring-emerald-400 ring-offset-2 border-emerald-100' : ''}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mr-4 flex-shrink-0 ${
                  isCompleted ? 'bg-emerald-100' : isUnlocked ? 'bg-indigo-50' : 'bg-gray-200'
                }`}>
                  {isCompleted ? '✅' : topic.emoji}
                </div>
                
                <div className="flex-1 min-w-0 pr-8">
                  <h3 className={`font-bold truncate ${isUnlocked ? 'text-gray-800' : 'text-gray-400'}`}>
                    {topic.title}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">{topic.description}</p>
                </div>

                {!isUnlocked && (
                  <div className="absolute right-4 text-gray-400">
                    🔒
                  </div>
                )}
                
                {isUnlocked && !isCompleted && (
                   <div className="absolute right-4 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap shadow-sm">
                     START
                   </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;