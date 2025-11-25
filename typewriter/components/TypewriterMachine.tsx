import React, { useState, useEffect, useRef } from 'react';

interface TypewriterMachineProps {
  isTyping: boolean;
  textToType: string;
  onTypingComplete: () => void;
}

export const TypewriterMachine: React.FC<TypewriterMachineProps> = ({
  isTyping,
  textToType,
  onTypingComplete,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [paperHeight, setPaperHeight] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const typingSpeed = 60; // ms per char

  // Change 2: Sound Effect Logic
  const playTypewriterSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const t = ctx.currentTime;

      // 1. Mechanical "Click" (High frequency noise burst)
      const bufferSize = ctx.sampleRate * 0.04; // 40ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1200;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
      
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();

      // 2. Body "Thud" (Low frequency impulse)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.3, t);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start();
      osc.stop(t + 0.08);

    } catch (e) {
      console.error("Audio error", e);
    }
  };

  useEffect(() => {
    if (isTyping && textToType) {
      setDisplayedText('');
      setPaperHeight(40); // Initial paper emergence
      let currentIndex = 0;

      const interval = setInterval(() => {
        if (currentIndex < textToType.length) {
          const char = textToType[currentIndex];
          setDisplayedText((prev) => prev + char);
          
          // Play sound
          playTypewriterSound();

          currentIndex++;
          
          // Move paper up slightly every few characters or new lines
          if (char === '\n' || currentIndex % 20 === 0) {
             setPaperHeight(h => Math.min(h + 20, 250)); // Cap max height
          }
        } else {
          clearInterval(interval);
          // Wait a moment then complete
          setTimeout(() => {
            onTypingComplete();
            setDisplayedText('');
            setPaperHeight(0);
          }, 600);
        }
      }, typingSpeed);

      return () => clearInterval(interval);
    }
  }, [isTyping, textToType, onTypingComplete]);

  return (
    <div className="relative w-[500px] h-[350px] flex justify-center items-end select-none pointer-events-none">
      
      {/* --- The Paper (Emerging) --- */}
      <div 
        className="absolute bottom-[160px] z-10 w-[280px] bg-[#fdfbf7] shadow-md transition-all duration-300 ease-out flex flex-col overflow-hidden"
        style={{ 
            height: isTyping ? `${Math.max(100, paperHeight + 100)}px` : '0px',
            transform: `translateY(${isTyping ? -20 : 100}px)`,
            opacity: isTyping ? 1 : 0
        }}
      >
        <div className="p-4 font-['Special_Elite'] text-xs leading-[20px] whitespace-pre-wrap break-words text-stone-900">
            {displayedText}
            <span className="animate-pulse inline-block w-2 h-4 bg-stone-800 ml-1 align-middle"></span>
        </div>
      </div>

      {/* --- The Machine Body (CSS Art) --- */}
      
      {/* Platen (Roller) Back */}
      <div className="absolute bottom-[160px] w-[380px] h-[60px] bg-stone-900 rounded-lg shadow-inner z-0"></div>

      {/* Main Body Housing */}
      <div className="relative z-20 w-full h-[180px] bg-stone-300 rounded-3xl shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.4)] flex flex-col items-center border-b-8 border-stone-400">
        
        {/* Top Metallic Bar/Guide */}
        <div className="w-[80%] h-4 bg-stone-400 mt-2 rounded-full shadow-inner border border-stone-500 flex items-center justify-between px-2">
            <div className="w-2 h-2 rounded-full bg-stone-600"></div>
            <div className="w-full h-[1px] bg-stone-500 mx-2"></div>
            <div className="w-2 h-2 rounded-full bg-stone-600"></div>
        </div>

        {/* Brand Label */}
        <div className="mt-4 bg-stone-800 px-4 py-1 rounded-sm shadow-[0_1px_1px_rgba(255,255,255,0.2)] border border-stone-600">
            <span className="font-['VT323'] text-xl text-green-500 tracking-widest uppercase glow-text">
                Motorola Fix Beeper
            </span>
        </div>

        {/* Keyboard Area Representation */}
        <div className="mt-auto w-[90%] h-[100px] bg-stone-800 rounded-t-xl p-3 grid grid-cols-10 gap-1 shadow-inner">
            {Array.from({ length: 40 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`
                    w-full h-full rounded-sm shadow-[0_2px_0_#1c1917] transition-transform duration-75
                    ${isTyping && Math.random() > 0.7 ? 'translate-y-1 bg-stone-500' : 'bg-stone-600'}
                  `}
                ></div>
            ))}
        </div>
      </div>

      {/* Side Knobs */}
      <div className="absolute bottom-[170px] -left-8 w-12 h-12 rounded-full bg-stone-800 border-4 border-stone-700 shadow-xl z-10 flex items-center justify-center">
        <div className={`w-8 h-2 bg-stone-600 rounded-full ${isTyping ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }}></div>
      </div>
      <div className="absolute bottom-[170px] -right-8 w-12 h-12 rounded-full bg-stone-800 border-4 border-stone-700 shadow-xl z-10 flex items-center justify-center">
        <div className={`w-8 h-2 bg-stone-600 rounded-full ${isTyping ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }}></div>
      </div>

    </div>
  );
};