import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

// Inline: comprehensive weekly stats generator (backend-only)
async function fetchFPL<T>(url: string): Promise<T> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
    'Accept': 'application/json',
    'Referer': 'https://fantasy.premierleague.com/'
  } as Record<string, string>;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const txt = await resp.text();
    console.error(`[generate-now] FPL ${resp.status} for ${url}:`, txt);
    throw new Error(`FPL request failed ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

async function generateComprehensiveWeeklyStats(gameweek: number): Promise<any> {
  const FPL_LEAGUE_ID = 155099;
  const leagueData: any = await fetchFPL<any>(`https://fantasy.premierleague.com/api/leagues-classic/${FPL_LEAGUE_ID}/standings/`);
  const liveData: any = await fetchFPL<any>(`https://fantasy.premierleague.com/api/event/${gameweek}/live/`);

  const standings = leagueData.standings.results as Array<{
    entry: number; entry_name: string; player_name: string; rank: number; last_rank: number; total: number; event_total?: number;
  }>;
  const livePointsMap = new Map<number, number>((liveData.elements || []).map((p: any) => [Number(p.id ?? p.element ?? 0), p.stats?.total_points ?? 0]));

  const managerIds = standings.map((s) => s.entry);
  const managerData = await Promise.all(managerIds.map(async (id) => {
    try {
      const picks: any = await fetchFPL<any>(`https://fantasy.premierleague.com/api/entry/${id}/event/${gameweek}/picks/`);
      return { id, picks };
    } catch (e) {
      console.warn('[generate-now] picks failed for', id, e);
      return { id, picks: null };
    }
  }));
  const managerDataMap = new Map<number, { id: number; picks: any }>(managerData.map((m) => [m.id, m as any]));

  const chipsUsed: Array<{ teamName: string; chip: string; emoji: string }> = [];
  const benchPoints: { manager: string; teamName: string; points: number }[] = [];
  for (const m of standings) {
    const d = managerDataMap.get(m.entry);
    if (!d || !d.picks || !d.picks.picks) continue;
    const typed = d.picks.picks as Array<{ element: number; multiplier: number }>;
    const chip = d.picks.active_chip as string | null;
    if (chip) {
      const map: Record<string, string> = { triple_captain: '⚡', wildcard: '🃏', freehit: '🎯', bench_boost: '🏟️' };
      chipsUsed.push({ teamName: m.entry_name, chip, emoji: map[chip] || 'CHIP' });
    }
    const bench = typed.filter(p => p.multiplier === 0).reduce((sum, p) => sum + (livePointsMap.get(p.element) || 0), 0);
    benchPoints.push({ manager: m.player_name, teamName: m.entry_name, points: bench });
  }

  const weekWinner = [...standings].sort((a,b)=> (b.event_total||0)-(a.event_total||0))[0];
  const weekLoser = [...standings].sort((a,b)=> (a.event_total||0)-(b.event_total||0))[0];
  const benchWarmer = [...benchPoints].sort((a,b)=> b.points-a.points)[0];
  const movements = standings.map(s => ({ manager: s.player_name, teamName: s.entry_name, change: (s.last_rank||s.rank)-s.rank }));
  const riser = [...movements].sort((a,b)=> b.change-a.change)[0];
  const faller = [...movements].sort((a,b)=> a.change-b.change)[0];

  return {
    currentGw: gameweek,
    weekWinner: { manager: weekWinner?.player_name||'-', teamName: weekWinner?.entry_name||'-', points: weekWinner?.event_total||0 },
    weekLoser: { manager: weekLoser?.player_name||'-', teamName: weekLoser?.entry_name||'-', points: weekLoser?.event_total||0 },
    benchWarmer: { manager: benchWarmer?.manager||'-', teamName: benchWarmer?.teamName||'-', benchPoints: benchWarmer?.points||0 },
    chipsUsed,
    movements: { riser: { manager: riser?.manager||'-', teamName: riser?.teamName||'-', change: riser?.change||0 }, faller: { manager: faller?.manager||'-', teamName: faller?.teamName||'-', change: faller?.change||0 } }
  };
}

