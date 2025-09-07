import React, { useState, useEffect } from 'react';
import HeaderSection from './HeaderSection';
import ButlerAssessment from './ButlerAssessment';
import TopThreeSection from './TopThreeSection';
import BottomThreeSection from './BottomThreeSection';
import HighlightsSection from './HighlightsSection';
import WeeklyStatsSection from './WeeklyStatsSection';
import InfoSection from './InfoSection';

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
        
        const response = await fetch(`/api/history/${gameweekId}?ts=${Date.now()}`, { cache: 'no-store' as RequestCache });
        
        if (!response.ok) {
          if (response.status === 404) {
            setError(`Ingen data tilgjengelig for Gameweek ${gameweekId}.`);
          } else {
            throw new Error(`API error: ${response.status}`);
          }
          return;
        }
        
        const data = await response.json();
        console.log('[GameweekView] Loaded snapshot for GW', gameweekId, data);
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
          <p className="text-white">Laster gameweek data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-2xl p-6">
            <span className="text-4xl mb-4 block">❌</span>
            <h3 className="text-xl font-bold text-white mb-2">Feil</h3>
            <p className="text-gray-300 mb-4">{error}</p>
            <button 
              onClick={onBackToHome}
              className="bg-[#00E0D3] text-[#3D195B] px-4 py-2 rounded-lg font-bold hover:bg-[#00E0D3]/80 transition-all duration-300"
            >
              Tilbake til forsiden
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameweekData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">Ingen data tilgjengelig</p>
        </div>
      </div>
    );
  }

  // Transform historical data into the same format as App.tsx (robust to key variations)
  const rawTop = gameweekData.top3 || gameweekData.topThree || gameweekData.top || [];
  const rawBottom = gameweekData.bottom3 || gameweekData.bottomThree || gameweekData.bottom || [];

  const topThree = Array.isArray(rawTop)
    ? rawTop.map((team: any, index: number) => ({
        rank: team.rank ?? index + 1,
        teamName: team.teamName || team.entry_name || team.team || '-',
        manager: team.manager || team.player_name || team.managerName || '-',
        points: team.points ?? team.total ?? team.event_total ?? 0,
      }))
    : [];

  const bottomThree = Array.isArray(rawBottom)
    ? rawBottom.map((team: any, index: number) => ({
        rank: team.rank ?? ((Array.isArray(rawTop) ? rawTop.length : 3) - 2 + index),
        teamName: team.teamName || team.entry_name || team.team || '-',
        manager: team.manager || team.player_name || team.managerName || '-',
        points: team.points ?? team.total ?? team.event_total ?? 0,
      }))
    : [];

  const leagueName = (rawTop?.[0]?.league_name)
    || gameweekData.leagueName
    || gameweekData.summary?.leagueName
    || 'Historisk Liga';

  const summaryText = typeof gameweekData.summary === 'string'
    ? gameweekData.summary
    : (gameweekData.summary?.text || '');

  const highlights = gameweekData.highlights
    || gameweekData.weeklyStats?.highlights
    || [];

  const weeklyStats = gameweekData.weeklyStats || gameweekData.weekly || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] relative overflow-hidden">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* IDENTICAL Header */}
        <HeaderSection 
          leagueName={leagueName} 
          currentGameweek={parseInt(gameweekId)} 
        />

        {/* IDENTICAL Butler's Assessment Section */}
        <ButlerAssessment 
          assessment={summaryText} 
          isLoading={false} 
        />

        {/* IDENTICAL Main Content - 2 Column Layout */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            {/* IDENTICAL Top 3 Section */}
            <TopThreeSection 
              topThree={topThree} 
              isLoading={false} 
            />

            {/* IDENTICAL Bottom 3 Section */}
            <BottomThreeSection 
              bottomThree={bottomThree} 
              isLoading={false} 
            />

            {/* IDENTICAL Highlights Section */}
            <HighlightsSection 
              highlights={highlights || []} 
              isLoading={false} 
            />
          </div>

          {/* Right Column - Weekly Stats */}
          <div className="space-y-4">
            {weeklyStats && (
              <WeeklyStatsSection 
                weeklyStats={weeklyStats} 
                currentGameweek={parseInt(gameweekId)} 
                isLoading={false} 
              />
            )}

            {/* IDENTICAL Info Section */}
            <InfoSection />

            {/* Back to Home Button - ONLY DIFFERENCE */}
            <section className="mt-8">
              <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-4 text-center">
                <button 
                  onClick={onBackToHome}
                  className="bg-[#00E0D3] text-[#3D195B] px-6 py-3 rounded-lg font-bold hover:bg-[#00E0D3]/80 transition-all duration-300 shadow-lg"
                >
                  ← Tilbake til forsiden
                </button>
                <p className="text-white/70 text-xs mt-2">
                  Se siste gameweek og alle aktuelle resultater
                </p>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default GameweekView;