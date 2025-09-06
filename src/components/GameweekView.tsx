import React from 'react';

interface GameweekViewProps {
  gameweekId: string;
  onBackToHome: () => void;
}

const GameweekView: React.FC<GameweekViewProps> = ({ gameweekId, onBackToHome }) => {
  // Dummy data for testing - will be replaced with API calls later
  const historyData: Record<string, string> = {
    '1': 'Saints go Martin in tok ledelsen med 72 poeng. Erik Knutsen hadde en solid start med kapteinsvalget Haaland som ga 24 poeng. Flere spillere satset på Salah, men det ga ikke like mye uttelling denne runden.',
    '2': 'Løv-Ham raknet helt med bare 32 poeng denne runden. Marius Dramstad klatret til 2. plass etter en fantastisk runde med 65 poeng. Wildcard ble aktivert av 3 managere, men ingen av dem klarte å utnytte det optimalt.',
    '3': 'Erik Knutsen dominerer med 60 poeng og tar over førsteplassen. Sebastian Mørken hadde en skuffende runde og falt ned tabellen. Kapteinsvalget var delt mellom Haaland og Salah denne runden.'
  };

  const summaryText = historyData[gameweekId] || 'Ingen data tilgjengelig for denne gameweek.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3]">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img 
                src="/fpl-butler.png" 
                alt="FPL Butler" 
                className="h-12 w-12 rounded-full ring-2 ring-cyan-300 shadow-md object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                FPL Butler
              </h1>
            </div>
            <div className="space-y-1">
              <p className="text-white/90 text-lg">Gameweek Historikk</p>
              <p className="text-white/80 text-sm">Evry's harde kjerne 25/26</p>
            </div>
          </div>

          {/* Gameweek Content */}
          <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-2xl p-8 mb-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                📊 Gameweek {gameweekId}
              </h2>
              <p className="text-white/80 text-sm">Oppsummering av runden</p>
            </div>

            <div className="bg-[#2D0A2E] border border-[#00E0D3]/60 rounded-xl p-6">
              <p className="text-white text-base leading-relaxed">
                {summaryText}
              </p>
            </div>
          </div>

          {/* Back Button */}
          <div className="text-center">
            <button
              onClick={onBackToHome}
              className="bg-[#00E0D3] hover:bg-[#00E0D3]/80 text-[#3D195B] font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg"
            >
              ← Tilbake til hovedsiden
            </button>
          </div>

          {/* Info Section */}
          <div className="mt-8 text-center">
            <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg">📚</span>
                <h3 className="text-base font-bold text-white">Historisk Data</h3>
              </div>
              <p className="text-white/70 text-xs">
                Dette er dummy-data for testing. Senere vil dette hentes fra database.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GameweekView;
