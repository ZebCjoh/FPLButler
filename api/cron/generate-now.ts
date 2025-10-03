import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Snapshot } from '../../types/snapshot';
// ESM in Vercel serverless requires explicit .js extension at runtime
import { calculateDifferentialHero } from '../_lib/differentialHero.js';

interface FPLElement {
  id: number;
  web_name: string;
}

interface FPLEvent {
  id: number;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  deadline_time: string;
}

interface LeagueEntry {
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank?: number;
  total: number;
  event_total?: number;
}

// Resolve our public base URL for internal API calls (proxy to avoid FPL 403)
function getBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.fplbutler.app');
}

// Simple retry helper for transient errors
async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (!res.ok && (res.status >= 500 || res.status === 429) && retries > 0) {
      await new Promise(r => setTimeout(r, 800));
      return fetchWithRetry(url, options, retries - 1);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 800));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

async function fetchFPL<T>(url: string): Promise<T> {
  const fplPrefix = 'https://fantasy.premierleague.com/api/';

  // 1) Try via our own proxy endpoints first (avoids FPL 403)
  if (url.startsWith(fplPrefix)) {
    const path = url.substring(fplPrefix.length); // e.g. 'bootstrap-static/'
    const proxyUrl = `${getBaseUrl()}/api/${path}`;
    const proxyResp = await fetchWithRetry(proxyUrl, {
      headers: { 'Accept': 'application/json' }
    });
    if (proxyResp.ok) {
      return proxyResp.json() as Promise<T>;
    }
    console.warn(`[snapshot] Proxy fetch failed ${proxyResp.status} for ${proxyUrl}, falling back to direct`);
  }

  // 2) Fallback to direct FPL request with robust headers
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://fantasy.premierleague.com/',
    'Accept-Language': 'en-US,en;q=0.9'
  } as Record<string, string>;
  const resp = await fetchWithRetry(url, { headers });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    console.error(`[snapshot] FPL ${resp.status} for ${url}:`, txt?.slice(0, 200));
    throw new Error(`FPL request failed ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

async function safeJson(url: string): Promise<any> {
  const fplPrefix = 'https://fantasy.premierleague.com/api/';
  if (url.startsWith(fplPrefix)) {
    const path = url.substring(fplPrefix.length);
    const proxyUrl = `${getBaseUrl()}/api/${path}`;
    const pr = await fetchWithRetry(proxyUrl, { headers: { 'Accept': 'application/json' } });
    const pct = pr.headers.get('content-type') || '';
    if (pr.ok && pct.includes('application/json')) {
      return pr.json();
    }
    console.warn(`[snapshot] Proxy safeJson failed ${pr.status} for ${proxyUrl}, falling back to direct`);
  }

  const r = await fetchWithRetry(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://fantasy.premierleague.com/',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const ct = r.headers.get('content-type') || '';
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!ct.includes('application/json')) throw new Error('Non-JSON response');
  return r.json();
}

type StructureName = 'classic' | 'story' | 'list' | 'comparison' | 'thematic';

async function generateButlerAssessment(
  snapshot: Snapshot,
  usedTemplateHashes: Set<string>,
  forcedStructure?: StructureName,
  deterministicIndex?: number
): Promise<{ summary: string; templateId: string }> {
  const { weekly } = snapshot;
  
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  };
  
  // Generate ALL possible template combinations
  const allCombinations: Array<{ structureIdx: number; indices: number[]; generator: () => string }> = [];
  
  const structures = [
    { key: 'classic' as StructureName, fn: generateClassicStructure, parts: [5, 3, 3, 2, 3] }, // 5×3×3×2×3 = 270
    { key: 'story' as StructureName, fn: generateStoryStructure, parts: [3, 2, 2] }, // 3×2×2 = 12
    { key: 'list' as StructureName, fn: generateListStructure, parts: [2] }, // 2×1×1×1 = 2 (intro only)
    { key: 'comparison' as StructureName, fn: generateComparisonStructure, parts: [2, 2] }, // 2×2 = 4
    { key: 'thematic' as StructureName, fn: generateThematicStructure, parts: [4, 2, 3] } // 4×2×3 = 24
  ];
  
  // Generate all combinations for each structure
  const structuresToUse = forcedStructure ? structures.filter(s => s.key === forcedStructure) : structures;

  structuresToUse.forEach((structure, structureIdx) => {
    const generateIndices = (parts: number[], current: number[] = []): number[][] => {
      if (current.length === parts.length) {
        return [current];
      }
      const results: number[][] = [];
      for (let i = 0; i < parts[current.length]; i++) {
        results.push(...generateIndices(parts, [...current, i]));
      }
      return results;
    };
    
    const allIndices = generateIndices(structure.parts);
    allIndices.forEach(indices => {
      allCombinations.push({
        structureIdx,
        indices,
        generator: () => {
          // Create deterministic seed from indices
          const deterministicSeed = `${structureIdx}-${indices.join('-')}`;
          const pick = <T,>(arr: T[], idx: number) => arr[idx % arr.length];
          return structure.fn(snapshot, pick, deterministicSeed, indices);
        }
      });
    });
  });
  
  console.log(`[butler] Total possible combinations: ${allCombinations.length}`);
  console.log(`[butler] Already used: ${usedTemplateHashes.size}`);
  
  // Filter out already used combinations
  const unusedCombinations = allCombinations.filter(combo => {
    const comboHash = `${combo.structureIdx}-${combo.indices.join('-')}`;
    return !usedTemplateHashes.has(comboHash);
  });
  
  console.log(`[butler] Unused combinations available: ${unusedCombinations.length}`);
  
  // If all have been used, reset (clear the used set)
  let selectedCombo;
  if (unusedCombinations.length === 0) {
    console.log('[butler] All combinations used! Resetting pool.');
    // Pick from all combinations (fresh start)
    const randomIdx = Math.floor(Math.random() * allCombinations.length);
    selectedCombo = allCombinations[randomIdx];
  } else {
    // Deterministic selection based on GW to prevent repeats without storage
    if (typeof deterministicIndex === 'number') {
      const idx = ((deterministicIndex % unusedCombinations.length) + unusedCombinations.length) % unusedCombinations.length;
      selectedCombo = unusedCombinations[idx];
    } else {
      // Pick randomly from unused
      const randomIdx = Math.floor(Math.random() * unusedCombinations.length);
      selectedCombo = unusedCombinations[randomIdx];
    }
  }
  
  // Store the exact combination used for future tracking
  const comboHash = `${selectedCombo.structureIdx}-${selectedCombo.indices.join('-')}`;
  
  console.log(`[butler] Selected template: ${comboHash}`);
  
  return {
    summary: selectedCombo.generator(),
    templateId: comboHash
  };
}

function generateClassicStructure(snapshot: Snapshot, pick: any, seed: string, indices?: number[]): string {
  const { weekly } = snapshot;
  
  const openings = [
    'Butleren har observert denne ukens amatøriske fremvisning:',
    'Som forventet leverte managerne en blandet forestilling:',
    'Butleren noterer seg følgende fra denne ukens prestasjoner:',
    'Etter å ha studert tallene med profesjonell forakt:',
    'Som alltid må butleren korrigere managernes oppfatning av suksess:'
  ];
  
  const top = [
    `${weekly.winner.manager} tok ${weekly.winner.points} poeng${weekly.movements.riser.manager === weekly.winner.manager ? ` og klatret ${weekly.movements.riser.delta} plasser` : ''} – imponerende, men fortsatt under butlerens standard.`,
    `${weekly.winner.manager} leverte ${weekly.winner.points} poeng denne runden – et sjeldent øyeblikk av kompetanse som butleren anerkjenner.`,
    `${weekly.winner.manager} scoret ${weekly.winner.points} poeng – en prestasjon som nesten kvalifiserer som tilfredsstillende.`
  ];
  
  const weak = [
    `${weekly.loser.manager} leverte ${weekly.loser.points} poeng – så svakt at selv benken hans vurderte å melde overgang.`,
    `${weekly.loser.manager} scoret ${weekly.loser.points} poeng, en prestasjon som får butleren til å vurdere karriereskifte som manager.`,
    `${weekly.benchWarmer.benchPoints > 10 ? `${weekly.benchWarmer.manager} hadde ${weekly.benchWarmer.benchPoints} poeng på benken` : `${weekly.loser.manager} leverte ${weekly.loser.points} poeng`} – butleren er ikke overrasket.`
  ];
  
  const special = weekly.chipsUsed.count > 0 ? [
    `${weekly.chipsUsed.list[0].manager} aktiverte en chip – butleren håper det var verdt investeringen.`,
    `En chip ble brukt av ${weekly.chipsUsed.list[0].manager} – desperat, men forståelig.`
  ] : [
    'Ingen våget seg på chips denne uken – en beslutning butleren respekterer.',
    'Ukens chip-bruk var ikke-eksisterende – kanskje visdom, kanskje feighet.'
  ];
  
  const punch = [
    'Denne runden beviste at man kan klatre, falle og fortsatt ikke imponere. Butleren forventer mer neste uke.',
    'Som alltid er butleren imponert over managernes evne til å skuffe forventningene.',
    'Butleren konkluderer med at fotball tydeligvis er vanskeligere enn det ser ut på TV.'
  ];
  
  // Use provided indices for deterministic selection, or fallback to pick function
  if (indices && indices.length === 5) {
    return `${openings[indices[0]]} ${top[indices[1]]} ${weak[indices[2]]} ${special[indices[3]]} ${punch[indices[4]]}`;
  }
  
  return `${pick(openings, seed + '|o')} ${pick(top, seed + '|t')} ${pick(weak, seed + '|w')} ${pick(special, seed + '|s')} ${pick(punch, seed + '|p')}`;
}

function generateStoryStructure(snapshot: Snapshot, pick: any, seed: string, indices?: number[]): string {
  const { weekly } = snapshot;
  const themes = ['Ukens saga handler om triumf og nederlag', 'Historien som utspant seg denne uken', 'I denne episoden av managerial drama'];
  const stories = [
    `så vi ${weekly.winner.manager} stige til toppen med ${weekly.winner.points} poeng, mens ${weekly.loser.manager} sank til bunns med ${weekly.loser.points}. En klassisk fortelling om kontraster som butleren har sett utallige ganger.`,
    `opplevde vi ${weekly.winner.manager} briljere med ${weekly.winner.points} poeng og ${weekly.loser.manager} demonstrere hvordan man oppnår ${weekly.loser.points} poeng med stil. Butleren noterer kunstnivået.`
  ];
  const conclusions = ['Butleren avventer neste kapittel med sedvanlig optimisme.', 'Historia fortsetter, butleren observerer.'];
  
  if (indices && indices.length === 3) {
    return `${themes[indices[0]]} ${stories[indices[1]]} ${conclusions[indices[2]]}`;
  }
  
  return `${pick(themes, seed + '|theme')} ${pick(stories, seed + '|story')} ${pick(conclusions, seed + '|conclusion')}`;
}

function generateListStructure(snapshot: Snapshot, pick: any, seed: string, indices?: number[]): string {
  const { weekly } = snapshot;
  const intros = ['Butlerens tre hovedobservasjoner fra denne uken:', 'Ukens viktigste lærdommer, ifølge butleren:'];
  const point1 = `Førstens: ${weekly.winner.manager} leverte ${weekly.winner.points} poeng og viste sporadisk kompetanse.`;
  const point2 = `For det andre: ${weekly.loser.manager} oppnådde ${weekly.loser.points} poeng gjennom kreativ underprestasjoner.`;
  const benchPoints = weekly.benchWarmer.benchPoints || 0;
  const benchLine = benchPoints > 0
    ? `Til slutt: ${weekly.benchWarmer.manager} hadde ${benchPoints} poeng på benken – ikke helt optimalt.`
    : `Til slutt: ${weekly.benchWarmer.manager} hadde ${benchPoints} poeng på benken – effektiv utnyttelse av stallen.`;
  
  // Only intro varies (2 options), points are fixed
  if (indices && indices.length === 1) {
    return `${intros[indices[0]]} ${point1} ${point2} ${benchLine}`;
  }
  
  return `${pick(intros, seed + '|intro')} ${point1} ${point2} ${benchLine}`;
}

function generateComparisonStructure(snapshot: Snapshot, pick: any, seed: string, indices?: number[]): string {
  const { weekly } = snapshot;
  const comparisons = [
    `Mens ${weekly.winner.manager} scoret ${weekly.winner.points} poeng med tilsynelatende letthet, klarte ${weekly.loser.manager} bare ${weekly.loser.points} – en kontrast som illustrerer forskjellen mellom planlegging og improvisasjon.`,
    `Forskjellen mellom ${weekly.winner.manager}s ${weekly.winner.points} poeng og ${weekly.loser.manager}s ${weekly.loser.points} poeng forteller historien om denne runden bedre enn butleren noengang kunne.`
  ];
  const morale = ['Butleren observerer uten overraskelse.', 'Som forventet av butleren.'];
  
  if (indices && indices.length === 2) {
    return `${comparisons[indices[0]]} ${morale[indices[1]]}`;
  }
  
  return `${pick(comparisons, seed + '|comparison')} ${pick(morale, seed + '|morale')}`;
}

function generateThematicStructure(snapshot: Snapshot, pick: any, seed: string, indices?: number[]): string {
  const { weekly } = snapshot;
  const themes = ['Kaos', 'Ironi', 'Ydmykhet', 'Realisme'];
  
  const themeIntros = [
    ['I ukens kaotiske utveksling av poeng', 'Mens kaoset hersket på managerfronten'],
    ['Med ironisk timing', 'I en ironisk vending'],
    ['Denne uken lærte managerne ydmykhet', 'Ydmykheten var ukens hovedtema'],
    ['Realiteten slo inn denne uken', 'Som en kald dose realisme']
  ];
  
  const analyses = [
    [`presterte ${weekly.winner.manager} med ${weekly.winner.points} poeng mens ${weekly.loser.manager} endte på ${weekly.loser.points}. Kaoset var komplett.`],
    [`scoret ${weekly.winner.manager} ${weekly.winner.points} poeng akkurat når ${weekly.loser.manager} leverte ${weekly.loser.points}. Ironien var ikke tapt på butleren.`],
    [`viste ${weekly.winner.manager} med ${weekly.winner.points} poeng at selv suksess er relativ, mens ${weekly.loser.manager}s ${weekly.loser.points} poeng demonstrerte lærdommen fullstendig.`],
    [`leverte ${weekly.winner.manager} ${weekly.winner.points} poeng og ${weekly.loser.manager} ${weekly.loser.points} poeng. Realiteten var brutal og lærerik.`]
  ];
  
  const conclusions = ['Butleren noterer seg tendensen.', 'Som alltid observerer butleren med interesse.', 'Butleren forventer kontinuitet.'];
  
  // indices[0] = theme (0-3), indices[1] = intro variant (0-1), indices[2] = conclusion (0-2)
  // For simplicity: map first index to theme, second to intro, third to conclusion (analyses is always [0] per theme)
  if (indices && indices.length === 3) {
    const themeIdx = indices[0]; // 0-3 for theme
    const introIdx = indices[1] % 2; // 0-1 for intro variant
    const conclusionIdx = indices[2]; // 0-2 for conclusion
    return `${themeIntros[themeIdx][introIdx]} ${analyses[themeIdx][0]} ${conclusions[conclusionIdx]}`;
  }
  
  const selectedTheme = pick(themes, seed + '|theme');
  const themeIdx = themes.indexOf(selectedTheme);
  const themeIntrosLegacy = {
    'Kaos': themeIntros[0],
    'Ironi': themeIntros[1],
    'Ydmykhet': themeIntros[2],
    'Realisme': themeIntros[3]
  };
  const analysesLegacy = {
    'Kaos': analyses[0],
    'Ironi': analyses[1],
    'Ydmykhet': analyses[2],
    'Realisme': analyses[3]
  };
  
  return `${pick(themeIntrosLegacy[selectedTheme as keyof typeof themeIntrosLegacy] || themeIntros[0], seed + '|intro')} ${pick(analysesLegacy[selectedTheme as keyof typeof analysesLegacy] || analyses[0], seed + '|analysis')} ${pick(conclusions, seed + '|conclusion')}`;
}

async function composeSnapshot(leagueId: string, gameweek: number): Promise<Snapshot> {
  console.log(`[snapshot] Composing snapshot for league ${leagueId}, GW ${gameweek}`);
  
  try {
    // 1. Bootstrap data for players and next deadline
    const bootstrapData: any = await fetchFPL(`https://fantasy.premierleague.com/api/bootstrap-static/`);
    const elements = bootstrapData.elements as FPLElement[];
    const events = bootstrapData.events as FPLEvent[];
    
    const elementIdToName: Record<number, string> = {};
    elements.forEach((el) => {
      elementIdToName[el.id] = el.web_name;
    });
    
    // 2. League standings
    const leagueData: any = await fetchFPL(`https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`);
    const standings = leagueData.standings.results as LeagueEntry[];
    
    if (!standings || standings.length === 0) {
      throw new Error('No standings data found');
    }
    
    // 3. Live gameweek data for player points (and goals/assists for highlights)
    const liveData: any = await fetchFPL(`https://fantasy.premierleague.com/api/event/${gameweek}/live/`);
    const pointsByElement: Record<number, number> = {};
    const goalsByElement: Record<number, number> = {};
    const assistsByElement: Record<number, number> = {};
    (liveData.elements || []).forEach((e: any) => {
      pointsByElement[e.id] = e.stats.total_points;
      goalsByElement[e.id] = e.stats?.goals_scored ?? 0;
      assistsByElement[e.id] = e.stats?.assists ?? 0;
    });
    
    // 4. Basic standings data
    const top3 = standings.slice(0, 3).map((entry, idx) => ({
      rank: (idx + 1) as 1 | 2 | 3,
      team: entry.entry_name,
      manager: entry.player_name,
      points: entry.total
    }));
    
    const bottomTail = standings.slice(-3);
    const bottom3 = bottomTail.map((entry, index) => ({
      rank: (standings.length - 2 + index),
      team: entry.entry_name,
      manager: entry.player_name,
      points: entry.total
    }));
    
    // 5. Weekly winner/loser (using event_total from standings)
    const weekWinner = [...standings]
      .map((row: any) => ({
        team: row.entry_name,
        manager: row.player_name,
        points: row.event_total || 0,
      }))
      .sort((a, b) => b.points - a.points)[0];
      
    const weekLoser = [...standings]
      .map((row: any) => ({
        team: row.entry_name,
        manager: row.player_name,
        points: row.event_total || 0,
      }))
      .sort((a, b) => a.points - b.points)[0];
    
    // 6. Movements using rank vs last_rank
    const movements = standings.map(entry => ({
      manager: entry.player_name,
      team: entry.entry_name,
      change: (entry.last_rank || entry.rank) - entry.rank
    }));
    
    const riser = movements.reduce((best, current) => 
      (current.change > best.change) ? current : best
    );
    const faller = movements.reduce((worst, current) => 
      (current.change < worst.change) ? current : worst
    );
    
    // 7. Per-entry data: picks, history, transfers (match homepage behavior)
    const entryIds = standings.map((row: any) => row.entry);
    const picksByEntry: Record<number, any> = {};
    const historyByEntry: Record<number, any> = {};
    const transfersByEntry: Record<number, any[]> = {};

    const chunk = <T,>(arr: T[], size: number) => arr.reduce<T[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);

    for (const group of chunk(entryIds, 6)) {
      await Promise.all(
        group.map(async (entryId) => {
          try {
            const [picks, history, transfers] = await Promise.all([
              safeJson(`https://fantasy.premierleague.com/api/entry/${entryId}/event/${gameweek}/picks/`).catch(() => null),
              safeJson(`https://fantasy.premierleague.com/api/entry/${entryId}/history/`).catch(() => null),
              safeJson(`https://fantasy.premierleague.com/api/entry/${entryId}/transfers/`).catch(() => []),
            ]);
            if (picks) picksByEntry[entryId] = picks;
            if (history) historyByEntry[entryId] = history;
            transfersByEntry[entryId] = Array.isArray(transfers) ? transfers : [];
          } catch (_) { /* ignore */ }
        })
      );
    }

    // 8. Form analysis (exact fallback used on homepage)
    const formWindow = Math.min(3, gameweek);
    const gwSet = new Set<number>();
    for (let i = 0; i < formWindow; i++) {
      const gw = gameweek - i;
      if (gw >= 1) gwSet.add(gw);
    }
    const formComputed = standings.map((row: any) => {
      const entryId = row.entry;
      const hist = historyByEntry[entryId]?.current || [];
      const points = hist
        .filter((h: any) => gwSet.has(h.event))
        .reduce((sum: number, h: any) => sum + (h.points || 0), 0);
      return { manager: row.player_name, team: row.entry_name, points };
    });
    const formSorted = [...formComputed].sort((a, b) => b.points - a.points);

    // 9. Bench analysis (all entries)
    const benchByEntry: Record<number, number> = {};
    standings.forEach((row: any) => {
      const entryId = row.entry;
      const picks = picksByEntry[entryId]?.picks || [];
      const bench = picks
        .filter((p: any) => p.multiplier === 0)
        .reduce((sum: number, p: any) => sum + (pointsByElement[p.element] || 0), 0);
      benchByEntry[entryId] = bench;
    });
    const benchList = Object.entries(benchByEntry)
      .map(([entryId, bench]) => {
        const row = standings.find((r: any) => r.entry === Number(entryId));
        return {
          entryId: Number(entryId),
          team: row?.entry_name || '-',
          manager: row?.player_name || '-',
          benchPoints: bench as number
        };
      })
      .sort((a: any, b: any) => {
        const diff = (b.benchPoints as number) - (a.benchPoints as number);
        if (diff !== 0) return diff;
        return (a.entryId as number) - (b.entryId as number);
      });
    const benchWarmer = benchList[0] || { manager: '-', team: '-', benchPoints: 0 };

    // 10. Chips used (from picks)
    const chipEmoji: Record<string, string> = {
      triple_captain: '⚡',
      wildcard: '🃏',
      freehit: '🎯',
      bench_boost: '🏟️',
    };
    const chipsUsed: Array<{ manager: string; team: string; chip: string; emoji: string }> = [];
    standings.forEach((row: any) => {
      const entryId = row.entry;
      const chip = picksByEntry[entryId]?.active_chip;
      if (chip) {
        chipsUsed.push({ manager: row.player_name, team: row.entry_name, chip, emoji: chipEmoji[chip] || '🎯' });
      }
    });

    // 11. Transfer ROI (match homepage: sum of points for transfers in; no hit cost)
    const roiRows: Array<{ manager: string; team: string; totalROI: number; transfersIn: Array<{ name: string; points: number }> }> = 
      standings.map((row: any) => {
        const entryId = row.entry;
        const transfers = (transfersByEntry[entryId] || []).filter((t: any) => t.event === gameweek);
        const transfersInPoints = transfers.map((t: any) => {
          const pts = pointsByElement[t.element_in] || 0;
          const name = elementIdToName[t.element_in] || `#${t.element_in}`;
          return { name, points: pts };
        });
        const totalROI = transfersInPoints.reduce((s, x) => s + x.points, 0);
        return {
          team: row.entry_name,
          manager: row.player_name,
          transfersIn: transfersInPoints,
          totalROI,
        };
      }).sort((a, b) => b.totalROI - a.totalROI);

    // 12. Differential hero (deterministic calculation)
    const ownershipCount: Record<number, number> = {};
    standings.forEach((row: any) => {
      const entryId = row.entry;
      const picks = picksByEntry[entryId]?.picks || [];
      picks.forEach((p: any) => {
        ownershipCount[p.element] = (ownershipCount[p.element] || 0) + 1;
      });
    });
    
    const differential = calculateDifferentialHero(
      ownershipCount,
      pointsByElement,
      elementIdToName,
      standings,
      picksByEntry
    );
    
    // 11. Next deadline
    const nextEvent = events.find(e => e.id === gameweek + 1);
    const nextDeadline = nextEvent ? {
      gw: nextEvent.id,
      date: new Date(nextEvent.deadline_time).toLocaleDateString('no-NO'),
      time: new Date(nextEvent.deadline_time).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
    } : {
      gw: gameweek + 1,
      date: 'TBA',
      time: 'TBA'
    };

    const snapshot: Snapshot = {
      meta: {
        leagueId,
        leagueName: leagueData.league?.name || 'Unknown League',
        gameweek,
        createdAt: new Date().toISOString()
      },
      butler: {
        summary: '', // Will be generated below
        templateId: 'pending' // Will be set by generateButlerAssessment
      },
      top3,
      bottom3,
      weekly: {
        winner: weekWinner,
        loser: weekLoser,
        benchWarmer,
        chipsUsed: { count: chipsUsed.length, list: chipsUsed },
        movements: {
          riser: {
            manager: riser.manager,
            team: riser.team,
            delta: Math.max(0, riser.change)
          },
          faller: {
            manager: faller.manager,
            team: faller.team,
            delta: Math.min(0, faller.change)
          }
        },
        nextDeadline
      },
      form3: {
        window: formWindow,
        hot: formSorted.slice(0, 3).map(entry => ({
          manager: entry.manager,
          team: entry.team,
          points: entry.points
        })),
        cold: formSorted.slice(-3).reverse().map(entry => ({
          manager: entry.manager,
          team: entry.team,
          points: entry.points
        }))
      },
      transferRoi: {
        genius: {
          manager: roiRows[0]?.manager || '-',
          team: roiRows[0]?.team || '-',
          player: roiRows[0]?.transfersIn[0]?.name,
          roi: roiRows[0]?.totalROI || 0
        },
        bomb: {
          manager: roiRows[roiRows.length - 1]?.manager || '-',
          team: roiRows[roiRows.length - 1]?.team || '-',
          player: roiRows[roiRows.length - 1]?.transfersIn[0]?.name,
          roi: roiRows[roiRows.length - 1]?.totalROI || 0
        }
      },
      highlights: (() => {
        // Build highlights identically to homepage metrics
        // (1) Rundens helt: within chosen league picks
        const chosenElements = new Set<number>();
        standings.forEach((row: any) => {
          const entryId = row.entry;
          const picks = picksByEntry[entryId]?.picks || [];
          picks.forEach((p: any) => chosenElements.add(p.element));
        });
        let heroId = -1; let heroPts = -1;
        chosenElements.forEach((id) => {
          const pts = pointsByElement[id] ?? 0;
          if (pts > heroPts) { heroId = id; heroPts = pts; }
        });
        const heroGoals = heroId > 0 ? (goalsByElement[heroId] ?? 0) : 0;
        const heroAssists = heroId > 0 ? (assistsByElement[heroId] ?? 0) : 0;
        const heroName = heroId > 0 ? (elementIdToName[heroId] || `#${heroId}`) : '-';
        const heroLine = (heroGoals || heroAssists)
          ? `Rundens helt: ${heroName} med ${heroGoals} mål og ${heroAssists} assist`
          : `Rundens helt: ${heroName} med ${heroPts} poeng`;

        // (2) Transfer highlight (using picks.entry_history to avoid extra calls)
        let totalTransfers = 0;
        let biggestGambler = { name: '', cost: 0 } as { name: string; cost: number };
        standings.forEach((row: any) => {
          const entryId = row.entry;
          const picks = picksByEntry[entryId];
          const transfers = Number(picks?.entry_history?.event_transfers || 0);
          const transfersCost = Number(picks?.entry_history?.event_transfers_cost || 0);
          totalTransfers += transfers;
          if (transfersCost > biggestGambler.cost) {
            biggestGambler = { name: row.player_name || row.entry_name, cost: transfersCost };
          }
        });
        let transferLine = `Totalt ble det gjort ${totalTransfers} bytter i ligaen denne runden.`;
        if (biggestGambler.cost > 0) {
          transferLine += ` Største gambler: ${biggestGambler.name} med -${biggestGambler.cost} poeng i hits.`;
        }

        // (3) Kapteinsvalg
        const captainCount: Record<number, number> = {};
        standings.forEach((row: any) => {
          const entryId = row.entry;
          const picks = picksByEntry[entryId]?.picks || [];
          const cap = picks.find((p: any) => p.is_captain);
          if (cap) captainCount[cap.element] = (captainCount[cap.element] || 0) + 1;
        });
        let topCapId = -1; let topCapCount = 0;
        Object.entries(captainCount).forEach(([idStr, count]) => {
          const id = Number(idStr);
          if ((count as number) > topCapCount) { topCapId = id; topCapCount = count as number; }
        });
        const capName = topCapId > 0 ? (elementIdToName[topCapId] || `#${topCapId}`) : '-';
        const capPct = standings.length ? Math.round((topCapCount / standings.length) * 100) : 0;
        const captainLine = `Kapteinsvalg: ${capPct}% ga båndet til ${capName}.`;

        return [
          { id: 1, text: heroLine },
          { id: 2, text: transferLine },
          { id: 3, text: captainLine },
        ];
      })(),
      differentialHero: {
        player: differential.player,
        points: differential.points,
        ownership: differential.ownership,
        ownedBy: differential.ownedBy,
        managers: differential.managers
      }
    };
    
    // Fetch global used-templates list to ensure no repeats until exhaustion
    const usedTemplateHashes = new Set<string>();
    try {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) {
        const { list } = await import('@vercel/blob');
        const { blobs } = await list({ token, prefix: 'used-templates.json' as any });
        const stateBlob = (blobs || []).find((b: any) => b.pathname === 'used-templates.json');
        if (stateBlob) {
          const text = await (await fetch(stateBlob.url, { cache: 'no-store' as RequestCache })).text();
          try {
            const data = JSON.parse(text || '{}');
            (data.used || []).forEach((id: string) => usedTemplateHashes.add(id));
          } catch (e) {
            console.warn('[snapshot] Failed to parse used-templates.json, starting fresh');
          }
        } else {
          console.log('[snapshot] No used-templates.json found, starting fresh');
        }
      }
    } catch (e) {
      console.warn('[snapshot] Could not load used-templates.json:', e);
    }
    
    // Generate butler assessment with exhaustive template tracking
    // Deterministic selection index: rotate by GW number to ensure new template per GW
    const deterministicIdx = (gameweek * 37) % 100000; // large stride to spread selection
    const forced: StructureName | undefined = undefined; // no per-GW forcing
    const butlerResult = await generateButlerAssessment(snapshot, usedTemplateHashes, forced, deterministicIdx);
    snapshot.butler.summary = butlerResult.summary;
    snapshot.butler.templateId = butlerResult.templateId;
    
    console.log(`[snapshot] Successfully composed snapshot for GW ${gameweek} with ${standings.length} teams`);
    console.log(`[snapshot] Butler object after assignment:`, JSON.stringify(snapshot.butler));
    console.log(`[snapshot] Full snapshot keys:`, Object.keys(snapshot.butler));

    // Persist updated used-templates list (best-effort)
    try {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token && snapshot.butler.templateId) {
        usedTemplateHashes.add(snapshot.butler.templateId);
        const { put } = await import('@vercel/blob');
        await put('used-templates.json', JSON.stringify({ used: Array.from(usedTemplateHashes) }, null, 2), {
          access: 'public',
          contentType: 'application/json',
          token,
          addRandomSuffix: false
        });
        console.log(`[snapshot] Updated used-templates.json with ${usedTemplateHashes.size} entries`);
      }
    } catch (e) {
      console.warn('[snapshot] Failed to persist used-templates.json:', e);
    }
    return snapshot;
    
  } catch (error) {
    console.error('[snapshot] Error composing snapshot:', error);
    throw error;
  }
}

