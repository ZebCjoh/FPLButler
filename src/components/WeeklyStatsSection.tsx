import React from 'react';

interface WeeklyStats {
  weekWinner: { teamName: string; manager: string; points: number };
  weekLoser: { teamName: string; manager: string; points: number };
  benchWarmer: { manager: string; benchPoints: number };
  chipsUsed: Array<{ teamName: string; chip: string; emoji: string }>;
  movements: {
    riser: { teamName: string; manager: string; change: number };
    faller: { teamName: string; manager: string; change: number };
  };
  nextDeadline: { date: string; time: string; gameweek: number };
  formTable: {
    hotStreak: Array<{ manager: string; formPoints: number }>;
    coldStreak: Array<{ manager: string; formPoints: number }>;
  };
  formData?: { window?: number };
  transferROI: {
    genius: { manager: string; transfersIn: Array<{ name: string; points: number }> };
    flop: { manager: string; transfersIn: Array<{ name: string; points: number }> };
  };
  differential: {
    player: string;
    points: number;
    ownership: number;
    managers: string[];
  };
}

interface WeeklyStatsSectionProps {
  weeklyStats: WeeklyStats;
  currentGameweek: number | null;
  isLoading?: boolean;
}

const WeeklyStatsSection: React.FC<WeeklyStatsSectionProps> = ({ 
  weeklyStats, 
  currentGameweek, 
  isLoading = false 
}) => {
  // Defensive normalization for historical snapshots which may omit fields
  const ws = (weeklyStats || {}) as Partial<WeeklyStats>;
  const safeWeekWinner = ws.weekWinner || { teamName: '-', manager: '-', points: 0 };
  const safeWeekLoser = ws.weekLoser || { teamName: '-', manager: '-', points: 0 };
  const safeBenchWarmer = ws.benchWarmer || { manager: '-', benchPoints: 0 };
  const safeChips = Array.isArray(ws.chipsUsed) ? ws.chipsUsed : [];
  const safeMovements = ws.movements || { riser: { teamName: '-', manager: '-', change: 0 }, faller: { teamName: '-', manager: '-', change: 0 } };
  const safeNextDeadline = ws.nextDeadline || { date: '-', time: '-', gameweek: currentGameweek || 0 };
  const safeFormTable = ws.formTable || { hotStreak: [], coldStreak: [] };
  const safeFormWindow = (ws.formData && ws.formData.window) || 3;
  const safeTransferROI = ws.transferROI || { genius: { manager: '-', transfersIn: [{ name: 'Ingen bytter', points: 0 }] }, flop: { manager: '-', transfersIn: [{ name: 'Ingen bytter', points: 0 }] } };
  const safeDifferential = ws.differential || { player: '-', points: 0, ownership: 0, managers: [] };
  if (isLoading) {
    return (
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
                <div className="h-5 bg-gray-600 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-gray-600 rounded w-1/2 animate-pulse"></div>
                <div className="h-3 bg-gray-600 rounded w-full animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
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
            <div className="w-8 h-8 rounded-full bg-[#00E0D3] flex items-center justify-center text-sm">
              🏆
            </div>
            <h3 className="text-sm font-bold text-white">Ukens Vinner</h3>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-sm mb-1 truncate">{safeWeekWinner.teamName}</p>
            <p className="text-white/80 text-xs mb-2 truncate">av {safeWeekWinner.manager}</p>
            <div className="bg-[#00E0D3]/20 border border-[#00E0D3] rounded-lg p-2">
              <span className="text-lg font-bold text-white">{safeWeekWinner.points}</span>
              <p className="text-white/80 text-xs">poeng</p>
            </div>
          </div>
        </div>

        {/* Ukens Taper */}
        <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-sm">
              😔
            </div>
            <h3 className="text-sm font-bold text-white">Ukens Taper</h3>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-sm mb-1 truncate">{safeWeekLoser.teamName}</p>
            <p className="text-white/80 text-xs mb-2 truncate">av {safeWeekLoser.manager}</p>
            <div className="bg-[#00E0D3]/20 border border-[#00E0D3]/60 rounded-lg p-2">
              <span className="text-lg font-bold text-white">{safeWeekLoser.points}</span>
              <p className="text-white/80 text-xs">poeng</p>
            </div>
          </div>
        </div>

        {/* Benkesliter */}
        <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-sm">
              🪑
            </div>
            <h3 className="text-sm font-bold text-white">Benkesliter</h3>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-sm mb-2 truncate">{safeBenchWarmer.manager}</p>
            <div className="bg-[#00E0D3]/20 border border-[#00E0D3]/60 rounded-lg p-2">
              <span className="text-lg font-bold text-white">{safeBenchWarmer.benchPoints}</span>
              <p className="text-white/80 text-xs">på benken</p>
            </div>
          </div>
        </div>

        {/* Chips Brukt */}
        <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-sm">
              🎯
            </div>
            <h3 className="text-sm font-bold text-white">Chips Brukt</h3>
          </div>
          <div className="space-y-1">
            {safeChips.length > 0 ? safeChips.slice(0, 3).map((chip, index) => (
              <div key={index} className="flex items-center gap-2 bg-[#00E0D3]/10 rounded-lg p-1">
                <span className="text-xs">{chip.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-xs truncate">{chip.teamName}</p>
                </div>
              </div>
            )) : (
              <p className="text-white/80 text-xs text-center">Ingen chips brukt</p>
            )}
          </div>
        </div>

        {/* Bevegelser */}
        <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-sm">
              📈
            </div>
            <h3 className="text-sm font-bold text-white">Bevegelser</h3>
          </div>
          <div className="space-y-1">
            <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-1">
              <div className="flex items-center gap-1">
                <span className="text-xs">🚀</span>
                <span className="text-green-400 font-bold text-xs">+{safeMovements.riser?.change || 0}</span>
              </div>
              <p className="text-white text-xs truncate">{safeMovements.riser?.manager || '-'}</p>
            </div>
            <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-1">
              <div className="flex items-center gap-1">
                <span className="text-xs">⬇️</span>
                <span className="text-red-400 font-bold text-xs">{safeMovements.faller?.change || 0}</span>
              </div>
              <p className="text-white text-xs truncate">{safeMovements.faller?.manager || '-'}</p>
            </div>
          </div>
        </div>

        {/* Neste Deadline */}
        <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-3 hover:scale-105 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#00E0D3] flex items-center justify-center text-sm">
              ⏰
            </div>
            <h3 className="text-sm font-bold text-white">Neste Frist</h3>
          </div>
          <div className="text-center">
            <p className="text-white/80 text-xs mb-1">GW {safeNextDeadline.gameweek}</p>
            <div className="bg-[#00E0D3]/20 border border-[#00E0D3] rounded-lg p-2">
              <p className="text-white font-bold text-sm">{safeNextDeadline.date}</p>
              <p className="text-white/80 text-xs">{safeNextDeadline.time}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wider Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Form Table */}
        <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-sm">
              📈
            </div>
            <h3 className="text-sm font-bold text-white">Form (GW {safeFormWindow})</h3>
          </div>
          <div className="space-y-2">
            <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-2">
              <p className="text-green-400 font-bold text-xs mb-1">🔥 Hot</p>
              {safeFormTable.hotStreak.length === 0 ? (
                <p className="text-green-300/70 text-xs">Ingen data</p>
              ) : (
                safeFormTable.hotStreak.slice(0, 2).map((team, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-white text-xs truncate">{team.manager}</span>
                    <span className="text-green-300 font-bold text-xs">{team.formPoints}p</span>
                  </div>
                ))
              )}
            </div>
            <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-2">
              <p className="text-red-400 font-bold text-xs mb-1">🧊 Cold</p>
              {safeFormTable.coldStreak.length === 0 ? (
                <p className="text-red-300/70 text-xs">Ingen data</p>
              ) : (
                safeFormTable.coldStreak.slice(0, 2).map((team, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-white text-xs truncate">{team.manager}</span>
                    <span className="text-red-300 font-bold text-xs">{team.formPoints}p</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Transfer ROI */}
        <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-sm">
              💰
            </div>
            <h3 className="text-sm font-bold text-white">Transfer ROI</h3>
          </div>
          <div className="space-y-2">
            <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs">💎</span>
                <span className="text-green-400 font-bold text-xs">Geni</span>
              </div>
              <p className="text-white font-medium text-xs mb-1 truncate">{safeTransferROI.genius.manager}</p>
              <div className="flex justify-between items-center">
                <span className="text-white/80 text-xs truncate">{safeTransferROI.genius.transfersIn?.[0]?.name || 'Ingen bytter'}</span>
                <span className="text-green-300 font-bold text-xs">{safeTransferROI.genius.transfersIn?.[0]?.points || 0}p</span>
              </div>
            </div>
            <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs">💸</span>
                <span className="text-red-400 font-bold text-xs">Bom</span>
              </div>
              <p className="text-white font-medium text-xs mb-1 truncate">{safeTransferROI.flop.manager}</p>
              <div className="flex justify-between items-center">
                <span className="text-white/80 text-xs truncate">{safeTransferROI.flop.transfersIn?.[0]?.name || 'Ingen bytter'}</span>
                <span className="text-red-300 font-bold text-xs">{safeTransferROI.flop.transfersIn?.[0]?.points || 0}p</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Differential Hero - Full Width */}
      <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-3 hover:scale-105 transition-all duration-300 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-sm">
            🎯
          </div>
          <h3 className="text-sm font-bold text-white">Differential-helt</h3>
        </div>
        <div className="text-center">
          <div className="bg-purple-900/30 border border-purple-600/50 rounded-lg p-2 mb-2">
            <p className="text-purple-300 font-bold text-sm">{safeDifferential.player}</p>
            <div className="flex justify-center items-center gap-2 mt-1">
              <span className="text-lg font-bold text-white">{safeDifferential.points}</span>
              <span className="text-white/60 text-xs">poeng</span>
            </div>
          </div>
          <div className="bg-[#00E0D3]/10 rounded-lg p-2">
            <p className="text-white/80 text-xs mb-1">Eid av kun {safeDifferential.ownership} lag</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {(safeDifferential.managers || []).slice(0, 3).map((manager, index) => (
                <span key={index} className="text-white font-medium text-xs bg-[#00E0D3]/20 rounded px-2 py-1">{manager}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WeeklyStatsSection;
