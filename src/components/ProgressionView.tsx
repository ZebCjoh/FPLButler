import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredManager, setHoveredManager] = useState<string | null>(null);

  // Check for mobile width
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 900);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

        // 2) Hent standings for å få liste over managere og entryId
        const standingsResp = await fetch('/api/league/155099', { cache: 'no-store' as RequestCache });
        if (!standingsResp.ok) throw new Error(`Standings API error: ${standingsResp.status}`);
        const standingsData = await standingsResp.json();
        const standings = (standingsData.standings?.results || []) as Array<any>;
        const managerMeta: Array<{ name: string; entryId: number }> = standings.map((r: any) => ({
          name: String(r.player_name),
          entryId: Number(r.entry),
        }));

        console.log(`[ProgressionView] Building progression from ${managerMeta.length} managers across ${gameweeks.length} gameweeks...`);

        // 3) Hent historikk (totals) for hver manager og bygg opp totalpoeng per GW
        const managerHistories = await Promise.all(
          managerMeta.map(async (m) => {
            try {
              const resp = await fetch(`/api/entry/${m.entryId}/history?ts=${Date.now()}`, { cache: 'no-store' as RequestCache });
              if (!resp.ok) throw new Error(`history ${m.entryId}: ${resp.status}`);
              const data = await resp.json();
              const totals = new Map<number, number>();
              const cumulativeTransfers = new Map<number, number>();
              let runningTransfers = 0;
              (data.current || []).forEach((ev: any) => {
                const gw = Number(ev.event);
                totals.set(gw, Number(ev.total_points) || 0);
                runningTransfers += Number(ev.event_transfers) || 0;
                cumulativeTransfers.set(gw, runningTransfers);
              });
              return { name: m.name, entryId: m.entryId, totals, cumulativeTransfers };
            } catch (e) {
              console.warn(`[ProgressionView] Failed fetching history for ${m.entryId}`, e);
              return { name: m.name, entryId: m.entryId, totals: new Map<number, number>(), cumulativeTransfers: new Map<number, number>() };
            }
          })
        );

        // 4) Beregn liga-rank for hver GW ved å sortere på total points (tie-break: GW points)
        const nameToSeries = new Map<string, Array<{ gw: number; rank: number }>>();
        managerMeta.forEach(m => nameToSeries.set(m.name, []));

        for (const gw of gameweeks) {
          const ranking = managerHistories.map(h => ({
            name: h.name,
            entryId: managerMeta.find(mm => mm.name === h.name)?.entryId ?? 99999999,
            total: h.totals.get(gw) ?? 0,
            transfers: h.cumulativeTransfers.get(gw) ?? 0,
          }));

          ranking.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total; // highest total first
            if (a.transfers !== b.transfers) return a.transfers - b.transfers; // fewer transfers first
            return a.entryId - b.entryId; // earlier registration (lower id) first
          });

          ranking.forEach((r, idx) => {
            const arr = nameToSeries.get(r.name)!;
            arr.push({ gw, rank: idx + 1 });
          });
        }

        // 5) Pakk til komponentens datastruktur og sorter etter siste GW
        const managers: ManagerProgression[] = Array.from(nameToSeries.entries()).map(([name, data]) => ({ name, data }));
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

  // Transform data for Recharts (all interpolation is now done during data building)
  const chartData: Array<Record<string, any>> = [];
  const allGameweeks = progressionData.gameweeks.sort((a, b) => a - b);
  
  // Build chart data structure - all managers should have data for all gameweeks
  for (const gw of allGameweeks) {
    const dataPoint: Record<string, any> = { gameweek: gw };
    
    for (const manager of progressionData.managers) {
      const gwData = manager.data.find(d => d.gw === gw);
      dataPoint[manager.name] = gwData ? gwData.rank : Math.ceil(progressionData.managers.length / 2);
    }
    
    chartData.push(dataPoint);
  }

  const colors = generateColors(progressionData.managers.length);
  const maxRank = Math.max(...progressionData.managers.flatMap(m => m.data.map(d => d.rank)));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Sorter payload etter rank for bedre oversikt
      const sortedPayload = [...payload].sort((a, b) => a.value - b.value);
      
      return (
        <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-lg p-3 shadow-lg max-h-64 overflow-y-auto">
          <p className="text-white font-bold mb-2 text-center">{`Gameweek ${label}`}</p>
          <div className="space-y-1">
            {sortedPayload.map((entry: any, index: number) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span style={{ color: entry.color }} className="font-medium">
                  {entry.dataKey}
                </span>
                <span className="text-white ml-2">
                  {entry.value}. plass
                </span>
              </div>
            ))}
          </div>
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
          <div className="relative h-[540px] w-full">
            {/* Custom Y-axis label overlay to avoid extra reserved width */}
            <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-white/80 text-xs">
              Tabellplassering
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: 48,
                  right: 80,
                  left: 80,
                  bottom: 88,
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
                  width={isMobile ? 44 : 56}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{
                    paddingTop: '12px',
                    fontSize: '12px',
                    color: '#ffffff',
                  }}
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                  onMouseEnter={(entry: any) => setHoveredManager(entry.value)}
                  onMouseLeave={() => setHoveredManager(null)}
                />
                {progressionData.managers.map((manager, index) => {
                  const isHovered = hoveredManager === manager.name;
                  const shouldFade = hoveredManager !== null && !isHovered;
                  
                  return (
                    <Line
                      key={manager.name}
                      type="monotone"
                      dataKey={manager.name}
                      stroke={colors[index]}
                      strokeWidth={isHovered ? 3 : 1.5}
                      strokeOpacity={shouldFade ? 0.3 : 1}
                      dot={{ r: 2, fillOpacity: shouldFade ? 0.3 : 1 }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                      connectNulls={false}
                    />
                  );
                })}
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
