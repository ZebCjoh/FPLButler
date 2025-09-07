import React, { useState, useEffect } from 'react';

interface GameweekViewProps {
  gameweekId: string;
  onBackToHome: () => void;
}

const GameweekView: React.FC<GameweekViewProps> = ({ gameweekId, onBackToHome }) => {
  const [gameweekData, setGameweekData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameweekData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/history/${gameweekId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError(`Ingen data tilgjengelig for Gameweek ${gameweekId}.`);
          } else {
            throw new Error(`API error: ${response.status}`);
          }
          return;
        }
        
        const data = await response.json();
        setGameweekData(data);
        
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Laster gameweek data...</p>
        </div>
      </div>
    );
  }

  if (error || !gameweekData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3]">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-white mb-4">⚠️ Feil</h1>
            <p className="text-white/80 mb-6">{error || `Ingen data for Gameweek ${gameweekId}`}</p>
            <button
              onClick={onBackToHome}
              className="bg-[#00E0D3] hover:bg-[#00E0D3]/80 text-[#3D195B] font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              ← Tilbake til hovedsiden
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Map historical data to same variables as homepage
  const currentGameweek = gameweekData.gameweek;
  const butlerAssessment = gameweekData.summary;
  const weeklyStats = gameweekData.weeklyStats || {};
  const topThree = gameweekData.top3 || [];
  const bottomThree = gameweekData.bottom3 || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] relative">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Compact Header - EXACT COPY FROM APP.TSX */}
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
            <p className="text-lg font-light mb-1">Gameweek Historikk</p>
            <p className="text-base font-medium mb-1">Evry's harde kjerne 25/26</p>
            <p className="text-base font-medium">Gameweek {currentGameweek || '–'}</p>
          </div>
        </header>

        {/* Butler's Assessment Section - EXACT COPY FROM APP.TSX */}
        <section className="mb-8">
          <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-2xl p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-2xl">
                🍷
              </div>
              <h3 className="text-xl font-bold text-white">Butlerens vurdering</h3>
            </div>
            <div className="bg-[#00E0D3]/10 rounded-lg p-4">
              <p className="text-white leading-relaxed text-sm">
                {butlerAssessment || "Butleren vurderer dagens prestasjoner..."}
              </p>
            </div>
          </div>
        </section>

        {/* Main Content - EXACT COPY FROM APP.TSX */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            {/* Top 3 Section - EXACT COPY */}
            <section>
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  🏆 Topp 3
                </h2>
                <p className="text-white/80 text-sm">De beste lagene i ligaen</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {topThree.map(({ rank, teamName, managerName, points }) => (
                  <div
                    key={rank}
                    className={`
                      h-full group cursor-pointer transform transition-all duration-300 hover:scale-105
                      ${rank === 1 ? 'md:order-2' : rank === 2 ? 'md:order-1 md:mt-4' : 'md:order-3 md:mt-4'}
                    `}
                  >
                    <div className={`
                      flex h-full flex-col justify-between rounded-xl shadow-xl border-2 p-4
                      ${rank === 1 
                        ? 'bg-[#3D195B] border-[#FFD700]' 
                        : rank === 2
                        ? 'bg-[#360D3A] border-[#00E0D3]/80'
                        : 'bg-[#2D0A2E] border-[#00E0D3]/60'
                      }
                    `}>
                      
                      <div className="flex items-center justify-center">
                        <div className={`
                          w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-lg border-2
                          ${rank === 1 
                            ? 'bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black border-white' 
                            : 'bg-[#00E0D3]/80 text-[#3D195B] border-white/80'
                          }
                        `}>
                          {rank}
                        </div>
                      </div>

                      <div className="flex flex-col items-center text-center min-h-[56px] justify-center">
                        <h3 className="font-bold text-white leading-tight max-w-[18ch] clamp-2 text-sm">
                          {teamName}
                        </h3>
                        <p className="mt-1 text-xs text-white/90 font-medium">av {managerName}</p>
                      </div>

                      <div className="bg-[#00E0D3]/20 border border-[#00E0D3] rounded-lg px-3 py-2 text-center">
                        <div className="text-lg font-bold text-white">{points}</div>
                        <div className="text-xs text-white/90">poeng</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Bottom 3 Section - EXACT COPY */}
            <section>
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">📉 Bunn 3</h2>
                <p className="text-white/80 text-sm">Lagene som må skjerpe seg</p>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {bottomThree.map(({ rank, teamName, managerName, points }) => (
                  <div
                    key={rank}
                    className="bg-[#3D195B] border-2 border-red-500/70 rounded-xl shadow-xl p-4 flex items-center space-x-4 hover:scale-105 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center text-lg font-bold shadow-lg flex-shrink-0">
                      {rank}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-sm truncate">{teamName}</h3>
                      <p className="text-white/70 text-xs truncate">av {managerName}</p>
                    </div>
                    
                    <div className="bg-[#2D0A2E] border border-red-500/60 rounded-lg px-3 py-2 text-center flex-shrink-0">
                      <p className="text-red-400 font-bold text-sm">{points}</p>
                      <p className="text-white/60 text-xs">poeng</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Highlights Section - EXACT COPY */}
            <section>
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-white mb-2">
                  ✨ Høydepunkter
                </h2>
                <p className="text-white/80 text-xs">Rundens mest interessante øyeblikk</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {Array.isArray(gameweekData.highlights) && gameweekData.highlights.length > 0 ? (
                  gameweekData.highlights.map((h: any, index: number) => (
                    <div 
                      key={h.id || index}
                      className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300"
                    >
                      <p className="text-white/90 text-sm leading-relaxed">
                        {h.text || h}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3">
                    <p className="text-white/60 text-sm text-center">
                      Ingen høydepunkter tilgjengelig
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column - Weekly Stats - EXACT COPY */}
          <div>
            <section>
              <div className="text-center mb-4">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  📊 Ukestatistikk
                </h2>
                <p className="text-white/80 text-sm">Gameweek {currentGameweek || '–'} høydepunkter</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-3 hover:scale-105 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🏆</span>
                    <h4 className="text-white font-bold text-sm">Ukens Vinner</h4>
                  </div>
                  <div className="text-center">
                    <p className="text-[#00E0D3] font-bold text-sm">
                      {weeklyStats.weekWinner?.manager || '-'}
                    </p>
                    <p className="text-white/70 text-xs mb-1">
                      {weeklyStats.weekWinner?.teamName || '-'}
                    </p>
                    <p className="text-white font-bold">
                      {weeklyStats.weekWinner?.points || 0} poeng
                    </p>
                  </div>
                </div>

                <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-3 hover:scale-105 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💔</span>
                    <h4 className="text-white font-bold text-sm">Ukens Taper</h4>
                  </div>
                  <div className="text-center">
                    <p className="text-red-400 font-bold text-sm">
                      {weeklyStats.weekLoser?.manager || '-'}
                    </p>
                    <p className="text-white/70 text-xs mb-1">
                      {weeklyStats.weekLoser?.teamName || '-'}
                    </p>
                    <p className="text-white font-bold">
                      {weeklyStats.weekLoser?.points || 0} poeng
                    </p>
                  </div>
                </div>

                <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-3 hover:scale-105 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🪑</span>
                    <h4 className="text-white font-bold text-sm">Benkesliter</h4>
                  </div>
                  <div className="text-center">
                    <p className="text-[#00E0D3] font-bold text-sm">
                      {weeklyStats.benchWarmer?.manager || '-'}
                    </p>
                    <p className="text-white font-bold">
                      {weeklyStats.benchWarmer?.benchPoints || 0} poeng
                    </p>
                    <p className="text-white/70 text-xs">på benken</p>
                  </div>
                </div>

                <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-3 hover:scale-105 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💡</span>
                    <h4 className="text-white font-bold text-sm">Chips Brukt</h4>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-xs">
                      {weeklyStats.chipsUsed?.length || 0} chips aktivert
                    </p>
                  </div>
                </div>

                <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-3 hover:scale-105 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📈</span>
                    <h4 className="text-white font-bold text-sm">Bevegelser</h4>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="text-center">
                      <p className="text-green-400">
                        🚀 {weeklyStats.movements?.riser?.manager || '-'}
                      </p>
                      <p className="text-white/70">
                        +{weeklyStats.movements?.riser?.change || 0} plasser
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-red-400">
                        ⬇️ {weeklyStats.movements?.faller?.manager || '-'}
                      </p>
                      <p className="text-white/70">
                        {weeklyStats.movements?.faller?.change || 0} plasser
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-3 hover:scale-105 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⏰</span>
                    <h4 className="text-white font-bold text-sm">Neste Frist</h4>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-xs">
                      Historisk data
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🔥</span>
                    <h4 className="text-white font-bold text-sm">Form (3 GW)</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <h5 className="text-[#00E0D3] font-bold text-xs mb-1">🔥 Hot</h5>
                      <div className="space-y-1">
                        {gameweekData.form?.hot?.slice(0, 3).map((player: any, index: number) => (
                          <div key={index} className="text-white text-xs">
                            <div className="font-semibold truncate">{player.managerName || player.manager}</div>
                            <div className="text-white/70">{player.points || player.formPoints} poeng</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-red-400 font-bold text-xs mb-1">🧊 Cold</h5>
                      <div className="space-y-1">
                        {gameweekData.form?.cold?.slice(0, 3).map((player: any, index: number) => (
                          <div key={index} className="text-white text-xs">
                            <div className="font-semibold truncate">{player.managerName || player.manager}</div>
                            <div className="text-white/70">{player.points || player.formPoints} poeng</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💰</span>
                    <h4 className="text-white font-bold text-sm">Transfer ROI</h4>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-xs">Historisk data</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>

        {/* Back Button */}
        <div className="text-center mt-8">
          <button
            onClick={onBackToHome}
            className="bg-[#00E0D3] hover:bg-[#00E0D3]/80 text-[#3D195B] font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg"
          >
            ← Tilbake til hovedsiden
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameweekView;
