import React, { useState } from 'react';
import { Flashcard } from '../types';

interface FlashcardsProps {
  cards: Flashcard[];
  onComplete: () => void;
  onClose: () => void;
}

const Flashcards: React.FC<FlashcardsProps> = ({ cards, onComplete, onClose }) => {
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
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300); // Wait for flip back
    }
  };

  return (
    <div className="flex flex-col h-screen bg-violet-600 text-white">
      <div className="p-6 flex justify-between items-center">
        <button onClick={onClose} className="text-violet-200 hover:text-white">✕ Exit</button>
        <span className="font-bold">Card {currentIndex + 1}/{cards.length}</span>
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
            
            {/* Front */}
            <div 
              className="absolute inset-0 bg-white rounded-3xl flex flex-col items-center justify-center p-8 text-center"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            >
              <span className="text-6xl mb-6 block animate-bounce-slow">🇪🇸</span>
              <h2 className="text-4xl font-bold text-gray-800 break-words">{currentCard.front}</h2>
              <p className="mt-8 text-gray-400 text-sm uppercase tracking-widest">Tap to flip</p>
            </div>

            {/* Back */}
            <div 
              className="absolute inset-0 bg-violet-800 rounded-3xl flex flex-col items-center justify-center p-8 text-center"
              style={{ 
                transform: 'rotateY(180deg)', 
                backfaceVisibility: 'hidden', 
                WebkitBackfaceVisibility: 'hidden' 
              }}
            >
               <h3 className="text-3xl font-bold text-white mb-2">{currentCard.back}</h3>
               <div className="w-12 h-1 bg-violet-400 rounded-full my-6"></div>
               <p className="text-violet-200 italic text-lg">"{currentCard.example}"</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 pb-12 bg-violet-700/50 backdrop-blur-sm">
        <button 
          onClick={handleNext}
          className="w-full bg-white text-violet-700 font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-transform"
        >
          {isLast ? 'Finish Review' : 'Next Card →'}
        </button>
      </div>
    </div>
  );
};

export default Flashcards;