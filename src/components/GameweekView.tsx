import React, { useState, useEffect } from 'react';

interface GameweekViewProps {
  gameweekId: string;
  onBackToHome: () => void;
}

interface GameweekData {
  id: number;
  gameweek: number;
  summary: string;
  top3?: any[];
  bottom3?: any[];
  form?: {
    hot: any[];
    cold: any[];
  };
  weeklyStats?: any;
  highlights?: any[];
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3]">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-white mb-4">⚠️ Feil</h1>
            <p className="text-white/80 mb-6">{error}</p>
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

  if (!gameweekData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3]">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Ingen data</h1>
            <p className="text-white/80 mb-6">Ingen data tilgjengelig for Gameweek {gameweekId}</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3]">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          
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
              <p className="text-white/90 text-lg">Ukentlig oppsummering</p>
              <p className="text-white/80 text-sm">Evry's harde kjerne 25/26</p>
              <p className="text-white/80 text-sm">Gameweek {gameweekData.gameweek}</p>
            </div>
          </div>

          {/* AI Summary */}
          <section className="mb-8">
            <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🍷</span>
                <h2 className="text-xl md:text-2xl font-bold text-white">Butlerens vurdering</h2>
              </div>
              <div className="bg-[#2D0A2E] border border-[#00E0D3]/60 rounded-xl p-6">
                <p className="text-white text-base leading-relaxed">
                  {gameweekData.summary}
                </p>
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
              </div>
            </div>
          </section>

          {/* Main Layout - Two Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column */}
            <div className="space-y-6">
              
              {/* Top 3 */}
              {gameweekData.top3 && gameweekData.top3.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 text-center">
                    🏆 Topp 3
                  </h2>
                  <p className="text-white/80 text-center mb-6">Ligaens ledende managere</p>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {gameweekData.top3.slice(0, 3).map((team: any, index: number) => (
                      <div key={index} className="flex h-full flex-col justify-between rounded-xl shadow-xl border-2 p-4" style={{
                        backgroundColor: '#3D195B',
                        borderColor: index === 0 ? '#FFD700' : '#00E0D3'
                      }}>
                        {/* Rank Badge */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black' : 'bg-[#00E0D3] text-[#3D195B]'
                        }`}>
                          {index + 1}
                        </div>
                        
                        {/* Team Info Block */}
                        <div className="min-h-[56px] flex flex-col justify-center text-center mb-3">
                          <h3 className="text-white font-bold text-sm leading-tight clamp-2 mb-1">
                            {team.teamName}
                          </h3>
                          <p className="text-white/70 text-xs">
                            av {team.managerName}
                          </p>
                        </div>
                        
                        {/* Points Display */}
                        <div className="bg-[#2D0A2E] border border-[#00E0D3]/60 rounded-lg px-3 py-2 text-center">
                          <p className="text-[#00E0D3] font-bold text-lg">{team.points}</p>
                          <p className="text-white/60 text-xs">poeng</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Bottom 3 */}
              {gameweekData.bottom3 && gameweekData.bottom3.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4 text-center">
                    ⬇️ Bunn 3
                  </h2>
                  <p className="text-white/80 text-center mb-6">Lagene som må skjerpe seg</p>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {gameweekData.bottom3.slice(0, 3).map((team: any, index: number) => (
                      <div key={index} className="bg-[#3D195B] border-2 border-red-500/70 rounded-xl shadow-xl p-4 flex flex-col justify-between h-full">
                        {/* Rank Badge */}
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                          {team.rank}
                        </div>
                        
                        {/* Team Info */}
                        <div className="min-h-[56px] flex flex-col justify-center text-center mb-3">
                          <h3 className="text-white font-bold text-sm leading-tight clamp-2 mb-1">
                            {team.teamName}
                          </h3>
                          <p className="text-white/70 text-xs">
                            av {team.managerName}
                          </p>
                        </div>
                        
                        {/* Points Display */}
                        <div className="bg-[#2D0A2E] border border-red-500/60 rounded-lg px-3 py-2 text-center">
                          <p className="text-red-400 font-bold text-lg">{team.points}</p>
                          <p className="text-white/60 text-xs">poeng</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Highlights */}
              {gameweekData.highlights && gameweekData.highlights.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-white mb-6 text-center">
                    ✨ Høydepunkter
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {gameweekData.highlights.slice(0, 3).map((highlight: any, index: number) => (
                      <div key={index} className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-4">
                        <p className="text-white text-sm leading-relaxed">
                          {highlight.text || highlight}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right Column - Weekly Stats */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                📊 Ukestatistikk
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Form Section */}
                {gameweekData.form && (
                  <div className="lg:col-span-2">
                    <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-4">
                      <h3 className="text-lg font-bold text-white mb-4 text-center">
                        🔥 Form (3 GW)
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Hot */}
                        <div>
                          <h4 className="text-[#00E0D3] font-bold text-sm mb-2">🔥 Hot</h4>
                          <div className="space-y-2">
                            {gameweekData.form.hot?.slice(0, 3).map((player: any, index: number) => (
                              <div key={index} className="text-white text-xs">
                                <div className="font-semibold">{player.managerName}</div>
                                <div className="text-white/70">{player.points} poeng</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Cold */}
                        <div>
                          <h4 className="text-red-400 font-bold text-sm mb-2">🧊 Cold</h4>
                          <div className="space-y-2">
                            {gameweekData.form.cold?.slice(0, 3).map((player: any, index: number) => (
                              <div key={index} className="text-white text-xs">
                                <div className="font-semibold">{player.managerName}</div>
                                <div className="text-white/70">{player.points} poeng</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Weekly Stats Grid */}
                {gameweekData.weeklyStats && (
                  <>
                    {/* Week Winner */}
                    {gameweekData.weeklyStats.weekWinner && (
                      <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-4">
                        <h3 className="text-lg font-bold text-white mb-2 text-center">
                          🏆 Ukens Vinner
                        </h3>
                        <div className="text-center">
                          <p className="text-[#00E0D3] font-bold text-sm">
                            {gameweekData.weeklyStats.weekWinner.manager}
                          </p>
                          <p className="text-white/70 text-xs mb-1">
                            {gameweekData.weeklyStats.weekWinner.teamName}
                          </p>
                          <p className="text-white font-bold">
                            {gameweekData.weeklyStats.weekWinner.points} poeng
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Week Loser */}
                    {gameweekData.weeklyStats.weekLoser && (
                      <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-4">
                        <h3 className="text-lg font-bold text-white mb-2 text-center">
                          💔 Ukens Taper
                        </h3>
                        <div className="text-center">
                          <p className="text-red-400 font-bold text-sm">
                            {gameweekData.weeklyStats.weekLoser.manager}
                          </p>
                          <p className="text-white/70 text-xs mb-1">
                            {gameweekData.weeklyStats.weekLoser.teamName}
                          </p>
                          <p className="text-white font-bold">
                            {gameweekData.weeklyStats.weekLoser.points} poeng
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bench Warmer */}
                    {gameweekData.weeklyStats.benchWarmer && (
                      <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-4">
                        <h3 className="text-lg font-bold text-white mb-2 text-center">
                          🪑 Benkesliter
                        </h3>
                        <div className="text-center">
                          <p className="text-[#00E0D3] font-bold text-sm">
                            {gameweekData.weeklyStats.benchWarmer.manager}
                          </p>
                          <p className="text-white font-bold">
                            {gameweekData.weeklyStats.benchWarmer.benchPoints} poeng
                          </p>
                          <p className="text-white/70 text-xs">på benken</p>
                        </div>
                      </div>
                    )}

                    {/* Movement */}
                    {gameweekData.weeklyStats.movements && (
                      <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-4">
                        <h3 className="text-lg font-bold text-white mb-2 text-center">
                          📈 Bevegelser
                        </h3>
                        <div className="space-y-2 text-xs">
                          {gameweekData.weeklyStats.movements.riser && (
                            <div className="text-center">
                              <p className="text-green-400">
                                🚀 {gameweekData.weeklyStats.movements.riser.manager}
                              </p>
                              <p className="text-white/70">
                                +{gameweekData.weeklyStats.movements.riser.change} plasser
                              </p>
                            </div>
                          )}
                          {gameweekData.weeklyStats.movements.faller && (
                            <div className="text-center">
                              <p className="text-red-400">
                                ⬇️ {gameweekData.weeklyStats.movements.faller.manager}
                              </p>
                              <p className="text-white/70">
                                {gameweekData.weeklyStats.movements.faller.change} plasser
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

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
    </div>
  );
};

export default GameweekView;