// Inline: butler text generator (deterministic)
function generateButlerAssessment(data: { weeklyStats: any }): string {
  const { weeklyStats } = data;
  if (!weeklyStats) return 'Butleren er for opptatt med å observere kompetente mennesker til å kommentere denne uken.';
  const { weekWinner, weekLoser, benchWarmer } = weeklyStats;
  const riser = weeklyStats.movements?.riser;
  const faller = weeklyStats.movements?.faller;
  const chipsUsed = weeklyStats.chipsUsed || [];
  const currentGw = weeklyStats.currentGw || 0;
  const hash = (s: string): number => { let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);} return h>>>0; };
  const pick = <T,>(arr: T[], seed: string): T => arr[Math.abs(hash(seed)) % arr.length];
  const seed = JSON.stringify({ gw: currentGw, w: weekWinner?.manager, l: weekLoser?.manager, r: riser?.manager, f: faller?.manager, b: benchWarmer?.benchPoints });
  const openings = [
    'Butleren har observert denne ukens amatøriske fremvisning:',
    'Som forventet leverte managerne en blandet forestilling:',
    'Butleren noterer seg følgende fra denne ukens prestasjoner:',
    'Etter å ha studert tallene med profesjonell forakt:',
    'Som alltid må butleren korrigere managernes oppfatning av suksess:'
  ];
  const top = [
    `${weekWinner?.manager} tok ${weekWinner?.points} poeng${riser?.change > 0 && riser?.manager === weekWinner?.manager ? ` og klatret ${riser.change} plasser` : ''} – imponerende, men fortsatt under butlerens standard.`,
    `${weekWinner?.manager} leverte ${weekWinner?.points} poeng denne runden – et sjeldent øyeblikk av kompetanse som butleren anerkjenner.`,
    `${weekWinner?.manager} scoret ${weekWinner?.points} poeng – en prestasjon som nesten kvalifiserer som tilfredsstillende.`,
    `${weekWinner?.manager} oppnådde ${weekWinner?.points} poeng, noe som beviser at selv amatører kan ha lykkedager.`
  ];
  const weak = [
    `${weekLoser?.manager} leverte ${weekLoser?.points} poeng – så svakt at selv benken hans vurderte å melde overgang.`,
    `${weekLoser?.manager} scoret ${weekLoser?.points} poeng, en prestasjon som får butleren til å vurdere karriereskifte som manager.`,
    `${faller?.change < 0 ? `${faller?.manager} falt ${Math.abs(faller?.change)} plasser` : `${weekLoser?.manager} leverte ${weekLoser?.points} poeng`} – butleren er ikke overrasket.`,
    `${benchWarmer?.benchPoints > 10 ? `${benchWarmer?.manager} hadde ${benchWarmer?.benchPoints} poeng på benken` : `${weekLoser?.manager} scoret ${weekLoser?.points} poeng`} – en kunstform som krever dedikert inkompetanse.`
  ];
  const special = chipsUsed.length > 0 ? [`${(chipsUsed[0].teamName || '').split(' ')[0]} aktiverte en chip – butleren håper det var verdt investeringen.`] : ['Ingen våget seg på chips denne uken – en beslutning butleren respekterer.'];
  const punch = [
    'Denne runden beviste at man kan klatre, falle og fortsatt ikke imponere. Butleren forventer mer neste uke.',
    'Som alltid er butleren imponert over managernes evne til å skuffe forventningene.',
    'Butleren konkluderer med at fotball tydeligvis er vanskeligere enn det ser ut på TV.',
    'Til tross for disse prestasjonene, har butleren fortsatt tro på at forbedring er mulig.',
    'Butleren vil fortsette å observere med profesjonell tålmodighet og økende bekymring.',
    'Som vanlig må butleren justere sine forventninger nedover for neste uke.',
    'Butleren noterer seg at selv lave forventninger kan skuffes.'
  ];
  return `${pick(openings, seed+'|o')} ${pick(top, seed+'|t')} ${pick(weak, seed+'|w')} ${pick(special, seed+'|s')} ${pick(punch, seed+'|p')}`;
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
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Missing BLOB_READ_WRITE_TOKEN' });
    }

    const gwParam = (req.query?.gw as string) || '';
    const gw = Number.isFinite(Number(gwParam)) && Number(gwParam) > 0
      ? Number(gwParam)
      : await resolveTargetGw();

    // Build full weekly stats and generate butler text
    const weeklyStats = await generateComprehensiveWeeklyStats(gw);
    const summary = generateButlerAssessment({ weeklyStats });

    const payload = {
      gameweek: gw,
      summary,
      generatedAt: new Date().toISOString()
    };

    const { url } = await put('ai-summary.json', JSON.stringify(payload, null, 2), {
      access: 'public',
      contentType: 'application/json',
      token,
      addRandomSuffix: false
    });

    return res.status(200).json({ ok: true, gameweek: gw, url });
  } catch (error: any) {
    console.error('[generate-now] Error:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Unknown error' });
  }
}


