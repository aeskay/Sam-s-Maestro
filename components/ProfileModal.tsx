import React, { useState } from 'react';
import { UserProgress } from '../types';

interface ProfileModalProps {
  progress: UserProgress;
  onClose: () => void;
  onUpdateName: (name: string) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ progress, onClose, onUpdateName }) => {
  const [name, setName] = useState(progress.userName || '');
  const [isEditing, setIsEditing] = useState(!progress.userName);

  const handleSave = () => {
    if (name.trim()) {
      onUpdateName(name.trim());
      setIsEditing(false);
    }
  };

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
            <div className="flex gap-2 justify-center">
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="border-b-2 border-emerald-500 text-center font-bold text-xl outline-none w-40"
                autoFocus
              />
              <button onClick={handleSave} className="bg-emerald-500 text-white px-3 py-1 rounded-full text-sm">Save</button>
            </div>
          ) : (
            <h2 onClick={() => setIsEditing(true)} className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg py-1">
              {name} <span className="text-xs text-gray-400">✏️</span>
            </h2>
          )}
          <p className="text-emerald-600 text-sm font-medium">{progress.level} Level</p>
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