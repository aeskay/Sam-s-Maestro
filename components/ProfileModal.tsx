import React, { useState } from 'react';
import { UserProgress, UserLevel } from '../types';

interface ProfileModalProps {
  progress: UserProgress;
  onClose: () => void;
  onUpdateName: (name: string) => void;
  onUpdateLevel: (level: UserLevel) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ progress, onClose, onUpdateName, onUpdateLevel }) => {
  const [name, setName] = useState(progress.userName || '');
  const [isEditing, setIsEditing] = useState(!progress.userName);

  const handleSaveName = () => {
    if (name.trim()) {
      onUpdateName(name.trim());
      setIsEditing(false);
    }
  };

  const handleLevelChange = (level: UserLevel) => {
    if (confirm(`Are you sure you want to switch to ${level}? This won't delete progress but will change your curriculum focus.`)) {
        onUpdateLevel(level);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
           ✕
        </button>
        
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center text-4xl mb-4 border-4 border-white shadow-lg">
             {name ? name.charAt(0).toUpperCase() : '👤'}
          </div>
          
          {isEditing ? (
            <div className="flex gap-2 justify-center mb-2">
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="border-b-2 border-emerald-500 text-center font-bold text-xl outline-none w-40"
                autoFocus
              />
              <button onClick={handleSaveName} className="bg-emerald-500 text-white px-3 py-1 rounded-full text-sm">Save</button>
            </div>
          ) : (
            <h2 onClick={() => setIsEditing(true)} className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg py-1 mb-1">
              {name} <span className="text-xs text-gray-400">✏️</span>
            </h2>
          )}
          
          {/* Level Switcher */}
          <div className="flex justify-center gap-2 mt-2">
            {[UserLevel.BEGINNER, UserLevel.INTERMEDIATE, UserLevel.EXPERT].map((lvl) => (
                <button
                    key={lvl}
                    onClick={() => handleLevelChange(lvl)}
                    className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border ${
                        progress.level === lvl 
                        ? 'bg-emerald-500 text-white border-emerald-500' 
                        : 'text-gray-400 border-gray-200 hover:border-emerald-300'
                    }`}
                >
                    {lvl}
                </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-orange-50 p-4 rounded-2xl text-center border border-orange-100">
             <div className="text-2xl mb-1">🔥</div>
             <div className="font-bold text-gray-800 text-xl">{progress.streak}</div>
             <div className="text-xs text-gray-500 uppercase tracking-wide">Day Streak</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl text-center border border-blue-100">
             <div className="text-2xl mb-1">📚</div>
             <div className="font-bold text-gray-800 text-xl">{progress.wordsLearned}</div>
             <div className="text-xs text-gray-500 uppercase tracking-wide">Words Learned</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-2xl text-center col-span-2 border border-purple-100">
             <div className="font-bold text-purple-900 text-2xl">{progress.xp} XP</div>
             <div className="text-xs text-purple-700 uppercase tracking-wide">Total Experience</div>
          </div>
        </div>

        <div className="text-center">
            <button onClick={onClose} className="text-gray-400 text-sm hover:text-gray-600">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;