async function resolveTargetGw(): Promise<number> {
  const resp = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
      'Accept': 'application/json',
      'Referer': 'https://fantasy.premierleague.com/'
    }
  });
  if (!resp.ok) throw new Error(`bootstrap-static failed: ${resp.status}`);
  const data = await resp.json();
  const events: any[] = data.events || [];
  const current = events.find((e) => e.is_current)?.id;
  if (current) return current;
  const next = events.find((e) => e.is_next)?.id;
  if (next) return next;
  const lastFinished = [...events].filter((e) => e.is_finished).sort((a, b) => b.id - a.id)[0]?.id;
  if (lastFinished) return lastFinished;
  return 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const gwParam = (req.query?.gw as string) || '';
    const testParam = req.query?.test;
    const gw = Number.isFinite(Number(gwParam)) && Number(gwParam) > 0
      ? Number(gwParam)
      : await resolveTargetGw();

    const leagueId = '155099';
    
    console.log(`[generate-now] Generating complete snapshot for league ${leagueId}, GW ${gw}`);
    
    // Generate complete snapshot using full data aggregation
    const snapshot = await composeSnapshot(leagueId, gw);
    
    console.log(`[generate-now] Generated snapshot with ${snapshot.top3.length} top teams, ${snapshot.highlights.length} highlights, bench winner: ${snapshot.weekly.benchWarmer.manager} (${snapshot.weekly.benchWarmer.benchPoints}p)`);

    // If test mode, return snapshot directly
    if (testParam) {
      return res.status(200).json({ 
        ok: true, 
        gameweek: gw, 
        snapshot,
        preview: {
          butler: snapshot.butler.summary.substring(0, 100) + '...',
          winner: `${snapshot.weekly.winner.manager} (${snapshot.weekly.winner.points}p)`,
          benchWarmer: `${snapshot.weekly.benchWarmer.manager} (${snapshot.weekly.benchWarmer.benchPoints}p)`,
          highlights: snapshot.highlights.length,
          transferROI: `${snapshot.transferRoi.genius.manager} (+${snapshot.transferRoi.genius.roi})`
        }
      });
    }

    // Send snapshot to ai-summary API for persistence
    // Prefer explicit public base URL if provided; otherwise fall back to Vercel-provided URL or custom domain
    const baseUrl = process.env.PUBLIC_BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.fplbutler.app');
    const requestBody = { snapshot };
    console.log(`[generate-now] Sending snapshot to ai-summary, size: ${JSON.stringify(requestBody).length} bytes`);
    console.log(`[generate-now] snapshot.butler before send:`, JSON.stringify(snapshot.butler));
    
    try {
      const aiResponse = await fetch(`${baseUrl}/api/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        console.log(`[generate-now] Successfully saved complete snapshot for GW ${gw}`);
        return res.status(200).json({ 
          ok: true, 
          gameweek: gw, 
          snapshotSize: JSON.stringify(snapshot).length,
          aiResult,
          preview: {
            butler: snapshot.butler.summary.substring(0, 100) + '...',
            winner: `${snapshot.weekly.winner.manager} (${snapshot.weekly.winner.points}p)`,
            benchWarmer: `${snapshot.weekly.benchWarmer.manager} (${snapshot.weekly.benchWarmer.benchPoints}p)`,
            highlights: snapshot.highlights.length,
            transferROI: `${snapshot.transferRoi.genius.manager} (+${snapshot.transferRoi.genius.roi})`
          }
        });
      }

      const text = await aiResponse.text().catch(() => '');
      console.warn(`[generate-now] Failed to save snapshot: ${aiResponse.status} ${text}`);
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to save snapshot',
        status: aiResponse.status,
        body: text,
        gameweek: gw
      });
    } catch (err: any) {
      console.error('[generate-now] Error calling ai-summary:', err?.message || err);
      return res.status(500).json({ ok: false, error: 'Error calling ai-summary', message: err?.message || String(err) });
    }
  } catch (error: any) {
    console.error('[generate-now] Error:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Unknown error' });
  }
}