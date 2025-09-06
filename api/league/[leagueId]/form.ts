import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  total?: number;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId, window: windowParam } = req.query;
  const window = windowParam ? parseInt(String(windowParam)) : 3;

  if (!leagueId || typeof leagueId !== 'string') {
    return res.status(400).json({ error: 'Invalid league ID' });
  }

  if (isNaN(window) || window < 1 || window > 10) {
    return res.status(400).json({ error: 'Window must be between 1 and 10' });
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
    const standingsResponse = await safeJson(`https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`);
    
    console.log(`[API] Standings response structure:`, Object.keys(standingsResponse));
    
    // Handle both direct results and nested standings structure
    const standings = standingsResponse.standings || standingsResponse;
    const results = standings.results || [];
    
    if (!results || results.length === 0) {
      console.log(`[API] No results found. Response keys:`, Object.keys(standingsResponse));
      return res.status(404).json({ error: 'No entries found in league' });
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
      results,
      async (entry: LeagueEntry): Promise<FormEntry> => {
        try {
          // If window covers all gameweeks so far, use league total (more accurate)
          if (actualWindow >= currentGw) {
            console.log(`[API] Using league total for entry ${entry.entry} (window=${actualWindow}, currentGw=${currentGw})`);
            return {
              entryId: entry.entry,
              managerName: entry.player_name,
              teamName: entry.entry_name,
              points: entry.total || 0,
            };
          }

          // Otherwise, sum specific gameweeks from history
          const history: HistoryData = await safeJson(`https://fantasy.premierleague.com/api/entry/${entry.entry}/history/`);
          
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
          // Return entry with league total as fallback
          return {
            entryId: entry.entry,
            managerName: entry.player_name,
            teamName: entry.entry_name,
            points: entry.total || 0,
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
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(response);

  } catch (error) {
    console.error(`[API] Form calculation error for league ${leagueId}:`, error);
    return res.status(500).json({ error: 'Failed to calculate form', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}
