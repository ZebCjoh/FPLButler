import { useState, useEffect } from 'react';
import { getHighlights } from './logic/metrics';
import { generateButlerAssessment } from './logic/butler';

export const App = () => {
  const [standings, setStandings] = useState<any[]>([]);
  const [currentGameweek, setCurrentGameweek] = useState<number>(1);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [butlerAssessment, setButlerAssessment] = useState<string>('');

  // Dynamiske høydepunkter kommer fra metrics.getHighlights i weeklyStats.highlights

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);

        // 1) Bootstrap for metadata (players, events, next deadline, current gw)
        console.log('[App] Fetching bootstrap data...');
        const bootstrapResponse = await fetch('/api/bootstrap-static');
        if (!bootstrapResponse.ok) {
          console.error('[App] Bootstrap fetch failed:', bootstrapResponse.status, bootstrapResponse.statusText);
          throw new Error(`Bootstrap API failed: ${bootstrapResponse.status}`);
        }
        const bootstrapData = await bootstrapResponse.json();
        const elements = bootstrapData.elements as any[]; // players
        const elementIdToName: Record<number, string> = {};
        elements.forEach((el) => {
          elementIdToName[el.id] = el.web_name;
        });
        const currentGW = bootstrapData.events.find((event: any) => event.is_current)?.id || 1;
        setCurrentGameweek(currentGW);

        // 2) League standings
        console.log('[App] Fetching league standings...');
        const standingsResponse = await fetch('/api/league/155099');
        if (!standingsResponse.ok) {
          console.error('[App] Standings fetch failed:', standingsResponse.status, standingsResponse.statusText);
          throw new Error(`Standings API failed: ${standingsResponse.status}`);
        }
        const standingsData = await standingsResponse.json();
        const leagueEntriesWithLeague = standingsData.standings.results as any[];
        // Add league name to each entry for easier access
        const leagueEntriesWithLeagueWithLeague = leagueEntriesWithLeague.map((entry: any) => ({
          ...entry,
          league_name: standingsData.league.name
        }));
        setStandings(leagueEntriesWithLeagueWithLeague);

        // 3) Live GW data for player points map
        console.log('[App] Fetching live gameweek data...');
        const liveResponse = await fetch(`/api/event/${currentGW}/live`);
        if (!liveResponse.ok) {
          console.error('[App] Live data fetch failed:', liveResponse.status, liveResponse.statusText);
          throw new Error(`Live data API failed: ${liveResponse.status}`);
        }
        const liveData = await liveResponse.json();
        const pointsByElement: Record<number, number> = {};
        (liveData.elements || []).forEach((e: any) => {
          pointsByElement[e.id] = e.stats.total_points;
        });

        // Helper to fetch JSON safely
        const safeJson = async (url: string) => {
          const r = await fetch(url);
          const ct = r.headers.get('content-type') || '';
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          if (!ct.includes('application/json')) throw new Error('Non-JSON response');
          return r.json();
        };

        // 4) Per-entry data: picks (chip + bench) and history (form) and transfers (ROI)
        const entryIds = leagueEntriesWithLeagueWithLeague.map((r: any) => r.entry);

        // Fetch in small batches to be nice
        const chunk = <T,>(arr: T[], size: number) => arr.reduce<T[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);

        const picksByEntry: Record<number, any> = {};
        const historyByEntry: Record<number, any> = {};
        const transfersByEntry: Record<number, any[]> = {};

        for (const group of chunk(entryIds, 5)) {
          await Promise.all(
            group.map(async (entryId) => {
              try {
                const [picks, history, transfers] = await Promise.all([
                  safeJson(`/api/entry/${entryId}/event/${currentGW}/picks`).catch(() => null),
                  safeJson(`/api/entry/${entryId}/history`).catch(() => null),
                  safeJson(`/api/entry/${entryId}/transfers`).catch(() => []),
                ]);
                if (picks) picksByEntry[entryId] = picks;
                if (history) historyByEntry[entryId] = history;
                transfersByEntry[entryId] = Array.isArray(transfers) ? transfers : [];
              } catch (_) {
                // Ignore individual failures to keep UI responsive
              }
            })
          );
        }

        // 4a) Form data - will be fetched separately from new API
        let formData = {
          window: 3,
          currentGw: currentGW,
          hot: [] as Array<{entryId: number; managerName: string; teamName: string; points: number}>,
          cold: [] as Array<{entryId: number; managerName: string; teamName: string; points: number}>
        };

        try {
          const formResponse = await fetch(`/api/league/155099/form?window=3`);
          if (formResponse.ok) {
            formData = await formResponse.json();
          }
        } catch (error) {
          console.error('Failed to fetch form data:', error);
        }

        // Client-side computation built from fetched history for robustness
        const fallbackWindow = Math.min(3, currentGW);
        const gwSet = new Set<number>();
        for (let i = 0; i < fallbackWindow; i++) {
          const gw = currentGW - i;
          if (gw >= 1) gwSet.add(gw);
        }

        const computed = leagueEntriesWithLeague.map((row: any) => {
          const entryId = row.entry;
          const hist = historyByEntry[entryId]?.current || [];
          const points = hist
            .filter((h: any) => gwSet.has(h.event))
            .reduce((sum: number, h: any) => sum + (h.points || 0), 0);
          return {
            entryId,
            managerName: row.player_name,
            teamName: row.entry_name,
            points,
          };
        });

        const sorted = [...computed].sort((a, b) => b.points - a.points);
        if (!formData.hot?.length || !formData.cold?.length) {
          formData = {
            window: fallbackWindow,
            currentGw: currentGW,
            hot: sorted.slice(0, 3),
            cold: sorted.slice(-3).reverse(),
          };
        }

        // Legacy format for compatibility
        const formTable = {
          hotStreak: formData.hot.map(entry => ({
            teamName: entry.teamName,
            manager: entry.managerName,
            formPoints: entry.points
          })),
          coldStreak: formData.cold.map(entry => ({
            teamName: entry.teamName,
            manager: entry.managerName,
            formPoints: entry.points
          }))
        };

        console.debug('[Form] window:', formData.window, 'hot:', formTable.hotStreak.length, 'cold:', formTable.coldStreak.length);

        // 4b) Bench points + chips used (from picks) + captain distribution
        const benchByEntry: Record<number, number> = {};
        const chipUses: Array<{ teamName: string; chip: string; emoji: string }> = [];
        const chipEmoji: Record<string, string> = {
          triple_captain: '⚡',
          wildcard: '🃏',
          freehit: '🎯',
          bench_boost: '🏟️',
        };
        const captainCount: Record<number, number> = {};
        leagueEntriesWithLeague.forEach((row: any) => {
          const entryId = row.entry;
          const picks = picksByEntry[entryId];
          if (picks?.picks) {
            const bench = picks.picks
              .filter((p: any) => p.multiplier === 0)
              .reduce((sum: number, p: any) => sum + (pointsByElement[p.element] || 0), 0);
            benchByEntry[entryId] = bench;
            const cap = picks.picks.find((p: any) => p.is_captain);
            if (cap) captainCount[cap.element] = (captainCount[cap.element] || 0) + 1;
          } else {
            benchByEntry[entryId] = 0;
          }
          const chip = picks?.active_chip;
          if (chip) {
            chipUses.push({ teamName: row.entry_name, chip, emoji: chipEmoji[chip] || '🎯' });
          }
        });

        // 4c) Transfer ROI for current GW
        const roiRows: Array<{ teamName: string; manager: string; transfersIn: Array<{ name: string; points: number }>; totalROI: number }>
          = leagueEntriesWithLeague.map((row: any) => {
            const entryId = row.entry;
            const transfers = (transfersByEntry[entryId] || []).filter((t: any) => t.event === currentGW);
            const transfersInPoints = transfers.map((t: any) => {
              const pts = pointsByElement[t.element_in] || 0;
              const name = elementIdToName[t.element_in] || `#${t.element_in}`;
              return { name, points: pts };
            });
            const totalROI = transfersInPoints.reduce((s, x) => s + x.points, 0);
            return {
              teamName: row.entry_name,
              manager: row.player_name,
              transfersIn: transfersInPoints,
              totalROI,
            };
          }).sort((a, b) => b.totalROI - a.totalROI);

        // 4d) Differential hero within league (fewest owners, highest points)
        const ownershipCount: Record<number, number> = {};
        leagueEntriesWithLeague.forEach((row: any) => {
          const entryId = row.entry;
          const picks = picksByEntry[entryId]?.picks || [];
          picks.forEach((p: any) => {
            ownershipCount[p.element] = (ownershipCount[p.element] || 0) + 1;
          });
        });
        let diffCandidate: { id: number; owners: number; points: number } | null = null;
        Object.keys(ownershipCount).forEach((idStr) => {
          const id = Number(idStr);
          const owners = ownershipCount[id];
          const pts = pointsByElement[id] || 0;
          if (owners > 0) {
            if (
              !diffCandidate ||
              owners < (diffCandidate?.owners || Infinity) ||
              (owners === diffCandidate?.owners && pts > (diffCandidate?.points || -1))
            ) {
              diffCandidate = { id, owners, points: pts };
            }
          }
        });
        const diffOwners: string[] = [];
        const diffManagers: string[] = [];
        if (diffCandidate) {
          leagueEntriesWithLeague.forEach((row: any) => {
            const entryId = row.entry;
            const picks = picksByEntry[entryId]?.picks || [];
            if (picks.some((p: any) => p.element === diffCandidate!.id)) {
              diffOwners.push(row.entry_name);
              diffManagers.push(row.player_name);
            }
          });
        }

        // 5) Build weekly stats object
        const nextEvent = bootstrapData.events.find((e: any) => !e.finished && !e.is_current);
        const weekWinner = [...leagueEntriesWithLeague]
          .map((row: any) => ({
            teamName: row.entry_name,
            manager: row.player_name,
            points: row.event_total || 0,
          }))
          .sort((a, b) => b.points - a.points)[0];
        const weekLoser = [...leagueEntriesWithLeague]
          .map((row: any) => ({
            teamName: row.entry_name,
            manager: row.player_name,
            points: row.event_total || 0,
          }))
          .sort((a, b) => a.points - b.points)[0];

        // Movements using rank vs last_rank if present
        const movementsCalc = leagueEntriesWithLeague
          .map((row: any) => ({
            teamName: row.entry_name,
            manager: row.player_name,
            change: (row.last_rank || row.rank) - row.rank,
          }));
        const riser = movementsCalc.sort((a, b) => b.change - a.change)[0];
        const faller = movementsCalc.sort((a, b) => a.change - b.change)[0];

        // Highlights (hero, chips, captain)
        let highlights: { id: number; text: string }[] = [];
        try {
          highlights = await getHighlights(currentGW, 155099);
        } catch (e) {
          console.debug('getHighlights failed', e);
          highlights = [];
        }
        console.debug('Highlights:', highlights);

        let differential: {
          player: string;
          points: number;
          ownership: number;
          owners: string[];
          managers: string[];
        };
        if (diffCandidate !== null) {
          const dc = diffCandidate as { id: number; owners: number; points: number };
          differential = {
            player: elementIdToName[dc.id] || `#${dc.id}`,
            points: dc.points,
            ownership: diffOwners.length,
            owners: diffOwners,
            managers: diffManagers,
          };
        } else {
          differential = { player: '-', points: 0, ownership: 0, owners: [], managers: [] };
        }

        const weekly = {
          weekWinner,
          weekLoser,
          benchWarmer: Object.entries(benchByEntry)
            .map(([entryId, bench]) => {
              const row = leagueEntriesWithLeague.find((r: any) => r.entry === Number(entryId));
              return { 
                teamName: row?.entry_name || 'Ukjent', 
                manager: row?.player_name || 'Ukjent',
                benchPoints: bench as number 
              };
            })
            .sort((a: any, b: any) => (b.benchPoints as number) - (a.benchPoints as number))[0],
          chipsUsed: chipUses,
          movements: {
            riser: { teamName: riser?.teamName || '-', manager: riser?.manager || '-', change: Math.max(0, riser?.change || 0) },
            faller: { teamName: faller?.teamName || '-', manager: faller?.manager || '-', change: Math.min(0, faller?.change || 0) },
          },
          nextDeadline: nextEvent ? {
            date: new Date(nextEvent.deadline_time).toLocaleDateString('no-NO'),
            time: new Date(nextEvent.deadline_time).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }),
            gameweek: nextEvent.id,
          } : { date: 'TBA', time: 'TBA', gameweek: currentGW + 1 },
          formTable: {
            hotStreak: formTable.hotStreak,
            coldStreak: formTable.coldStreak,
          },
          formData,
          transferROI: {
            genius: roiRows[0],
            flop: roiRows[roiRows.length - 1],
          },
          differential,
          highlights,
        };

        console.debug('[Weekly] form counts -> hot:', weekly.formTable.hotStreak.length, 'cold:', weekly.formTable.coldStreak.length);
        setWeeklyStats(weekly);
        
        // Generate Butler's Assessment based on gameweek data
        const assessment = generateButlerAssessment({
          weeklyStats: weekly
        });
        
        setButlerAssessment(assessment);
        setError(null);
    } catch (err) {
        console.error('Error fetching data:', err);
        setError('Kunne ikke hente ligadata. Prøv å refreshe siden.');
    } finally {
      setLoading(false);
    }
  };

    fetchAllData();
  }, []);

  // Removed mock generator; now computing real weekly stats in useEffect above

  // Get top 3 and bottom 3 from real data (or empty if feil)
  const topThree = standings.slice(0, 3).map((team, index) => ({
    rank: index + 1,
    teamName: team.entry_name,
    manager: team.player_name,
    points: team.total
  }));

  const bottomThree = standings.slice(-3).map((team, index) => ({
    rank: standings.length - 2 + index,
    teamName: team.entry_name,
    manager: team.player_name,
    points: team.total
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] relative overflow-hidden">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Compact Header */}
        <header className="text-center mb-8">
          <div className="inline-block px-6 py-4 rounded-2xl bg-[#3D195B] border-2 border-[#00E0D3] mb-4 shadow-xl">
            <div className="flex items-center justify-center gap-4">
              <img 
                src="/fpl-butler.png" 
                alt="FPL Butler" 
                className="h-12 w-12 rounded-full ring-2 ring-cyan-300 shadow-md object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
                FPL Butler
              </h1>
            </div>
          </div>
          <div className="text-white">
            <p className="text-lg font-light mb-1">Ukentlig oppsummering</p>
            <p className="text-base font-medium mb-1">Liga: {standings[0]?.league_name || 'Bekk Liga'}</p>
            <p className="text-base font-medium">Gameweek {currentGameweek}</p>
          </div>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00E0D3]"></div>
            <p className="mt-4 text-lg text-white">Henter ligadata...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-2xl p-6 text-center">
            <span className="text-4xl mb-2 block">❌</span>
            <h3 className="text-xl font-bold text-white mb-2">Ops! Noe gikk galt</h3>
            <p className="text-gray-300">{error}</p>
          </div>
        )}

        {/* Butler's Assessment Section */}
        {!loading && !error && butlerAssessment && (
          <section className="mb-8">
            <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-2xl p-6 max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-2xl">
                  🍷
                </div>
                <h3 className="text-xl font-bold text-white">Butlerens vurdering</h3>
              </div>
              <div className="bg-[#00E0D3]/10 rounded-lg p-4">
                <p className="text-white leading-relaxed text-sm">
                  {butlerAssessment}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Main Content - 2 Column Layout */}
        {!loading && !error && (
          <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Compact Top 3 Podium Section */}
              <section>
                <div className="text-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    🏆 Topp 3
                  </h2>
                  <p className="text-white/80 text-sm">De beste lagene i ligaen</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {topThree.map(({ rank, teamName, manager, points }) => (
                    <div
                      key={rank}
                      className={`
                        relative group cursor-pointer transform transition-all duration-300 hover:scale-105
                        ${rank === 1 ? 'md:order-2' : rank === 2 ? 'md:order-1 md:mt-4' : 'md:order-3 md:mt-4'}
                      `}
                    >
                      {/* Smaller Podium Cards */}
                      <div className={`
                        relative overflow-visible rounded-xl shadow-xl border-2
                        ${rank === 1 
                          ? 'bg-[#3D195B] border-[#FFD700] h-48' 
                          : rank === 2
                          ? 'bg-[#360D3A] border-[#00E0D3]/80 h-48'
                          : 'bg-[#2D0A2E] border-[#00E0D3]/60 h-48'
                        }
                      `}>
                        
                        <div className="relative z-10 p-4 h-full flex flex-col justify-center items-center text-center">
                          {/* Rank Badge */}
                          <div className={`
                            w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center text-xl font-bold shadow-lg border-2
                            ${rank === 1 
                              ? 'bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black border-white' 
                              : 'bg-[#00E0D3]/80 text-[#3D195B] border-white/80'
                            }
                          `}>
                            {rank}
                          </div>
                          
                          {/* Team Info with consistent spacing */}
                          <h3 className="text-sm font-bold text-white mb-1 leading-tight px-1 break-words">
                            {teamName}
                          </h3>
                          <p className="text-xs text-white/90 mb-3 font-medium">av {manager}</p>
                          
                          {/* Points Display with consistent spacing */}
                          <div className="bg-[#00E0D3]/20 border border-[#00E0D3] rounded-lg p-3 w-full mt-auto">
                            <div className="text-xl font-bold text-white">
                              {points}
                            </div>
                            <div className="text-white/90 text-xs">poeng</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Compact Bottom 3 Section */}
              <section>
                <div className="text-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">📉 Bunn 3</h2>
                  <p className="text-white/80 text-sm">Lagene som må skjerpe seg</p>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {bottomThree.map(({ rank, teamName, manager, points }, index) => (
                    <div
                      key={rank}
                      className={`
                        group border-2 rounded-xl p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg
                        ${index === 0 
                          ? 'bg-[#3D195B] border-[#00E0D3]/60' 
                          : index === 1
                          ? 'bg-[#360D3A] border-[#00E0D3]/80'
                          : 'bg-[#2D0A2E] border-[#00E0D3]'
                        }
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`
                          w-12 h-12 rounded-full border-2 border-white flex items-center justify-center font-bold text-sm shadow-lg
                          ${index === 0 
                            ? 'bg-red-600/70 text-white' 
                            : index === 1
                            ? 'bg-red-700/80 text-white'
                            : 'bg-red-800 text-white'
                          }
                        `}>
                          {rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white mb-1 truncate">{teamName}</h3>
                          <p className="text-white/80 text-xs truncate">av {manager}</p>
                        </div>
                        <div className="text-center bg-[#00E0D3]/20 border border-[#00E0D3] rounded-lg p-2">
                          <div className="text-lg font-bold text-white">{points}</div>
                          <div className="text-white/80 text-xs">poeng</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Compact Highlights Section */}
              <section>
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    ✨ Høydepunkter
                  </h2>
                  <p className="text-white/80 text-xs">Rundens mest interessante øyeblikk</p>
          </div>

                <div className="grid grid-cols-1 gap-3">
                  {Array.isArray(weeklyStats?.highlights) && weeklyStats.highlights.length > 0 ? (
                    weeklyStats.highlights.map((h: { id: number; text: string }, index: number) => (
                      <div 
                        key={h.id ?? index} 
                        className="group bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-lg p-3 transition-all duration-300 hover:border-[#00E0D3] hover:scale-105"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#00E0D3] border-2 border-white flex items-center justify-center text-[#3D195B] text-xs font-bold shadow-lg">
                            {index + 1}
                          </div>
                          <p className="text-white leading-relaxed text-sm flex-1">{h.text}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-white/80 text-sm">
                      Ingen høydepunkter tilgjengelig
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Right Column - Weekly Stats */}
            <div className="space-y-4">
              {weeklyStats && (
                <section>
                  <div className="text-center mb-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                      📊 Ukestatistikk
                    </h2>
                    <p className="text-white/80 text-sm">Gameweek {currentGameweek} høydepunkter</p>
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
                        <p className="text-white font-bold text-sm mb-1 truncate">{weeklyStats.weekWinner.teamName}</p>
                        <p className="text-white/80 text-xs mb-2 truncate">av {weeklyStats.weekWinner.manager}</p>
                        <div className="bg-[#00E0D3]/20 border border-[#00E0D3] rounded-lg p-2">
                          <span className="text-lg font-bold text-white">{weeklyStats.weekWinner.points}</span>
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
                        <p className="text-white font-bold text-sm mb-1 truncate">{weeklyStats.weekLoser.teamName}</p>
                        <p className="text-white/80 text-xs mb-2 truncate">av {weeklyStats.weekLoser.manager}</p>
                        <div className="bg-[#00E0D3]/20 border border-[#00E0D3]/60 rounded-lg p-2">
                          <span className="text-lg font-bold text-white">{weeklyStats.weekLoser.points}</span>
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
                        <p className="text-white font-bold text-sm mb-2 truncate">{weeklyStats.benchWarmer.manager}</p>
                        <div className="bg-[#00E0D3]/20 border border-[#00E0D3]/60 rounded-lg p-2">
                          <span className="text-lg font-bold text-white">{weeklyStats.benchWarmer.benchPoints}</span>
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
                        {weeklyStats.chipsUsed.length > 0 ? weeklyStats.chipsUsed.slice(0, 3).map((chip: any, index: number) => (
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
                            <span className="text-green-400 font-bold text-xs">+{weeklyStats.movements.riser.change}</span>
                          </div>
                          <p className="text-white text-xs truncate">{weeklyStats.movements.riser.manager}</p>
                        </div>
                        <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs">⬇️</span>
                            <span className="text-red-400 font-bold text-xs">{weeklyStats.movements.faller.change}</span>
                          </div>
                          <p className="text-white text-xs truncate">{weeklyStats.movements.faller.manager}</p>
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
                        <p className="text-white/80 text-xs mb-1">GW {weeklyStats.nextDeadline.gameweek}</p>
                        <div className="bg-[#00E0D3]/20 border border-[#00E0D3] rounded-lg p-2">
                          <p className="text-white font-bold text-sm">{weeklyStats.nextDeadline.date}</p>
                          <p className="text-white/80 text-xs">{weeklyStats.nextDeadline.time}</p>
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
                        <h3 className="text-sm font-bold text-white">Form (GW {weeklyStats.formData?.window || 3})</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-2">
                          <p className="text-green-400 font-bold text-xs mb-1">🔥 Hot</p>
                          {weeklyStats.formTable.hotStreak.length === 0 ? (
                            <p className="text-green-300/70 text-xs">Ingen data</p>
                          ) : (
                            weeklyStats.formTable.hotStreak.slice(0, 2).map((team: any, index: number) => (
                              <div key={index} className="flex justify-between items-center">
                                <span className="text-white text-xs truncate">{team.manager}</span>
                                <span className="text-green-300 font-bold text-xs">{team.formPoints}p</span>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-2">
                          <p className="text-red-400 font-bold text-xs mb-1">🧊 Cold</p>
                          {weeklyStats.formTable.coldStreak.length === 0 ? (
                            <p className="text-red-300/70 text-xs">Ingen data</p>
                          ) : (
                            weeklyStats.formTable.coldStreak.slice(0, 2).map((team: any, index: number) => (
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
                          <p className="text-white font-medium text-xs mb-1 truncate">{weeklyStats.transferROI.genius.manager}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-white/80 text-xs truncate">{weeklyStats.transferROI.genius.transfersIn[0]?.name || 'Ingen bytter'}</span>
                            <span className="text-green-300 font-bold text-xs">{weeklyStats.transferROI.genius.transfersIn[0]?.points || 0}p</span>
                          </div>
                        </div>
                        <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-xs">💸</span>
                            <span className="text-red-400 font-bold text-xs">Bom</span>
                          </div>
                          <p className="text-white font-medium text-xs mb-1 truncate">{weeklyStats.transferROI.flop.manager}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-white/80 text-xs truncate">{weeklyStats.transferROI.flop.transfersIn[0]?.name || 'Ingen bytter'}</span>
                            <span className="text-red-300 font-bold text-xs">{weeklyStats.transferROI.flop.transfersIn[0]?.points || 0}p</span>
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
                        <p className="text-purple-300 font-bold text-sm">{weeklyStats.differential.player}</p>
                        <div className="flex justify-center items-center gap-2 mt-1">
                          <span className="text-lg font-bold text-white">{weeklyStats.differential.points}</span>
                          <span className="text-white/60 text-xs">poeng</span>
                        </div>
                      </div>
                                              <div className="bg-[#00E0D3]/10 rounded-lg p-2">
                          <p className="text-white/80 text-xs mb-1">Eid av kun {weeklyStats.differential.ownership} lag</p>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {weeklyStats.differential.managers.slice(0, 3).map((manager: string, index: number) => (
                              <span key={index} className="text-white font-medium text-xs bg-[#00E0D3]/20 rounded px-2 py-1">{manager}</span>
                            ))}
                          </div>
                        </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Compact Info Section */}
              <section className="text-center">
                <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-lg">🚀</span>
                    <h3 className="text-base font-bold text-white">
                      Live FPL Data
                    </h3>
                  </div>
                  <p className="text-white/80 text-xs">
                    Dataene hentes direkte fra Fantasy Premier League API i sanntid.
                  </p>
                </div>
              </section>
            </div>
        </main>
        )}
      </div>
    </div>
  );
}

export default App;
  