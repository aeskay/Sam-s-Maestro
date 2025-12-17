import React from 'react';
import { UserProgress, UserPreferences } from '../types';

interface SettingsModalProps {
  progress: UserProgress;
  onClose: () => void;
  onUpdatePreferences: (prefs: UserPreferences) => void;
}

const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] as const;

const SettingsModal: React.FC<SettingsModalProps> = ({ progress, onClose, onUpdatePreferences }) => {
  const { preferences } = progress;

  const handleToggleAutoPlay = () => {
    onUpdatePreferences({ ...preferences, autoPlayAudio: !preferences.autoPlayAudio });
  };

  const handleVoiceChange = (voice: typeof VOICES[number]) => {
    onUpdatePreferences({ ...preferences, voiceName: voice });
  };

  // Currently we just store speed, implementation of speed control happens in audioUtils if needed, 
  // but for now we just store the preference.
  // Note: Web Audio API playbackRate is easiest way to change speed without regenerating audio.

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
           ✕
        </button>
        
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
          <p className="text-emerald-600 text-sm">Customize your learning</p>
        </div>

        <div className="space-y-6">
          
          {/* Auto Play */}
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div>
              <div className="font-bold text-gray-800 flex items-center gap-2">
                🔊 Auto-Play Audio
              </div>
              <p className="text-xs text-gray-500 mt-1">Listen automatically when Maestro replies.</p>
            </div>
            <button 
              onClick={handleToggleAutoPlay}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                preferences.autoPlayAudio ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-all ${
                preferences.autoPlayAudio ? 'left-6' : 'left-1'
              }`} />
            </button>
          </div>

          {/* Voice Selection */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="font-bold text-gray-800 mb-3 flex items-center gap-2">
               🗣️ Tutor Voice
            </div>
            <div className="grid grid-cols-2 gap-2">
              {VOICES.map((voice) => (
                <button
                  key={voice}
                  onClick={() => handleVoiceChange(voice)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                    preferences.voiceName === voice
                      ? 'bg-emerald-100 border-emerald-500 text-emerald-800 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {voice}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
            <button 
              onClick={onClose} 
              className="bg-gray-800 text-white font-bold py-3 px-8 rounded-full shadow-lg active:scale-95 transition-transform"
            >
              Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;