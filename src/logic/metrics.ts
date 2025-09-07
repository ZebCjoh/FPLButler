export type HighlightItem = { id: number; text: string };

async function safeJson(url: string) {
  console.log(`[Metrics] Fetching: ${url}`);
  const res = await fetch(url, { cache: 'no-store' as RequestCache });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    console.error(`[Metrics] Fetch failed: ${url} -> HTTP ${res.status}`);
    throw new Error(`${url} -> HTTP ${res.status}`);
  }
  if (!ct.includes('application/json')) {
    console.error(`[Metrics] Non-JSON response: ${url} -> ${ct}`);
    throw new Error(`${url} -> Non-JSON response`);
  }
  return res.json();
}

export async function getHighlights(gameweek: number, leagueId: number): Promise<HighlightItem[]> {
  try {
    // 1) Bootstrap for elements (player id -> name)
    const bootstrap = await safeJson('/api/bootstrap-static');
    const elements = bootstrap.elements as any[];
    const elementIdToName: Record<number, string> = {};
    elements.forEach((el) => { elementIdToName[el.id] = el.web_name; });

    // 2) League entries
    const standings = await safeJson(`/api/league/${leagueId}`);
    const entries = (standings?.standings?.results || []) as any[];
    const entryIds: number[] = entries.map((e) => e.entry);

    // 3) Live GW data for points/goals/assists
    const live = await safeJson(`/api/event/${gameweek}/live`);
    const pointsByEl: Record<number, number> = {};
    const goalsByEl: Record<number, number> = {};
    const assistsByEl: Record<number, number> = {};
    (live.elements || []).forEach((e: any) => {
      pointsByEl[e.id] = e.stats?.total_points ?? 0;
      goalsByEl[e.id] = e.stats?.goals_scored ?? 0;
      assistsByEl[e.id] = e.stats?.assists ?? 0;
    });

    // 4) Picks -> chips + captains
    const picksByEntry: Record<number, any[]> = {};
    const chipByEntry: Record<number, string | null> = {};
    const captainCount: Record<number, number> = {};

    const chunk = <T,>(arr: T[], size: number) => arr.reduce<T[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
    for (const group of chunk(entryIds, 6)) {
      await Promise.all(group.map(async (entryId) => {
        try {
          const picks = await safeJson(`/api/entry/${entryId}/event/${gameweek}/picks`);
          picksByEntry[entryId] = picks?.picks || [];
          chipByEntry[entryId] = picks?.active_chip || null;
          const cap = (picks?.picks || []).find((p: any) => p.is_captain);
          if (cap) captainCount[cap.element] = (captainCount[cap.element] || 0) + 1;
        } catch (_) {
          picksByEntry[entryId] = [];
          chipByEntry[entryId] = null;
        }
      }));
    }

    // Helper: all elements chosen in league this GW
    const chosenElements = new Set<number>();
    Object.values(picksByEntry).forEach((picks) => picks.forEach((p: any) => chosenElements.add(p.element)));

    // (1) Rundens helt
    let heroId = -1; let heroPts = -1;
    chosenElements.forEach((id) => {
      const pts = pointsByEl[id] ?? 0;
      if (pts > heroPts) { heroId = id; heroPts = pts; }
    });
    const heroGoals = goalsByEl[heroId] ?? 0;
    const heroAssists = assistsByEl[heroId] ?? 0;
    const heroName = elementIdToName[heroId] || (heroId > 0 ? `#${heroId}` : '-');
    const heroLine = (heroGoals || heroAssists)
      ? `Rundens helt: ${heroName} med ${heroGoals} mål og ${heroAssists} assist`
      : `Rundens helt: ${heroName} med ${heroPts} poeng`;
    console.debug('[Highlights] Hero', { heroId, heroName, heroPts, heroGoals, heroAssists });

    // (2) Transfer highlight
    let totalTransfers = 0;
    let biggestGambler = { name: '', hits: 0, cost: 0 };
    
    // Fetch transfer data for all entries
    for (const entry of entries) {
      try {
        const picks = await safeJson(`/api/entry/${entry.entry}/event/${gameweek}/picks`);
        const transfers = picks?.entry_history?.event_transfers || 0;
        const transfersCost = picks?.entry_history?.event_transfers_cost || 0;
        
        totalTransfers += transfers;
        
        // Check if this is the biggest gambler (most hits taken)
        if (transfersCost > biggestGambler.cost) {
          biggestGambler = {
            name: entry.player_name || entry.entry_name || `Team ${entry.entry}`,
            hits: Math.floor(transfersCost / 4), // Each hit costs 4 points
            cost: transfersCost
          };
        }
      } catch (_) {
        // Skip entries that fail to load
      }
    }

    let transferLine = `Totalt ble det gjort ${totalTransfers} bytter i ligaen denne runden.`;
    if (biggestGambler.cost > 0) {
      transferLine += ` Største gambler: ${biggestGambler.name} med -${biggestGambler.cost} poeng i hits.`;
    }
    
    console.debug('[Highlights] Transfers', { totalTransfers, biggestGambler });

    // (3) Kapteinsvalg
    let topCapId = -1; let topCapCount = 0;
    Object.entries(captainCount).forEach(([idStr, count]) => {
      const id = Number(idStr);
      if ((count as number) > topCapCount) { topCapId = id; topCapCount = count as number; }
    });
    const capName = elementIdToName[topCapId] || (topCapId > 0 ? `#${topCapId}` : '-');
    const capPct = entries.length ? Math.round((topCapCount / entries.length) * 100) : 0;
    const captainLine = `Kapteinsvalg: ${capPct}% ga båndet til ${capName}.`;
    console.debug('[Highlights] Captain', { topCapId, capName, topCapCount, totalManagers: entries.length, capPct });

    return [
      { id: 1, text: heroLine },
      { id: 2, text: transferLine },
      { id: 3, text: captainLine },
    ];
  } catch (err) {
    console.debug('[Highlights] fallback due to error', err);
    return [];
  }
}


