import React, { useState, useEffect } from 'react';
import FPLDashboard from './FPLDashboard';

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

  // Prepare data for FPLDashboard component in the same format as homepage
  const dashboardData = {
    currentGameweek: gameweekData.gameweek,
    butlerAssessment: gameweekData.summary,
    weeklyStats: gameweekData.weeklyStats || {},
    loadingStates: {
      bootstrap: false,
      standings: false,
      liveData: false,
      aiSummary: false
    },
    // Historical data
    top3: gameweekData.top3,
    bottom3: gameweekData.bottom3,
    form: gameweekData.form,
    highlights: gameweekData.highlights
  };

  return (
    <div>
      <FPLDashboard 
        data={dashboardData}
        isHistorical={true}
        title="Gameweek Historikk"
        subtitle="Evry's harde kjerne 25/26"
      />
      
      {/* Back Button */}
      <div className="text-center pb-8">
        <button
          onClick={onBackToHome}
          className="bg-[#00E0D3] hover:bg-[#00E0D3]/80 text-[#3D195B] font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg"
        >
          ← Tilbake til hovedsiden
        </button>
      </div>
      
      {/* Historical Info */}
      <div className="text-center pb-8">
        <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-4 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-lg">📚</span>
            <h3 className="text-base font-bold text-white">Historisk Data</h3>
          </div>
          <p className="text-white/70 text-xs">
            Snapshot fra {new Date(gameweekData.createdAt).toLocaleDateString('no-NO', {
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
  );
};

export default GameweekView;