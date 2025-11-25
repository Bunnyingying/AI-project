export interface CardData {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  timestamp: string;
}

export interface TypewriterProps {
  onPrintComplete: (text: string) => void;
  isTyping: boolean;
  setIsTyping: (status: boolean) => void;
}
