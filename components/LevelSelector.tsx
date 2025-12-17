import React from 'react';
import { UserLevel } from '../types';

interface LevelSelectorProps {
  onSelect: (level: UserLevel) => void;
}

const LevelSelector: React.FC<LevelSelectorProps> = ({ onSelect }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-emerald-500 p-6 text-white animate-fade-in">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">¡Hola!</h1>
          <p className="text-emerald-100 text-lg">Welcome to Maestro. Let's start your Spanish journey.</p>
          <p className="text-emerald-100 mt-2 text-sm opacity-80">Choose your current proficiency level:</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => onSelect(UserLevel.BEGINNER)}
            className="w-full group relative flex items-center p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl transition-all duration-200 active:scale-95"
          >
            <span className="text-3xl mr-4">🌱</span>
            <div className="text-left">
              <h3 className="font-bold text-white">Beginner</h3>
              <p className="text-xs text-emerald-100">I know "Hola" and "Adiós".</p>
            </div>
            <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </div>
          </button>

          <button
            onClick={() => onSelect(UserLevel.INTERMEDIATE)}
            className="w-full group relative flex items-center p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl transition-all duration-200 active:scale-95"
          >
            <span className="text-3xl mr-4">🚀</span>
            <div className="text-left">
              <h3 className="font-bold text-white">Intermediate</h3>
              <p className="text-xs text-emerald-100">I can form sentences.</p>
            </div>
            <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </div>
          </button>

          <button
            onClick={() => onSelect(UserLevel.EXPERT)}
            className="w-full group relative flex items-center p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl transition-all duration-200 active:scale-95"
          >
            <span className="text-3xl mr-4">🦉</span>
            <div className="text-left">
              <h3 className="font-bold text-white">Expert</h3>
              <p className="text-xs text-emerald-100">I want to master fluency.</p>
            </div>
            <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </div>
          </button>
        </div>
        
        <p className="text-xs text-emerald-200/60 mt-8">Powered by Gemini 2.5</p>
      </div>
    </div>
  );
};

export default LevelSelector;