import React, { useState, useEffect } from 'react';
import TopThreeSection from './TopThreeSection';
import BottomThreeSection from './BottomThreeSection';
import ButlerAssessment from './ButlerAssessment';
import HighlightsSection from './HighlightsSection';
import WeeklyStatsSection from './WeeklyStatsSection';
import HeaderSection from './HeaderSection';
import type { Snapshot } from '../../types/snapshot';
import { snapshotToLegacy } from '../../types/snapshot';

interface GameweekViewProps {
  gameweekId: number;
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
        
        const response = await fetch(`/api/history/${gameweekId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch snapshot: ${response.status}`);
        }
        
        const data = await response.json();
        setSnapshot(data);
      } catch (err) {
        console.error('Error fetching snapshot:', err);
        setError('Kunne ikke laste gameweek-data. Prøv igjen senere.');
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshot();
  }, [gameweekId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Laster historisk data...</p>
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
        <div className="text-center max-w-md mx-auto p-8">
          <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-2xl p-6">
            <span className="text-4xl mb-4 block">📊</span>
            <h3 className="text-xl font-bold text-white mb-2">Ingen data</h3>
            <p className="text-gray-300 mb-4">Snapshot for denne gameweek er ikke tilgjengelig.</p>
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

  // Convert snapshot to legacy format for existing components
  const legacyData = snapshotToLegacy(snapshot);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] relative overflow-hidden">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <HeaderSection 
          leagueName={snapshot.meta.leagueName} 
          currentGameweek={snapshot.meta.gameweek} 
        />

        {/* Add subtitle indicating this is historical data */}
        <section className="text-center mb-6">
          <p className="text-white/80 text-sm">
            Historisk oversikt fra denne uken
          </p>
        </section>

        {/* Butler's Assessment Section */}
        <ButlerAssessment 
          assessment={snapshot.butler.summary}
          isLoading={false}
        />

        {/* Main Content - 2 Column Layout (IDENTICAL to homepage) */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            <TopThreeSection 
              topThree={snapshot.top3.map(t => ({
                rank: t.rank,
                teamName: t.team,
                manager: t.manager,
                points: t.points,
              }))}
              isLoading={false}
            />

            <BottomThreeSection 
              bottomThree={snapshot.bottom3.map(b => ({
                rank: b.rank,
                teamName: b.team,
                manager: b.manager,
                points: b.points,
              }))}
              isLoading={false}
            />

            <HighlightsSection 
              highlights={snapshot.highlights}
              isLoading={false}
            />
          </div>

          {/* Right Column - Weekly Stats */}
          <div className="space-y-4">
            <WeeklyStatsSection 
              weeklyStats={legacyData}
              currentGameweek={snapshot.meta.gameweek}
              isLoading={false}
            />

            {/* Back to Home Button */}
            <section className="mt-8">
              <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-4">
                <div className="text-center">
                  <button 
                    onClick={onBackToHome}
                    className="bg-[#00E0D3] text-[#3D195B] px-6 py-3 rounded-lg font-bold hover:bg-[#00E0D3]/80 transition-all duration-300 shadow-lg w-full"
                  >
                    ← Tilbake til forsiden
                  </button>
                  <p className="text-white/70 text-xs mt-2">
                    Gå tilbake til live gameweek data
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default GameweekView;
