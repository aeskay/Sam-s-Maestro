import React from 'react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  onPlayAudio: (message: Message) => void;
  isLoadingAudio: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onPlayAudio, isLoadingAudio }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-slide-up`}>
      <div
        className={`relative max-w-[85%] px-5 pt-3 pb-8 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed ${
          isUser
            ? 'bg-emerald-600 text-white rounded-tr-sm'
            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.text}</div>
        
        {!isUser && (
          <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
            <button
              onClick={() => onPlayAudio(message)}
              disabled={isLoadingAudio && !message.isAudioPlaying}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                message.isAudioPlaying
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-emerald-600'
              }`}
            >
               {message.isAudioPlaying ? (
                 <>
                   <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                   </span>
                   Playing...
                 </>
               ) : (
                 <>
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                     <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                   </svg>
                   Listen
                 </>
               )}
            </button>
          </div>
        )}
        
        <span className={`text-[10px] absolute bottom-2 right-3 ${isUser ? 'text-emerald-200' : 'text-gray-400'}`}>
           {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;