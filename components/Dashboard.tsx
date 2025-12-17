import React, { useState } from 'react';
import { Topic, SubTopic, UserProgress, UserLevel } from '../types';
import { CURRICULUM } from '../services/curriculum';

interface DashboardProps {
  progress: UserProgress;
  onSelectTopic: (topic: Topic, subTopic: SubTopic) => void;
  onReset: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ progress, onSelectTopic, onReset, onOpenProfile, onOpenSettings }) => {
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

  const toggleTopic = (topicId: string) => {
    if (expandedTopicId === topicId) {
      setExpandedTopicId(null);
    } else {
      setExpandedTopicId(topicId);
    }
  };

  const renderSection = (title: string, level: UserLevel, colorClass: string) => {
    const topics = CURRICULUM.filter(t => t.requiredLevel === level);
    if (topics.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className={`px-4 text-sm font-bold uppercase tracking-wider mb-3 ${colorClass}`}>{title} Modules</h2>
        <div className="space-y-3">
          {topics.map((topic) => {
            const isUnlocked = progress.unlockedTopicIds.includes(topic.id);
            const isTopicCompleted = progress.completedTopicIds.includes(topic.id);
            const isExpanded = expandedTopicId === topic.id;
            
            const totalSub = topic.subTopics.length;
            const completedSub = topic.subTopics.filter(st => progress.completedSubTopicIds.includes(st.id)).length;
            const progressPercent = Math.round((completedSub / totalSub) * 100);

            return (
              <div key={topic.id} className="relative transition-all duration-300">
                <button
                  onClick={() => isUnlocked && toggleTopic(topic.id)}
                  disabled={!isUnlocked}
                  className={`w-full relative flex items-center p-4 rounded-2xl border text-left z-10 transition-all ${
                    isExpanded ? 'bg-white border-emerald-300 shadow-md ring-2 ring-emerald-100 mb-2' : 
                    isUnlocked ? 'bg-white border-gray-100 shadow-sm hover:border-emerald-200' : 
                    'bg-gray-100 border-transparent opacity-60'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl mr-4 flex-shrink-0 transition-colors ${
                    isTopicCompleted ? 'bg-emerald-100' : isUnlocked ? 'bg-indigo-50' : 'bg-gray-200'
                  }`}>
                    {isTopicCompleted ? '✅' : topic.emoji}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-8">
                    <h3 className={`font-bold text-sm truncate ${isUnlocked ? 'text-gray-800' : 'text-gray-400'}`}>
                      {topic.title}
                    </h3>
                    {isUnlocked && (
                       <div className="flex items-center gap-2 mt-1">
                         <div className="h-1 flex-1 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                           <div className="h-full bg-emerald-400" style={{ width: `${progressPercent}%` }} />
                         </div>
                         <p className="text-[10px] text-gray-400">{completedSub}/{totalSub}</p>
                      </div>
                    )}
                  </div>

                  {!isUnlocked && <div className="absolute right-4 text-gray-400 text-xs">🔒</div>}
                  
                  {isUnlocked && (
                    <div className={`absolute right-4 transition-transform ${isExpanded ? 'rotate-180' : ''} text-gray-400`}>
                      ▼
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <div className="bg-white/80 backdrop-blur-sm border-l-2 border-emerald-100 ml-6 pl-2 space-y-2 animate-fade-in my-2">
                    {topic.subTopics.map((sub, idx) => {
                      const isSubCompleted = progress.completedSubTopicIds.includes(sub.id);
                      // Logic: Unlock if previous subtopic is done OR it's the first one in this topic
                      // Note: Strictly speaking, we should check previous *topics* too, but `unlockedTopicIds` handles the parent lock.
                      // Within the topic, we enforce linear progression:
                      const isSubUnlocked = idx === 0 || progress.completedSubTopicIds.includes(topic.subTopics[idx - 1].id);

                      return (
                        <button
                          key={sub.id}
                          onClick={() => isSubUnlocked && onSelectTopic(topic, sub)}
                          disabled={!isSubUnlocked}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                            isSubCompleted ? 'bg-emerald-50 text-emerald-800' :
                            isSubUnlocked ? 'bg-white hover:bg-gray-50 border border-gray-100 text-gray-800' :
                            'bg-gray-50 text-gray-400 border border-transparent'
                          }`}
                        >
                           <div className="flex-1">
                             <h4 className="font-bold text-xs">{sub.title}</h4>
                             <p className="text-[10px] opacity-70 truncate">{sub.description}</p>
                           </div>
                           
                           <div className="ml-2">
                              {isSubCompleted ? (
                                <span className="text-emerald-500 text-sm">✓</span>
                              ) : isSubUnlocked ? (
                                <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">GO</span>
                              ) : (
                                <span className="text-gray-300 text-xs">🔒</span>
                              )}
                           </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Stats */}
      <div className="bg-emerald-600 pt-8 pb-8 px-6 rounded-b-[2rem] shadow-lg text-white relative flex-shrink-0 z-20">
        <button 
          onClick={onOpenSettings}
          className="absolute top-8 right-6 text-emerald-200 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.922-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="flex justify-between items-start mb-6">
           <div>
             <h1 className="text-2xl font-bold">The Maestro Map</h1>
             <p className="text-emerald-200 text-sm">{progress.userName || 'Student'}'s Journey</p>
           </div>
           
           <button onClick={onOpenProfile} className="relative group mr-8">
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
      <div className="flex-1 px-4 pb-safe-area-inset-bottom overflow-y-auto z-10 pt-4">
        <div className="max-w-md mx-auto pb-8">
          {renderSection("Beginner (A1/A2)", UserLevel.BEGINNER, "text-emerald-600")}
          {renderSection("Intermediate (B1/B2)", UserLevel.INTERMEDIATE, "text-indigo-600")}
          {renderSection("Expert (C1/C2)", UserLevel.EXPERT, "text-violet-600")}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;