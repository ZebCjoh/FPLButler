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

        // 2) Hent current standings fra live API for å få alle manager-navn som referanse
        const standingsResp = await fetch('/api/league/155099');
        if (!standingsResp.ok) throw new Error(`Standings API error: ${standingsResp.status}`);
        const standingsData = await standingsResp.json();
        const allManagerNames: Set<string> = new Set<string>(
          ((standingsData.standings?.results || []) as Array<any>).map((entry: any) => String(entry.player_name))
        );

        // 3) For hver gameweek, hent live standings data direkte fra FPL API
        const managerMap = new Map<string, Array<{ gw: number; rank: number }>>();
        
        // Initialiser alle managere
        for (const managerName of Array.from(allManagerNames.values())) {
          managerMap.set(String(managerName), []);
        }

        console.log(`[ProgressionView] Fetching progression data for ${gameweeks.length} gameweeks...`);

        // Hent historical standings for hver gameweek ved å rekonstruere fra snapshots og live data
        for (const gw of gameweeks) {
          try {
            console.log(`[ProgressionView] Processing GW${gw}...`);
            
            // Prøv først å få fullstendige standings fra snapshot hvis tilgjengelig
            const snapResp = await fetch(`/api/history/${gw}?ts=${Date.now()}`, { cache: 'no-store' as RequestCache });
            if (!snapResp.ok) continue;
            const snapshot = await snapResp.json();
            
            // Samle all rank-info fra snapshot
            const rankInfo = new Map<string, number>();
            
            // Legg til top3
            (snapshot.top3 || []).forEach((entry: any) => {
              rankInfo.set(entry.manager, entry.rank);
            });
            
            // Legg til bottom3
            (snapshot.bottom3 || []).forEach((entry: any) => {
              rankInfo.set(entry.manager, entry.rank);
            });
            
            // Legg til form data for mellomområdet
            const formHot = snapshot.form3?.hot || [];
            const formCold = snapshot.form3?.cold || [];
            const totalManagers = allManagerNames.size;
            
            // Plasser hot managere rundt plass 4-6
            formHot.forEach((manager: any, index: number) => {
              if (!rankInfo.has(manager.manager)) {
                const estimatedRank = 4 + index;
                if (estimatedRank <= totalManagers - 3) {
                  rankInfo.set(manager.manager, estimatedRank);
                }
              }
            });
            
            // Plasser cold managere i bunnen av midtfeltet
            formCold.forEach((manager: any, index: number) => {
              if (!rankInfo.has(manager.manager)) {
                const estimatedRank = totalManagers - 3 - (formCold.length - 1 - index);
                if (estimatedRank >= 4) {
                  rankInfo.set(manager.manager, estimatedRank);
                }
              }
            });
            
            // For gjenværende managere, esTimer ranks basert på posisjoner vi vet
            const knownRanks = Array.from(rankInfo.values()).sort((a, b) => a - b);
            const missingManagers = Array.from(allManagerNames.values()).filter((name: string) => !rankInfo.has(name));
            
            // Finn ledige posisjoner
            const availableRanks: number[] = [];
            for (let rank = 1; rank <= totalManagers; rank++) {
              if (!knownRanks.includes(rank)) {
                availableRanks.push(rank);
              }
            }
            
            // Tilordne ledige ranks til gjenværende managere
            missingManagers.forEach((managerName: string, index: number) => {
              if (index < availableRanks.length) {
                rankInfo.set(String(managerName), availableRanks[index]);
              } else {
                // Fallback: gi en gjennomsnittsrank
                rankInfo.set(String(managerName), Math.ceil(totalManagers / 2));
              }
            });
            
            // Legg til data for alle managere for denne gameweek
            for (const [managerName, rank] of rankInfo.entries()) {
              const key = String(managerName);
              if (managerMap.has(key)) {
                managerMap.get(key)!.push({ gw, rank });
              }
            }
            
            console.log(`[ProgressionView] GW${gw}: Got ${rankInfo.size} manager ranks`);

          } catch (err) {
            console.warn(`Failed to process GW${gw}:`, err);
          }
        }

        // 4) Bygg fullstendige progresjonsprofiler for alle managere
        const managers: ManagerProgression[] = [];
        for (const [name, rawData] of managerMap.entries()) {
          // Sorter data etter gameweek
          const sortedData = rawData.sort((a, b) => a.gw - b.gw);
          
          // Sørg for at manageren har data for alle gameweeks (med interpolering)
          const completeData: Array<{ gw: number; rank: number }> = [];
          
          for (const gw of gameweeks) {
            const existingData = sortedData.find(d => d.gw === gw);
            if (existingData) {
              completeData.push(existingData);
            } else {
              // Interpoler eller estimer basert på tilgjengelige data
              const prevData = sortedData.filter(d => d.gw < gw).sort((a, b) => b.gw - a.gw)[0];
              const nextData = sortedData.filter(d => d.gw > gw).sort((a, b) => a.gw - b.gw)[0];
              
              let estimatedRank: number;
              if (prevData && nextData) {
                // Linear interpolering
                const ratio = (gw - prevData.gw) / (nextData.gw - prevData.gw);
                estimatedRank = Math.round(prevData.rank + (nextData.rank - prevData.rank) * ratio);
              } else if (prevData) {
                // Bruk forrige rank
                estimatedRank = prevData.rank;
              } else if (nextData) {
                // Bruk neste rank
                estimatedRank = nextData.rank;
              } else {
                // Fallback til midtfeld
                estimatedRank = Math.ceil(allManagerNames.size / 2);
              }
              
              completeData.push({ gw, rank: estimatedRank });
            }
          }
          
          // Legg til manager med komplette data
          if (completeData.length > 0) {
            managers.push({ name, data: completeData });
          }
        }

        // Sorter managere etter siste gameweek rank
        const latestGw = Math.max(...gameweeks);
        managers.sort((a, b) => {
          const ar = a.data.find(d => d.gw === latestGw)?.rank ?? 999;
          const br = b.data.find(d => d.gw === latestGw)?.rank ?? 999;
          return ar - br;
        });

        console.log(`[ProgressionView] Built progression for ${managers.length} managers across ${gameweeks.length} gameweeks`);
        console.log(`[ProgressionView] Sample data:`, managers.slice(0, 2).map(m => ({ 
          name: m.name, 
          dataPoints: m.data.length,
          firstGW: m.data[0]?.gw,
          lastGW: m.data[m.data.length - 1]?.gw 
        })));
        
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
          <div className="h-[580px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: 48,
                  right: 85,
                  left: isMobile ? 60 : 105,
                  bottom: 95,
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
                  label={{ value: 'Tabellplassering', angle: -90, position: 'middle', style: { fill: '#ffffff80', textAnchor: 'middle' } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{
                    paddingTop: '15px',
                    fontSize: '12px',
                    color: '#ffffff',
                    paddingBottom: '5px',
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
