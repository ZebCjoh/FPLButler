import React, { useState, useEffect } from 'react';
import TopThreeSection from './TopThreeSection';
import BottomThreeSection from './BottomThreeSection';
import ButlerAssessment from './ButlerAssessment';
import SummaryDisplay from './SummaryDisplay';
import HighlightsSection from './HighlightsSection';
import WeeklyStatsSection from './WeeklyStatsSection';
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
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header with GW number */}
        <section className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            🏆 Gameweek {snapshot.gwNumber}
          </h1>
          <p className="text-white/80 text-sm">
            Historisk oversikt fra denne uken
          </p>
        </section>

        {/* IDENTICAL sections using snapshot data - no loading states needed */}
        <ButlerAssessment 
          currentGW={snapshot.gwNumber}
          standings={legacyData.standings}
          assessment={snapshot.assessment}
          isLoading={false}
        />

        <div className="grid md:grid-cols-2 gap-6">
          <TopThreeSection 
            standings={legacyData.standings}
            isLoading={false}
          />
          <BottomThreeSection 
            standings={legacyData.standings}
            isLoading={false}
          />
        </div>

        <WeeklyStatsSection 
          currentGW={snapshot.gwNumber}
          standings={legacyData.standings}
          liveData={legacyData.weeklyStats}
          isLoading={false}
        />

        <HighlightsSection 
          currentGW={snapshot.gwNumber}
          standings={legacyData.standings}
          liveData={legacyData.weeklyStats}
          highlights={snapshot.highlights}
          isLoading={false}
        />

        <SummaryDisplay 
          currentGW={snapshot.gwNumber}
          liveData={legacyData.weeklyStats}
          differential={snapshot.differential}
          isLoading={false} 
        />

        {/* Back to Home Button - ONLY DIFFERENCE */}
        <section className="mt-8">
          <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-4 text-center">
            <button 
              onClick={onBackToHome}
              className="bg-[#00E0D3] text-[#3D195B] px-6 py-3 rounded-lg font-bold hover:bg-[#00E0D3]/80 transition-all duration-300 shadow-lg"
            >
              ← Tilbake til forsiden
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default GameweekView;
