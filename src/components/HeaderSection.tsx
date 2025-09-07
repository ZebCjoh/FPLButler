import React from 'react';

interface HeaderSectionProps {
  leagueName: string;
  currentGameweek: number | null;
}

const HeaderSection: React.FC<HeaderSectionProps> = ({ leagueName, currentGameweek }) => {
  return (
    <header className="text-center mb-8">
      <div className="inline-block px-6 py-4 rounded-2xl bg-[#3D195B] border-2 border-[#00E0D3] mb-4 shadow-xl">
        <div className="flex items-center justify-center gap-4">
          <img 
            src="/fpl-butler.png" 
            alt="FPL Butler" 
            className="h-12 w-12 rounded-full ring-2 ring-cyan-300 shadow-md object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
            FPL Butler
          </h1>
        </div>
      </div>
      <div className="text-white">
        <p className="text-lg font-light mb-1">Ukentlig oppsummering</p>
        <p className="text-base font-medium mb-1">Liga: {leagueName || 'Laster liga...'}</p>
        <p className="text-base font-medium">Gameweek {currentGameweek || '–'}</p>
      </div>
    </header>
  );
};

export default HeaderSection;
