import React, { useState, useRef, useEffect } from 'react';

interface InputAreaProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      
      // We use continuous: false because it is more reliable for single phrases.
      // After a pause, it will return a 'final' result and stop.
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES'; // Defaulting to Spanish, but handles mixed well enough

      recognitionRef.current.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        
        // Show interim text while user is talking
        setLiveTranscript(interim);

        // When we have a final sentence, append it to the actual text box
        if (final) {
          setText(prev => {
            const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
            return prev + separator + final;
          });
          setLiveTranscript('');
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setLiveTranscript('');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setLiveTranscript('');
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setLiveTranscript('');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    }
  };

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      setLiveTranscript('');
      if (isListening) {
        recognitionRef.current?.stop();
      }
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t p-2 z-50">
      <div className="max-w-2xl mx-auto flex flex-col gap-1 p-2">
        
        {/* Live Feedback Overlay (Mini) */}
        {isListening && liveTranscript && (
          <div className="px-4 py-1 text-xs text-emerald-600 font-bold animate-pulse italic">
             Hearing: "{liveTranscript}"
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={toggleListening}
            className={`p-3 rounded-full transition-all active:scale-90 ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse shadow-lg ring-4 ring-red-100' 
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title={isListening ? "Stop listening" : "Start speaking"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
              <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
            </svg>
          </button>
          
          <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-2 focus-within:bg-white border transition-all focus-within:border-emerald-500 focus-within:shadow-inner relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  handleSend(); 
                } 
              }}
              disabled={disabled}
              placeholder={isListening ? "Habla ahora..." : "Dime algo..."}
              className="w-full bg-transparent border-none outline-none resize-none text-base py-2 !text-gray-900 font-medium placeholder-gray-400"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          <button 
            onClick={handleSend} 
            disabled={!text.trim() || disabled} 
            className={`p-3 rounded-full transition-all ${
              text.trim() && !disabled 
                ? 'bg-emerald-600 text-white shadow-md active:scale-90' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputArea;