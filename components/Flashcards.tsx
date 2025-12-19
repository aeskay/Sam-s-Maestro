import React, { useState } from 'react';
import { Flashcard } from '../types';

interface FlashcardsProps {
  cards: Flashcard[];
  onComplete: () => void;
  onClose: () => void;
  onSpeak: (text: string) => void;
}

const Flashcards: React.FC<FlashcardsProps> = ({ cards, onComplete, onClose, onSpeak }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = cards[currentIndex];
  const isLast = currentIndex === cards.length - 1;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLast) {
      onComplete();
    } else {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
    }
  };

  const handleSpeak = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    onSpeak(text);
  };

  return (
    <div className="flex flex-col h-screen bg-violet-600 text-white overflow-hidden">
      <div className="p-6 flex justify-between items-center z-10">
        <button onClick={onClose} className="text-violet-200 hover:text-white font-bold transition-colors">✕ Exit</button>
        <span className="font-bold bg-violet-700 px-3 py-1 rounded-full text-xs">Card {currentIndex + 1}/{cards.length}</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6" style={{ perspective: '1000px' }}>
        <div 
           className="w-full max-w-sm aspect-[3/4] relative cursor-pointer group"
           onClick={() => setIsFlipped(!isFlipped)}
        >
          <div 
            className="w-full h-full relative transition-transform duration-500 shadow-2xl rounded-3xl"
            style={{ 
              transformStyle: 'preserve-3d', 
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' 
            }}
          >
            
            {/* Front Side: Spanish */}
            <div 
              className="absolute inset-0 bg-white rounded-3xl flex flex-col items-center justify-center p-8 text-center"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            >
              <div className="mb-6 relative">
                 <span className="text-5xl block mb-2">🇪🇸</span>
                 {/* Speaker Button on Front */}
                 <button 
                   onClick={(e) => handleSpeak(e, currentCard.front)}
                   className="mx-auto flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-600 rounded-full hover:bg-violet-200 transition-all active:scale-95 shadow-sm"
                   title="Listen to pronunciation"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                     <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.5A2.25 2.25 0 002.25 9.75v4.5a2.25 2.25 0 002.25 2.25h2.06l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM18.54 5.44a.75.75 0 011.06 0 8.25 8.25 0 010 11.68.75.75 0 01-1.06-1.06 6.75 6.75 0 000-9.56.75.75 0 010-1.06z" />
                     <path d="M15.91 8.07a.75.75 0 011.06 0 4.5 4.5 0 010 6.36.75.75 0 01-1.06-1.06 3 3 0 000-4.24.75.75 0 010-1.06z" />
                   </svg>
                   <span className="text-xs font-black uppercase">Listen</span>
                 </button>
              </div>
              <h2 className="text-3xl font-black text-gray-800 break-words leading-tight px-2">{currentCard.front}</h2>
              <div className="mt-8">
                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-black">Tap card to see translation</p>
              </div>
            </div>

            {/* Back Side: English */}
            <div 
              className="absolute inset-0 bg-violet-800 rounded-3xl flex flex-col items-center justify-center p-8 text-center border-4 border-violet-700 shadow-inner overflow-y-auto"
              style={{ 
                transform: 'rotateY(180deg)', 
                backfaceVisibility: 'hidden', 
                WebkitBackfaceVisibility: 'hidden' 
              }}
            >
               <h3 className="text-2xl font-bold text-white mb-2 leading-tight">{currentCard.back}</h3>
               <div className="w-16 h-1 bg-violet-400/30 rounded-full my-6 flex-shrink-0"></div>
               
               <div className="relative group w-full px-2">
                 <div className="mb-6">
                    <p className="text-violet-100 italic text-lg leading-relaxed mb-2">"{currentCard.example}"</p>
                    <p className="text-violet-300 text-sm font-medium border-t border-violet-400/20 pt-2">{currentCard.exampleTranslation}</p>
                 </div>
                 <button 
                   onClick={(e) => handleSpeak(e, currentCard.example)}
                   className="mx-auto flex items-center gap-2 px-3 py-1.5 bg-violet-700 text-violet-200 rounded-full hover:bg-violet-600 transition-all active:scale-95 border border-violet-600 shadow-sm"
                   title="Listen to example sentence"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                     <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.5A2.25 2.25 0 002.25 9.75v4.5a2.25 2.25 0 002.25 2.25h2.06l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06z" />
                   </svg>
                   <span className="text-[10px] font-black uppercase">Listen Example</span>
                 </button>
               </div>

               <p className="absolute bottom-8 left-0 right-0 text-[10px] text-violet-400 uppercase tracking-widest font-black mt-4">Tap to flip back</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 pb-12 bg-violet-900/40 backdrop-blur-md z-10 border-t border-violet-500/30">
        <div className="max-w-sm mx-auto">
          <button 
            onClick={handleNext}
            className="w-full bg-white text-violet-700 font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-sm hover:bg-violet-50"
          >
            {isLast ? 'Complete Review' : 'Next Word →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Flashcards;