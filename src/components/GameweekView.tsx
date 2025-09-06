import React, { useState, useEffect } from 'react';

interface GameweekViewProps {
  gameweekId: string;
  onBackToHome: () => void;
}

interface GameweekData {
  id: number;
  gameweek: number;
  summary: string;
  createdAt: string;
}

const GameweekView: React.FC<GameweekViewProps> = ({ gameweekId, onBackToHome }) => {
  const [gameweekData, setGameweekData] = useState<GameweekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameweekData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`[GameweekView] Fetching data for gameweek ${gameweekId}...`);
        const response = await fetch(`/api/history/${gameweekId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError(`Ingen data tilgjengelig for Gameweek ${gameweekId}.`);
          } else {
            throw new Error(`API error: ${response.status}`);
          }
          return;
        }
        
        const data: GameweekData = await response.json();
        setGameweekData(data);
        console.log(`[GameweekView] Loaded data for gameweek ${gameweekId}`);
        
      } catch (err) {
        console.error(`[GameweekView] Error fetching gameweek ${gameweekId}:`, err);
        setError('Kunne ikke hente data for denne gameweek. Prøv igjen senere.');
      } finally {
        setLoading(false);
      }
    };

    if (gameweekId) {
      fetchGameweekData();
    }
  }, [gameweekId]);

  const summaryText = gameweekData?.summary || error || 'Laster data...';

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
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00E0D3]"></div>
                  <span className="ml-3 text-white">Laster gameweek data...</span>
                </div>
              ) : (
                <div>
                  <p className="text-white text-base leading-relaxed">
                    {summaryText}
                  </p>
                  {gameweekData && (
                    <div className="mt-4 pt-4 border-t border-[#00E0D3]/30">
                      <p className="text-white/60 text-xs">
                        Generert: {new Date(gameweekData.createdAt).toLocaleDateString('no-NO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )}
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
