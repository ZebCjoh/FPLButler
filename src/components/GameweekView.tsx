import React, { useState, useEffect } from 'react';
import HeaderSection from './HeaderSection';
import ButlerAssessment from './ButlerAssessment';
import TopThreeSection from './TopThreeSection';
import BottomThreeSection from './BottomThreeSection';
import HighlightsSection from './HighlightsSection';
import WeeklyStatsSection from './WeeklyStatsSection';
import InfoSection from './InfoSection';
import type { Snapshot } from '../../types/snapshot';
import { snapshotToLegacy } from '../../types/snapshot';

interface GameweekViewProps {
  gameweekId: string;
  onBackToHome: () => void;
}

const GameweekView: React.FC<GameweekViewProps> = ({ gameweekId, onBackToHome }) => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/history/${gameweekId}?ts=${Date.now()}`, { 
          cache: 'no-store' as RequestCache 
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            setError(`Ingen snapshot tilgjengelig for Gameweek ${gameweekId}.`);
          } else {
            throw new Error(`API error: ${response.status}`);
          }
          return;
        }
        
        const data: Snapshot = await response.json();
        console.log('[GameweekView] Loaded complete snapshot for GW', gameweekId, data);
        setSnapshot(data);
        
      } catch (err) {
        console.error(`[GameweekView] Error fetching gameweek ${gameweekId}:`, err);
        setError('Kunne ikke hente snapshot for denne gameweek. Prøv igjen senere.');
      } finally {
        setLoading(false);
      }
    };

    if (gameweekId) {
      fetchSnapshot();
    }
  }, [gameweekId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Laster snapshot...</p>
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

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">Ingen snapshot tilgjengelig</p>
        </div>
      </div>
    );
  }

  // Transform snapshot to component-compatible format
  const topThree = snapshot.top3.map(team => ({
    rank: team.rank,
    teamName: team.team,
    manager: team.manager,
    points: team.points
  }));

  const bottomThree = snapshot.bottom3.map(team => ({
    rank: team.rank,
    teamName: team.team,
    manager: team.manager,
    points: team.points
  }));

  // Convert snapshot to legacy format for WeeklyStatsSection
  const weeklyStats = snapshotToLegacy(snapshot);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] relative overflow-hidden">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* IDENTICAL Header */}
        <HeaderSection 
          leagueName={snapshot.meta.leagueName} 
          currentGameweek={snapshot.meta.gameweek} 
        />

        {/* IDENTICAL Butler's Assessment Section */}
        <ButlerAssessment 
          assessment={snapshot.butler.summary} 
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
              highlights={snapshot.highlights} 
              isLoading={false} 
            />
          </div>

          {/* Right Column - Weekly Stats */}
          <div className="space-y-4">
            {/* IDENTICAL Weekly Stats using same data structure */}
            <WeeklyStatsSection 
              weeklyStats={weeklyStats} 
              currentGameweek={snapshot.meta.gameweek} 
              isLoading={false} 
            />

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