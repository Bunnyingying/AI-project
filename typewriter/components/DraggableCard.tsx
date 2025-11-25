import React from 'react';
import { motion } from 'framer-motion';
import { CardData } from '../types';
import { GripHorizontal } from 'lucide-react';

interface DraggableCardProps {
  card: CardData;
  onDelete: (id: string) => void;
  zIndex: number;
  onFocus: () => void;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({ card, onDelete, zIndex, onFocus }) => {
  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ 
        x: card.x, 
        y: card.y + 100, 
        opacity: 0, 
        rotate: 0,
        scale: 0.9
      }}
      animate={{ 
        x: card.x, 
        y: card.y, 
        opacity: 1, 
        rotate: card.rotation,
        scale: 1
      }}
      onPointerDown={onFocus}
      whileDrag={{ scale: 1.05, cursor: 'grabbing', zIndex: 100 }}
      className="absolute w-64 min-h-[160px] bg-[#fdfbf7] text-stone-900 shadow-xl rounded-sm flex flex-col p-4 border border-stone-200"
      style={{ 
        zIndex,
        fontFamily: '"Special Elite", monospace',
        backgroundImage: 'linear-gradient(#fdfbf7 20px, #e7e5e4 21px, transparent 21px)',
        backgroundSize: '100% 20px'
      }}
    >
      {/* Tape/Pin effect at top */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-yellow-200/40 rotate-1 backdrop-blur-[1px] shadow-sm"></div>

      <div className="flex justify-between items-center mb-2 border-b-2 border-stone-800 pb-1 opacity-60">
        <span className="text-[10px] font-bold tracking-widest uppercase">Motorola Fix</span>
        <span className="text-[10px]">{card.timestamp}</span>
      </div>

      <div className="flex-grow whitespace-pre-wrap break-words leading-[20px] text-sm">
        {card.text}
      </div>

      <div className="mt-4 pt-2 border-t border-stone-300 flex justify-between items-center opacity-0 hover:opacity-100 transition-opacity">
        <GripHorizontal size={16} className="text-stone-400 cursor-grab" />
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          className="text-[10px] text-red-400 hover:text-red-600 font-sans font-bold uppercase"
        >
          Discard
        </button>
      </div>
    </motion.div>
  );
};