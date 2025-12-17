import React, { useState } from 'react';
import { QuizQuestion } from '../types';

interface QuizProps {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
  onCancel: () => void;
}

const Quiz: React.FC<QuizProps> = ({ questions, onComplete, onCancel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const handleOptionClick = (index: number) => {
    if (showExplanation) return; // Prevent changing after selection
    setSelectedOption(index);
    setShowExplanation(true);
    
    if (index === currentQuestion.correctAnswerIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      onComplete(score + (selectedOption === currentQuestion.correctAnswerIndex ? 0 : 0)); // Score already updated
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-indigo-600 text-white">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
            <button onClick={onCancel} className="text-indigo-200 hover:text-white">✕ Exit</button>
            <div className="font-bold text-indigo-100">Question {currentIndex + 1}/{questions.length}</div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-indigo-900/30 h-2 rounded-full mb-8">
            <div 
                className="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            ></div>
        </div>

        <h2 className="text-2xl font-bold leading-snug mb-8 animate-fade-in">
            {currentQuestion.question}
        </h2>
      </div>

      <div className="flex-1 bg-white rounded-t-[2rem] p-6 text-gray-800 shadow-2xl overflow-y-auto">
        <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
                let statusClass = "border-gray-200 bg-white hover:bg-gray-50";
                
                if (showExplanation) {
                    if (idx === currentQuestion.correctAnswerIndex) {
                        statusClass = "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500";
                    } else if (idx === selectedOption) {
                        statusClass = "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500";
                    } else {
                        statusClass = "opacity-50 border-gray-100";
                    }
                }

                return (
                    <button
                        key={idx}
                        onClick={() => handleOptionClick(idx)}
                        disabled={showExplanation}
                        className={`w-full p-4 rounded-xl border-2 font-medium text-left transition-all duration-200 ${statusClass} active:scale-[0.98]`}
                    >
                        {option}
                    </button>
                );
            })}
        </div>

        {showExplanation && (
            <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100 animate-slide-up">
                <p className="font-bold text-indigo-900 mb-1">
                    {selectedOption === currentQuestion.correctAnswerIndex ? 'Correct! 🎉' : 'Not quite 😅'}
                </p>
                <p className="text-sm text-indigo-800 leading-relaxed">
                    {currentQuestion.explanation}
                </p>
                <button
                    onClick={handleNext}
                    className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-colors"
                >
                    {isLastQuestion ? 'Finish Quiz' : 'Next Question →'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Quiz;