import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ManagerProgression {
  name: string;
  data: Array<{ gw: number; rank: number }>;
}

interface ProgressionData {
  managers: ManagerProgression[];
  gameweeks: number[];
}

interface ProgressionViewProps {
  onBackToHome: () => void;
}

// Generate distinct colors for each manager
const generateColors = (count: number): string[] => {
  const colors = [
    '#00E0D3', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1',
    '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A'
  ];
  
  // If we need more colors, generate them using HSL
  while (colors.length < count) {
    const hue = (colors.length * 137.508) % 360; // Golden angle approximation
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }
  
  return colors.slice(0, count);
};

const ProgressionView: React.FC<ProgressionViewProps> = ({ onBackToHome }) => {
  const [progressionData, setProgressionData] = useState<ProgressionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgressionData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Hent historikklisten for å få tilgjengelige gameweeks
        const historyResp = await fetch(`/api/history?ts=${Date.now()}`, { cache: 'no-store' as RequestCache });
        if (!historyResp.ok) throw new Error(`History API error: ${historyResp.status}`);
        const history = await historyResp.json();
        const gameweeks: number[] = (history || []).map((h: any) => Number(h.id)).filter((x: number) => Number.isFinite(x)).sort((a: number, b: number) => a - b);

        if (gameweeks.length === 0) {
          setProgressionData({ managers: [], gameweeks: [] });
          return;
        }

        // 2) Hent alle snapshots sekvensielt (skånsomt mot blob/CDN)
        const snapshots: Array<{ gw: number; snapshot: any }> = [];
        for (const gw of gameweeks) {
          try {
            const snapResp = await fetch(`/api/history/${gw}?ts=${Date.now()}`, { cache: 'no-store' as RequestCache });
            if (!snapResp.ok) continue;
            const snapshot = await snapResp.json();
            snapshots.push({ gw, snapshot });
          } catch (_) { /* ignore single failures */ }
        }

        if (snapshots.length === 0) {
          setProgressionData({ managers: [], gameweeks: [] });
          return;
        }

        // 3) Bygg manager -> [{gw, rank}] fra top3 + bottom3 per snapshot
        const managerMap = new Map<string, Array<{ gw: number; rank: number }>>();
        for (const { gw, snapshot } of snapshots) {
          const rows = [
            ...(snapshot.top3 || []).map((t: any) => ({ name: t.manager, rank: t.rank })),
            ...(snapshot.bottom3 || []).map((b: any) => ({ name: b.manager, rank: b.rank })),
          ];
          for (const r of rows) {
            if (!managerMap.has(r.name)) managerMap.set(r.name, []);
            managerMap.get(r.name)!.push({ gw, rank: Number(r.rank) });
          }
        }

        const managers: ManagerProgression[] = [];
        for (const [name, data] of managerMap.entries()) {
          const sortedData = data.sort((a, b) => a.gw - b.gw);
          managers.push({ name, data: sortedData });
        }

        // Sorter etter siste kjente rank
        const latestGw = Math.max(...gameweeks);
        managers.sort((a, b) => {
          const ar = a.data.find(d => d.gw === latestGw)?.rank ?? 999;
          const br = b.data.find(d => d.gw === latestGw)?.rank ?? 999;
          return ar - br;
        });

        setProgressionData({ managers, gameweeks });

      } catch (err) {
        console.error('[ProgressionView] Error building progression:', err);
        setError('Kunne ikke hente utviklingsdata. Prøv igjen senere.');
      } finally {
        setLoading(false);
      }
    };

    fetchProgressionData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Laster utviklingsdata...</p>
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

  if (!progressionData || progressionData.managers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-2xl p-6">
            <span className="text-4xl mb-4 block">📈</span>
            <h3 className="text-xl font-bold text-white mb-2">Ingen data</h3>
            <p className="text-gray-300 mb-4">Ikke nok snapshots for å vise utvikling ennå.</p>
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

  // Transform data for Recharts
  const chartData: Array<Record<string, any>> = [];
  const allGameweeks = progressionData.gameweeks.sort((a, b) => a - b);
  
  // Build chart data structure
  for (const gw of allGameweeks) {
    const dataPoint: Record<string, any> = { gameweek: gw };
    
    for (const manager of progressionData.managers) {
      const gwData = manager.data.find(d => d.gw === gw);
      if (gwData) {
        dataPoint[manager.name] = gwData.rank;
      }
    }
    
    chartData.push(dataPoint);
  }

  const colors = generateColors(progressionData.managers.length);
  const maxRank = Math.max(...progressionData.managers.flatMap(m => m.data.map(d => d.rank)));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-lg p-3 shadow-lg">
          <p className="text-white font-bold mb-2">{`Gameweek ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value}. plass`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] relative overflow-hidden">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            📈 Utvikling i tabellen
          </h1>
          <p className="text-white/80 text-sm">
            Følg hvordan alle managerne har beveget seg i tabellen over tid
          </p>
        </div>

        {/* Chart Container */}
        <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-2xl p-6 mb-6">
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis 
                  dataKey="gameweek" 
                  stroke="#ffffff80"
                  fontSize={12}
                  label={{ value: 'Gameweek', position: 'insideBottom', offset: -10, style: { fill: '#ffffff80' } }}
                />
                <YAxis 
                  stroke="#ffffff80"
                  fontSize={12}
                  domain={[1, maxRank]}
                  reversed={true}
                  label={{ value: 'Tabellplassering', angle: -90, position: 'insideLeft', style: { fill: '#ffffff80' } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ color: '#ffffff' }}
                  iconType="line"
                />
                {progressionData.managers.map((manager, index) => (
                  <Line
                    key={manager.name}
                    type="monotone"
                    dataKey={manager.name}
                    stroke={colors[index]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6, stroke: colors[index], strokeWidth: 2 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-4 mb-6">
          <h3 className="text-white font-bold mb-3 text-center">📊 Sammendrag</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[#00E0D3] font-bold">{progressionData.managers.length}</p>
              <p className="text-white/70 text-xs">Managere</p>
            </div>
            <div>
              <p className="text-[#00E0D3] font-bold">{progressionData.gameweeks.length}</p>
              <p className="text-white/70 text-xs">Gameweeks</p>
            </div>
            <div>
              <p className="text-[#00E0D3] font-bold">GW {Math.min(...progressionData.gameweeks)} - GW {Math.max(...progressionData.gameweeks)}</p>
              <p className="text-white/70 text-xs">Periode</p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center">
          <button 
            onClick={onBackToHome}
            className="bg-[#00E0D3] text-[#3D195B] px-6 py-3 rounded-lg font-bold hover:bg-[#00E0D3]/80 transition-all duration-300 shadow-lg"
          >
            ← Tilbake til forsiden
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgressionView;
