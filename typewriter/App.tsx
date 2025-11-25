import React, { useState, useCallback } from 'react';
import { TypewriterMachine } from './components/TypewriterMachine';
import { DraggableCard } from './components/DraggableCard';
import { RetroButton } from './components/RetroButton';
import { CardData } from './types';

const App: React.FC = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handlePrint = () => {
    if (!inputText.trim() || isTyping) return;
    setIsTyping(true);
  };

  const handleTypingComplete = useCallback(() => {
    const id = Date.now().toString();
    // Center horizontally
    const cardWidth = 256; // w-64 in tailwind is 16rem = 256px
    const startX = (window.innerWidth / 2) - (cardWidth / 2);
    
    // Position vertically above the typewriter
    // The machine is roughly 350px tall at the bottom.
    // We want the card to float comfortably above it.
    // window.innerHeight - 350 (machine) - 200 (gap/card height)
    const startY = window.innerHeight - 550;

    const newCard: CardData = {
      id,
      text: inputText,
      x: startX,
      y: startY > 50 ? startY : 50, // Ensure it doesn't go off top
      rotation: (Math.random() * 4) - 2, // Slight organic rotation
      // Change 3: Include Date and Time
      timestamp: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
    };

    setCards((prev) => [...prev, newCard]);
    setIsTyping(false);
    setInputText('');
  }, [inputText]);

  const deleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const bringToFront = (id: string) => {
    // Simple way to bring to front: remove and re-add to end of array
    setCards(prev => {
      const card = prev.find(c => c.id === id);
      if (!card) return prev;
      return [...prev.filter(c => c.id !== id), card];
    });
  };

  // Change 4: Handle Enter key to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePrint();
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#292524] overflow-hidden flex flex-col items-center">
       {/* Cards Layer */}
       {cards.map((card, index) => (
         <DraggableCard 
           key={card.id} 
           card={card} 
           onDelete={deleteCard} 
           zIndex={index + 10} 
           onFocus={() => bringToFront(card.id)}
         />
       ))}

       {/* Controls Layer */}
       <div className="absolute top-10 z-50 flex flex-col gap-4 items-center w-full max-w-lg px-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="TYPE SOMETHING..."
            className="w-full h-32 bg-stone-800 text-stone-200 border-4 border-stone-600 rounded-lg p-4 font-mono text-lg resize-none focus:outline-none focus:border-amber-600 placeholder-stone-500 shadow-xl"
            disabled={isTyping}
          />
          <RetroButton onClick={handlePrint} disabled={isTyping} className={isTyping ? 'opacity-50 cursor-not-allowed' : ''}>
            {isTyping ? 'PRINTING...' : 'PRINT CARD [ENTER]'}
          </RetroButton>
       </div>

       {/* Machine Layer */}
       <div className="mt-auto z-40">
         <TypewriterMachine 
           isTyping={isTyping} 
           textToType={inputText} 
           onTypingComplete={handleTypingComplete} 
         />
       </div>
    </div>
  );
};

export default App;