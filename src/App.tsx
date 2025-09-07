import { useState, useEffect } from 'react';
import { getHighlights } from './logic/metrics';
import { calculateDifferentialHero } from './logic/differentialHero';
import GameweekView from './components/GameweekView';
import ProgressionView from './components/ProgressionView';
import HeaderSection from './components/HeaderSection';
import ButlerAssessment from './components/ButlerAssessment';
import TopThreeSection from './components/TopThreeSection';
import BottomThreeSection from './components/BottomThreeSection';
import HighlightsSection from './components/HighlightsSection';
import WeeklyStatsSection from './components/WeeklyStatsSection';

export const App = () => {
  const [standings, setStandings] = useState<any[]>([]);
  const [currentGameweek, setCurrentGameweek] = useState<number | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [loadingStates, setLoadingStates] = useState({
    bootstrap: true,
    standings: true,
    liveData: true,
    aiSummary: true
  });
  const [error, setError] = useState<string | null>(null);
  const [butlerAssessment, setButlerAssessment] = useState<string>('');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'gameweek' | 'progression'>('home');
  const [selectedGameweek, setSelectedGameweek] = useState<number | null>(null);

  // Dynamiske høydepunkter kommer fra metrics.getHighlights i weeklyStats.highlights

  // Load cached data immediately on mount
  useEffect(() => {
    const loadCachedData = () => {
      try {
        const cachedStandings = localStorage.getItem('fpl-standings');
        const cachedGameweek = localStorage.getItem('fpl-gameweek');
        const cachedButlerAssessment = localStorage.getItem('ai-summary-current');
        
        if (cachedStandings) {
          console.log('[App] Loading cached standings');
          setStandings(JSON.parse(cachedStandings));
          setLoadingStates(prev => ({ ...prev, standings: false }));
        }
        
        if (cachedGameweek) {
          console.log('[App] Loading cached gameweek');
          setCurrentGameweek(JSON.parse(cachedGameweek));
          setLoadingStates(prev => ({ ...prev, bootstrap: false }));
        }
        
        if (cachedButlerAssessment) {
          console.log('[App] Loading cached AI summary');
          const cached = JSON.parse(cachedButlerAssessment);
          setButlerAssessment(cached.summary || '');
          setLoadingStates(prev => ({ ...prev, aiSummary: false }));
        }
      } catch (e) {
        console.warn('[App] Failed to load cached data:', e);
      }
    };
    
    loadCachedData();
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // 1) Bootstrap for metadata (players, events, next deadline, current gw)
        console.log('[App] Fetching bootstrap data...');
        const bootstrapResponse = await fetch('/api/bootstrap-static', { cache: 'no-store' as RequestCache });
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
        localStorage.setItem('fpl-gameweek', JSON.stringify(currentGW));
        setLoadingStates(prev => ({ ...prev, bootstrap: false }));

        // 2) Butler's Assessment: Fetch early since it's displayed at the top
        const fetchAISummary = async () => {
          try {
            console.log('[App] Fetching AI summary from backend...');
            const aiResponse = await fetch(`/api/ai-summary?ts=${Date.now()}`, { cache: 'no-store' });
            
            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const summaryText = aiData.summary || '';
              console.log('[App] Loaded AI summary payload:', aiData);
              setButlerAssessment(summaryText);
              localStorage.setItem('ai-summary-current', JSON.stringify(aiData));
            } else if (aiResponse.status === 404) {
              console.log('[App] No AI summary available in backend yet');
              setButlerAssessment("Butleren forbereder en vurdering av ukens prestasjoner. Vennligst vent mens han observerer kompetansen.");
            } else {
              throw new Error(`AI summary API failed: ${aiResponse.status}`);
            }
          } catch (aiError) {
            console.warn('[App] Failed to fetch AI summary from backend:', aiError);
            setButlerAssessment("Butleren er for opptatt med å observere kompetente mennesker til å kommentere akkurat nå.");
          }
          setLoadingStates(prev => ({ ...prev, aiSummary: false }));
        };

        // Start AI summary fetch in parallel (non-blocking)
        fetchAISummary();

        // 3) League standings
        console.log('[App] Fetching league standings...');
        const standingsResponse = await fetch('/api/league/155099', { cache: 'no-store' as RequestCache });
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
        localStorage.setItem('fpl-standings', JSON.stringify(leagueEntriesWithLeagueWithLeague));
        setLoadingStates(prev => ({ ...prev, standings: false }));

        // 3) Live GW data for player points map
        console.log('[App] Fetching live gameweek data...');
        const liveResponse = await fetch(`/api/event/${currentGW}/live`, { cache: 'no-store' as RequestCache });
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
          const r = await fetch(url, { cache: 'no-store' as RequestCache });
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

        // 4d) Differential hero within league (deterministic calculation)
        const ownershipCount: Record<number, number> = {};
        leagueEntriesWithLeague.forEach((row: any) => {
          const entryId = row.entry;
          const picks = picksByEntry[entryId]?.picks || [];
          picks.forEach((p: any) => {
            ownershipCount[p.element] = (ownershipCount[p.element] || 0) + 1;
          });
        });

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

        // Calculate differential hero using deterministic logic
        const differential = calculateDifferentialHero(
          ownershipCount,
          pointsByElement,
          elementIdToName,
          leagueEntriesWithLeague,
          picksByEntry
        );

        const weekly = {
          weekWinner,
          weekLoser,
          benchWarmer: Object.entries(benchByEntry)
            .map(([entryId, bench]) => {
              const row = leagueEntriesWithLeague.find((r: any) => r.entry === Number(entryId));
              return { 
                entryId: Number(entryId),
                teamName: row?.entry_name || 'Ukjent', 
                manager: row?.player_name || 'Ukjent',
                benchPoints: bench as number 
              };
            })
            .sort((a: any, b: any) => {
              // Primary sort: bench points (descending)
              const pointsDiff = (b.benchPoints as number) - (a.benchPoints as number);
              if (pointsDiff !== 0) return pointsDiff;
              
              // Tie-breaker: entry ID (ascending for consistency)
              return (a.entryId as number) - (b.entryId as number);
            })
            .filter((entry, index) => {
              // Debug logging
              console.debug(`[Bench] ${index + 1}. ${entry.manager}: ${entry.benchPoints}p (ID: ${entry.entryId})`);
              return true;
            })
            .map((entry, index) => {
              if (index === 0) {
                console.log(`[Bench] Winner: ${entry.manager} with ${entry.benchPoints}p`);
              }
              return entry;
            })[0],
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
          differential: {
            player: differential.player,
            points: differential.points,
            ownership: differential.ownership,
            owners: differential.ownedBy,
            managers: differential.managers
          },
          highlights,
        };

        console.debug('[Weekly] form counts -> hot:', weekly.formTable.hotStreak.length, 'cold:', weekly.formTable.coldStreak.length);
        setWeeklyStats(weekly);
        setLoadingStates(prev => ({ ...prev, liveData: false }));
        
        // 5) Fetch history data for dropdown
        try {
          console.log('[App] Fetching history data...');
          const historyResponse = await fetch('/api/history');
          if (historyResponse.ok) {
            const history = await historyResponse.json();
            setHistoryData(history);
            console.log('[App] History data loaded:', history.length, 'items');
          }
        } catch (historyError) {
          console.warn('[App] Failed to fetch history data:', historyError);
        }
        
        // AI Summary is now fetched earlier in parallel
        setError(null);
    } catch (err) {
        console.error('Error fetching data:', err);
        setError('Kunne ikke hente ligadata. Prøv å refreshe siden.');
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

  // Handle back to home navigation
  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedGameweek(null);
  };

  // Render gameweek view if selected
  if (currentView === 'gameweek' && selectedGameweek !== null) {
    return (
      <GameweekView 
        gameweekId={selectedGameweek} 
        onBackToHome={handleBackToHome}
      />
    );
  }

  // Render progression view if selected
  if (currentView === 'progression') {
    return (
      <ProgressionView 
        onBackToHome={handleBackToHome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B27E8] via-[#3E9BF9] to-[#00E0D3] relative overflow-hidden">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <HeaderSection 
          leagueName={standings[0]?.league_name || 'Laster liga...'} 
          currentGameweek={currentGameweek} 
        />

        {/* Show static UI immediately - no more blocking loading state */}

        {/* Error State */}
        {error && (
          <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-2xl p-6 text-center">
            <span className="text-4xl mb-2 block">❌</span>
            <h3 className="text-xl font-bold text-white mb-2">Ops! Noe gikk galt</h3>
            <p className="text-gray-300">{error}</p>
          </div>
        )}

        {/* Butler's Assessment Section */}
        {!error && (
          <ButlerAssessment 
            assessment={butlerAssessment} 
            isLoading={loadingStates.aiSummary} 
          />
        )}

        {/* Main Content - 2 Column Layout */}
        {!error && (
          <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              <TopThreeSection 
                topThree={topThree} 
                isLoading={loadingStates.standings} 
              />

              <BottomThreeSection 
                bottomThree={bottomThree} 
                isLoading={loadingStates.standings} 
              />

              <HighlightsSection 
                highlights={weeklyStats?.highlights || []} 
                isLoading={loadingStates.liveData} 
              />
            </div>

            {/* Right Column - Weekly Stats */}
            <div className="space-y-4">
              <WeeklyStatsSection 
                weeklyStats={weeklyStats || {}} 
                currentGameweek={currentGameweek} 
                isLoading={loadingStates.liveData} 
              />


              {/* Progression Button */}
              <section className="mt-8">
                <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-4">
                  <div className="text-center">
                    <button 
                      onClick={() => setCurrentView('progression')}
                      className="bg-[#00E0D3] text-[#3D195B] px-6 py-3 rounded-lg font-bold hover:bg-[#00E0D3]/80 transition-all duration-300 shadow-lg w-full"
                    >
                      📈 Se utvikling i tabellen
                    </button>
                    <p className="text-white/70 text-xs mt-2">
                      Følg hvordan alle managerne har beveget seg over tid
                    </p>
                  </div>
                </div>
              </section>

              {/* History Dropdown */}
              <section className="mt-8">
                <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="text-lg">📚</span>
                    <h3 className="text-base font-bold text-white">Gameweek Historikk</h3>
                  </div>
                  <div className="flex justify-center">
                    <select 
                      className="bg-purple-800 text-white rounded-lg px-4 py-2 border-2 border-[#00E0D3]/60 hover:border-[#00E0D3] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#00E0D3] cursor-pointer min-w-[250px]"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          // Extract gameweek ID from URL (e.g., "/gw/1" -> "1")
                          const gwId = e.target.value.split('/').pop() || '';
                          setSelectedGameweek(Number(gwId));
                          setCurrentView('gameweek');
                        }
                      }}
                    >
                      <option value="" disabled>Velg Gameweek</option>
                      {historyData.map((item) => (
                        <option key={item.id} value={item.url} className="bg-purple-800 text-white">
                          Gameweek {item.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-white/70 text-xs text-center mt-2">
                    Se tidligere gameweeks og resultater
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
  