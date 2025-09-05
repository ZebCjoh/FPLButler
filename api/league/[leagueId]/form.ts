
interface BootstrapEvent {
  id: number;
  is_current: boolean;
  finished: boolean;
}

interface BootstrapData {
  events: BootstrapEvent[];
}

interface LeagueEntry {
  entry: number;
  entry_name: string;
  player_name: string;
}

interface LeagueStandings {
  results: LeagueEntry[];
}

interface HistoryEvent {
  event: number;
  points: number;
}

interface HistoryData {
  current: HistoryEvent[];
}

interface FormEntry {
  entryId: number;
  managerName: string;
  teamName: string;
  points: number;
}

interface FormResponse {
  window: number;
  currentGw: number;
  hot: FormEntry[];
  cold: FormEntry[];
}

// Helper function to limit concurrent requests
async function processInBatches<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  batchSize: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);
  }
  
  return results;
}

async function safeJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://fantasy.premierleague.com/',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON, got ${contentType}`);
  }

  return response.json();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const urlObj = new URL(req.url);
  const segments = urlObj.pathname.split('/');
  const leagueId = segments[3];
  const windowParam = urlObj.searchParams.get('window');
  const window = windowParam ? parseInt(String(windowParam)) : 3;

  if (!leagueId) {
    return new Response(JSON.stringify({ error: 'Invalid league ID' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (isNaN(window) || window < 1 || window > 10) {
    return new Response(JSON.stringify({ error: 'Window must be between 1 and 10' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    console.log(`[API] Calculating form for league ${leagueId} with window ${window}...`);

    // Step 1: Get current gameweek
    const bootstrap: BootstrapData = await safeJson('https://fantasy.premierleague.com/api/bootstrap-static/');
    
    let currentGw = 1;
    const currentEvent = bootstrap.events.find(e => e.is_current);
    if (currentEvent) {
      currentGw = currentEvent.id;
    } else {
      // If no current event, find the last finished event
      const finishedEvents = bootstrap.events.filter(e => e.finished);
      if (finishedEvents.length > 0) {
        currentGw = Math.max(...finishedEvents.map(e => e.id));
      }
    }

    // Step 2: Get league standings
    const standings: LeagueStandings = await safeJson(`https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`);
    
    if (!standings.results || standings.results.length === 0) {
      return new Response(JSON.stringify({ error: 'No entries found in league' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Step 3: Calculate actual window based on current GW
    const actualWindow = Math.min(window, currentGw);
    const gameweeksToCheck: number[] = [];
    for (let i = 0; i < actualWindow; i++) {
      const gw = currentGw - i;
      if (gw >= 1) {
        gameweeksToCheck.push(gw);
      }
    }

    console.log(`[API] Checking gameweeks: ${gameweeksToCheck.join(', ')} (current GW: ${currentGw})`);

    // Step 4: Get form data for each entry
    const formEntries: FormEntry[] = await processInBatches(
      standings.results,
      async (entry: LeagueEntry): Promise<FormEntry> => {
        try {
          const history: HistoryData = await safeJson(`https://fantasy.premierleague.com/api/entry/${entry.entry}/history/`);
          
          // Sum points for the gameweeks in our window
          let totalPoints = 0;
          for (const gw of gameweeksToCheck) {
            const gwData = history.current?.find(h => h.event === gw);
            if (gwData) {
              totalPoints += gwData.points;
            }
          }

          return {
            entryId: entry.entry,
            managerName: entry.player_name,
            teamName: entry.entry_name,
            points: totalPoints,
          };
        } catch (error) {
          console.error(`[API] Failed to get history for entry ${entry.entry}:`, error);
          // Return entry with 0 points if we can't get history
          return {
            entryId: entry.entry,
            managerName: entry.player_name,
            teamName: entry.entry_name,
            points: 0,
          };
        }
      },
      5 // Process 5 entries at a time to avoid overwhelming FPL API
    );

    // Step 5: Sort and get hot/cold entries
    const sortedByPoints = [...formEntries].sort((a, b) => b.points - a.points);
    
    const hot = sortedByPoints.slice(0, 3); // Top 3
    const cold = sortedByPoints.slice(-3).reverse(); // Bottom 3, reversed so worst is first

    const response: FormResponse = {
      window: actualWindow,
      currentGw,
      hot,
      cold,
    };

    console.log(`[API] Form calculation complete for league ${leagueId}`);
    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } });

  } catch (error) {
    console.error(`[API] Form calculation error for league ${leagueId}:`, error);
    return new Response(JSON.stringify({ error: 'Failed to calculate form', message: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
