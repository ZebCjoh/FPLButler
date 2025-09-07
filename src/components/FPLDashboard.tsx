import React from 'react';

interface FPLDashboardProps {
  data: {
    standings?: any[];
    currentGameweek?: number | null;
    weeklyStats?: any;
    loadingStates?: {
      bootstrap: boolean;
      standings: boolean;
      liveData: boolean;
      aiSummary: boolean;
    };
    butlerAssessment?: string;
    // For historical views, these will be populated from JSON
    top3?: any[];
    bottom3?: any[];
    form?: {
      hot: any[];
      cold: any[];
    };
    highlights?: any[];
  };
  isHistorical?: boolean;
  title?: string;
  subtitle?: string;
}

const FPLDashboard: React.FC<FPLDashboardProps> = ({ data, isHistorical = false, title, subtitle }) => {
  const {
    standings = [],
    currentGameweek,
    weeklyStats,
    loadingStates = { bootstrap: false, standings: false, liveData: false, aiSummary: false },
    butlerAssessment = '',
    top3: historicalTop3,
    bottom3: historicalBottom3,
    form: historicalForm,
    highlights: historicalHighlights
  } = data;

  // Use historical data if available, otherwise derive from live data
  const topThree = isHistorical && historicalTop3 
    ? historicalTop3 
    : standings.slice(0, 3).map((entry, index) => ({
        rank: index + 1,
        teamName: entry.entry_name,
        manager: entry.player_name,
        points: entry.total
      }));

  const bottomThree = isHistorical && historicalBottom3
    ? historicalBottom3
    : standings.slice(-3).reverse().map(entry => ({
        rank: entry.rank,
        teamName: entry.entry_name,
        manager: entry.player_name,
        points: entry.total
      }));

  const formData = isHistorical && historicalForm 
    ? historicalForm 
    : {
        hot: weeklyStats?.formTable?.hotStreak || [],
        cold: weeklyStats?.formTable?.coldStreak || []
      };

  const highlightsData = isHistorical && historicalHighlights
    ? historicalHighlights
    : weeklyStats?.highlights || [];

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
              <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
                FPL Butler
              </h1>
            </div>
            <div className="space-y-2">
              <p className="text-white/90 text-lg">{title || 'Ukentlig oppsummering'}</p>
              <p className="text-white/80 text-sm">{subtitle || "Evry's harde kjerne 25/26"}</p>
              <p className="text-white/80 text-sm">Gameweek {currentGameweek || '–'}</p>
            </div>
          </div>

          {/* AI Summary */}
          <section className="mb-8">
            <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-2xl p-6 max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-2xl">
                  🍷
                </div>
                <h3 className="text-xl font-bold text-white">Butlerens vurdering</h3>
              </div>
              <div className="bg-[#00E0D3]/10 rounded-lg p-4">
                {loadingStates.aiSummary ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00E0D3] mr-3"></div>
                    <span className="text-white/80">Butleren formulerer sin vurdering...</span>
                  </div>
                ) : (
                  <p className="text-white leading-relaxed text-base">
                    {butlerAssessment || 'Butleren observerer fortsatt...'}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column */}
            <div className="space-y-6">
              
              {/* Top 3 */}
              <section>
                <div className="text-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    🏆 Topp 3
                  </h2>
                  <p className="text-white/80 text-sm">De beste lagene i ligaen</p>
                </div>
                
                {loadingStates.standings ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-2xl p-4">
                        <div className="text-center space-y-3">
                          <div className="w-12 h-12 rounded-full bg-[#00E0D3]/20 mx-auto animate-pulse"></div>
                          <div className="h-4 bg-[#00E0D3]/20 rounded animate-pulse"></div>
                          <div className="h-3 bg-[#00E0D3]/20 rounded animate-pulse"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                    {topThree.map(({ rank, teamName, manager, points }) => (
                      <div
                        key={rank}
                        className="flex h-full flex-col justify-between rounded-xl shadow-xl border-2 p-4"
                        style={{
                          backgroundColor: '#3D195B',
                          borderColor: rank === 1 ? '#FFD700' : '#00E0D3'
                        }}
                      >
                        {/* Rank Badge */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold ${
                          rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black' : 'bg-[#00E0D3] text-[#3D195B]'
                        }`}>
                          {rank}
                        </div>
                        
                        {/* Team Info Block */}
                        <div className="min-h-[56px] flex flex-col justify-center text-center mb-3">
                          <h3 className="text-white font-bold text-sm leading-tight clamp-2 mb-1">
                            {teamName}
                          </h3>
                          <p className="text-white/70 text-xs">
                            av {manager}
                          </p>
                        </div>
                        
                        {/* Points Display */}
                        <div className="bg-[#2D0A2E] border border-[#00E0D3]/60 rounded-lg px-3 py-2 text-center">
                          <p className="text-[#00E0D3] font-bold text-lg">{points}</p>
                          <p className="text-white/60 text-xs">poeng</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Bottom 3 */}
              <section>
                <div className="text-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">📉 Bunn 3</h2>
                  <p className="text-white/80 text-sm">Lagene som må skjerpe seg</p>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {bottomThree.map(({ rank, teamName, manager, points }, index) => (
                    <div
                      key={rank}
                      className="bg-[#3D195B] border-2 border-red-500/70 rounded-xl shadow-xl p-4 flex items-center space-x-4"
                    >
                      {/* Rank Badge */}
                      <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                        {rank}
                      </div>
                      
                      {/* Team Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-sm truncate">{teamName}</h3>
                        <p className="text-white/70 text-xs truncate">av {manager}</p>
                      </div>
                      
                      {/* Points Display */}
                      <div className="bg-[#2D0A2E] border border-red-500/60 rounded-lg px-3 py-2 text-center flex-shrink-0">
                        <p className="text-red-400 font-bold text-sm">{points}</p>
                        <p className="text-white/60 text-xs">poeng</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Highlights */}
              <section>
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    ✨ Høydepunkter
                  </h2>
                  <p className="text-white/80 text-xs">Rundens mest interessante øyeblikk</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {Array.isArray(highlightsData) && highlightsData.length > 0 ? (
                    highlightsData.slice(0, 3).map((h: any, index: number) => (
                      <div 
                        key={index}
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

            {/* Right Column - Weekly Stats */}
            <div>
              {loadingStates.liveData ? (
                <section>
                  <div className="text-center mb-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                      📊 Ukestatistikk
                    </h2>
                    <p className="text-white/80 text-sm">Gameweek {currentGameweek || '–'} høydepunkter</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-2xl p-4">
                        <div className="space-y-3">
                          <div className="h-4 bg-[#00E0D3]/20 rounded animate-pulse"></div>
                          <div className="h-6 bg-[#00E0D3]/20 rounded animate-pulse"></div>
                          <div className="h-3 bg-[#00E0D3]/20 rounded animate-pulse"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : weeklyStats && (
                <section>
                  <div className="text-center mb-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                      📊 Ukestatistikk
                    </h2>
                    <p className="text-white/80 text-sm">Gameweek {currentGameweek || '–'} høydepunkter</p>
                  </div>

                  {/* 2-Column Grid for Compact Stats */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                    {/* Ukens Vinner */}
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

                    {/* Ukens Taper */}
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

                    {/* Benkesliter */}
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

                    {/* Bevegelser */}
                    <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-3 hover:scale-105 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">📈</span>
                        <h4 className="text-white font-bold text-sm">Bevegelser</h4>
                      </div>
                      <div className="space-y-2 text-xs">
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
                  </div>

                  {/* Wider Cards Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Form Table */}
                    <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🔥</span>
                        <h4 className="text-white font-bold text-sm">Form (3 GW)</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {/* Hot */}
                        <div>
                          <h5 className="text-[#00E0D3] font-bold text-xs mb-1">🔥 Hot</h5>
                          <div className="space-y-1">
                            {formData.hot?.slice(0, 3).map((player: any, index: number) => (
                              <div key={index} className="text-white text-xs">
                                <div className="font-semibold truncate">{player.managerName || player.manager}</div>
                                <div className="text-white/70">{player.points || player.formPoints} poeng</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Cold */}
                        <div>
                          <h5 className="text-red-400 font-bold text-xs mb-1">🧊 Cold</h5>
                          <div className="space-y-1">
                            {formData.cold?.slice(0, 3).map((player: any, index: number) => (
                              <div key={index} className="text-white text-xs">
                                <div className="font-semibold truncate">{player.managerName || player.manager}</div>
                                <div className="text-white/70">{player.points || player.formPoints} poeng</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional stats can be added here */}
                    <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">💡</span>
                        <h4 className="text-white font-bold text-sm">Chips Brukt</h4>
                      </div>
                      <div className="text-center">
                        <p className="text-white text-xs">
                          {weeklyStats.chipsUsed?.length || 0} chips aktivert
                        </p>
                        <div className="mt-1 flex justify-center gap-1">
                          {weeklyStats.chipsUsed?.slice(0, 4).map((chip: any, index: number) => (
                            <span key={index} className="text-sm">{chip.emoji}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FPLDashboard;
