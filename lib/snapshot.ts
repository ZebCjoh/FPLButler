import type { Snapshot } from '../types/snapshot';

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

async function fetchFPL<T>(url: string): Promise<T> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
    'Accept': 'application/json',
    'Referer': 'https://fantasy.premierleague.com/'
  } as Record<string, string>;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const txt = await resp.text();
    console.error(`[snapshot] FPL ${resp.status} for ${url}:`, txt);
    throw new Error(`FPL request failed ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

async function safeJson(url: string): Promise<any> {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
      'Accept': 'application/json',
      'Referer': 'https://fantasy.premierleague.com/'
    }
  });
  const ct = r.headers.get('content-type') || '';
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!ct.includes('application/json')) throw new Error('Non-JSON response');
  return r.json();
}

function generateButlerAssessment(snapshot: Snapshot): string {
  const { weekly } = snapshot;
  
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  };
  
  const pick = <T,>(arr: T[], seed: string) => arr[Math.abs(hash(seed)) % arr.length];
  const seed = JSON.stringify({
    gw: snapshot.meta.gameweek,
    w: weekly.winner.manager,
    l: weekly.loser.manager
  });
  
  const structures = [
    () => generateClassicStructure(snapshot, pick, seed),
    () => generateStoryStructure(snapshot, pick, seed),
    () => generateListStructure(snapshot, pick, seed),
    () => generateComparisonStructure(snapshot, pick, seed),
    () => generateThematicStructure(snapshot, pick, seed)
  ];
  
  return pick(structures, seed + '|structure')();
}

function generateClassicStructure(snapshot: Snapshot, pick: any, seed: string): string {
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
  
  return `${pick(openings, seed + '|o')} ${pick(top, seed + '|t')} ${pick(weak, seed + '|w')} ${pick(special, seed + '|s')} ${pick(punch, seed + '|p')}`;
}

function generateStoryStructure(snapshot: Snapshot, pick: any, seed: string): string {
  const { weekly } = snapshot;
  const themes = ['Ukens saga handler om triumf og nederlag', 'Historien som utspant seg denne uken', 'I denne episoden av managerial drama'];
  const stories = [
    `så vi ${weekly.winner.manager} stige til toppen med ${weekly.winner.points} poeng, mens ${weekly.loser.manager} sank til bunns med ${weekly.loser.points}. En klassisk fortelling om kontraster som butleren har sett utallige ganger.`,
    `opplevde vi ${weekly.winner.manager} briljere med ${weekly.winner.points} poeng og ${weekly.loser.manager} demonstrere hvordan man oppnår ${weekly.loser.points} poeng med stil. Butleren noterer kunstnivået.`
  ];
  const conclusions = ['Butleren avventer neste kapittel med sedvanlig optimisme.', 'Historia fortsetter, butleren observerer.'];
  
  return `${pick(themes, seed + '|theme')} ${pick(stories, seed + '|story')} ${pick(conclusions, seed + '|conclusion')}`;
}

function generateListStructure(snapshot: Snapshot, pick: any, seed: string): string {
  const { weekly } = snapshot;
  const intros = ['Butlerens tre hovedobservasjoner fra denne uken:', 'Ukens viktigste lærdommer, ifølge butleren:'];
  const point1 = [`Førstens: ${weekly.winner.manager} leverte ${weekly.winner.points} poeng og viste sporadisk kompetanse.`];
  const point2 = [`Andrens: ${weekly.loser.manager} med ${weekly.loser.points} poeng bekreftet at konsistens finnes – bare ikke den type man ønsker.`];
  const point3 = weekly.benchWarmer.benchPoints > 10 ? [`Tredjens: ${weekly.benchWarmer.manager} hadde ${weekly.benchWarmer.benchPoints} poeng på benken – en kunst få behersker.`] : [`Tredjens: Benkebruk var gjennomgående kreativt denne uken.`];
  const summaries = ['Butleren konkluderer at listen kunne vært lenger, men tålmodigheten har grenser.'];
  
  return `${pick(intros, seed + '|intro')} ${pick(point1, seed + '|p1')} ${pick(point2, seed + '|p2')} ${pick(point3, seed + '|p3')} ${pick(summaries, seed + '|summary')}`;
}

function generateComparisonStructure(snapshot: Snapshot, pick: any, seed: string): string {
  const { weekly } = snapshot;
  const observers = ['Butleren sammenligner denne ukens prestasjoner:', 'I sitt komparative blikk noterer butleren:'];
  const winners = [`På den ene siden har vi ${weekly.winner.manager} som leverte ${weekly.winner.points} poeng – et eksempel på hva fokus kan oppnå.`];
  const losers = [`På den andre siden finner vi ${weekly.loser.manager} med ${weekly.loser.points} poeng – et like tydelig eksempel på alternativet.`];
  const futures = ['Butleren forutsier lignende kontraster neste uke.'];
  
  return `${pick(observers, seed + '|obs')} ${pick(winners, seed + '|win')} ${pick(losers, seed + '|lose')} ${pick(futures, seed + '|fut')}`;
}

function generateThematicStructure(snapshot: Snapshot, pick: any, seed: string): string {
  const { weekly } = snapshot;
  const themes = ['Kaos', 'Stabilitet', 'Overraskelser', 'Konsistens', 'Kontraster'];
  const selectedTheme = pick(themes, seed + '|theme');
  
  const themeIntros = {
    'Kaos': ['Ukens tema er kaos, og managerne leverte som forventet.'],
    'Stabilitet': ['Stabilitet var ukens uoffisielle motto.'],
    'Overraskelser': ['Overraskelser skulle bli ukens kjerneelement.'],
    'Konsistens': ['Konsistens var det definierende trekket.'],
    'Kontraster': ['Kontraster definerte denne gameweek.']
  };
  
  const analyses = {
    'Kaos': [`${weekly.winner.manager} navigerte kaoset til ${weekly.winner.points} poeng, mens ${weekly.loser.manager} lot seg overmanne og endte på ${weekly.loser.points}.`],
    'Stabilitet': [`${weekly.winner.manager} holdt kursen til ${weekly.winner.points} poeng, mens ${weekly.loser.manager} stabiliserte seg på ${weekly.loser.points}.`],
    'Overraskelser': [`${weekly.winner.manager} overrasket med ${weekly.winner.points} poeng, mens ${weekly.loser.manager} overrasket negativt med ${weekly.loser.points}.`],
    'Konsistens': [`${weekly.winner.manager} var konsistent sterk med ${weekly.winner.points} poeng, ${weekly.loser.manager} konsistent svak med ${weekly.loser.points}.`],
    'Kontraster': [`Kontrasten mellom ${weekly.winner.manager}s ${weekly.winner.points} poeng og ${weekly.loser.manager}s ${weekly.loser.points} var påfallende.`]
  };
  
  const conclusions = ['Butleren noterer temaets gjennomslag.', 'Temaet bekreftes av resultatene.'];
  
  return `${pick(themeIntros[selectedTheme as keyof typeof themeIntros] || themeIntros['Kaos'], seed + '|intro')} ${pick(analyses[selectedTheme as keyof typeof analyses] || analyses['Kaos'], seed + '|analysis')} ${pick(conclusions, seed + '|conclusion')}`;
}

export async function composeSnapshot(leagueId: string, gameweek: number): Promise<Snapshot> {
  console.log(`[snapshot] Composing snapshot for league ${leagueId}, GW ${gameweek}`);
  
  // 1. Bootstrap data for players and events
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
  const leagueName = leagueData.league.name;
  
  // 3. Live gameweek data for player points
  const liveData: any = await fetchFPL(`https://fantasy.premierleague.com/api/event/${gameweek}/live`);
  const pointsByElement: Record<number, number> = {};
  (liveData.elements || []).forEach((e: any) => {
    pointsByElement[e.id] = e.stats.total_points;
  });
  
  // 4. Per-entry data: picks, history, transfers
  const entryIds = standings.map((r) => r.entry);
  const chunk = <T,>(arr: T[], size: number) => arr.reduce<T[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
  
  const picksByEntry: Record<number, any> = {};
  const historyByEntry: Record<number, any> = {};
  const transfersByEntry: Record<number, any[]> = {};
  
  for (const group of chunk(entryIds, 5)) {
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
        } catch (_) {
          // Ignore individual failures
        }
      })
    );
  }
  
  // 5. Calculate form (last 3 gameweeks)
  const formWindow = Math.min(3, gameweek);
  const gwSet = new Set<number>();
  for (let i = 0; i < formWindow; i++) {
    const gw = gameweek - i;
    if (gw >= 1) gwSet.add(gw);
  }
  
  const formComputed = standings.map((row) => {
    const entryId = row.entry;
    const hist = historyByEntry[entryId]?.current || [];
    const points = hist
      .filter((h: any) => gwSet.has(h.event))
      .reduce((sum: number, h: any) => sum + (h.points || 0), 0);
    return {
      entryId,
      manager: row.player_name,
      team: row.entry_name,
      points,
    };
  });
  
  const formSorted = [...formComputed].sort((a, b) => b.points - a.points);
  
  // 6. Bench points and chips
  const benchByEntry: Record<number, number> = {};
  const chipsUsed: Array<{ manager: string; team: string; chip: string; emoji: string }> = [];
  const chipEmoji: Record<string, string> = {
    triple_captain: '⚡',
    wildcard: '🃏',
    freehit: '🎯',
    bench_boost: '🏟️',
  };
  
  standings.forEach((row) => {
    const entryId = row.entry;
    const picks = picksByEntry[entryId];
    if (picks?.picks) {
      const bench = picks.picks
        .filter((p: any) => p.multiplier === 0)
        .reduce((sum: number, p: any) => sum + (pointsByElement[p.element] || 0), 0);
      benchByEntry[entryId] = bench;
    } else {
      benchByEntry[entryId] = 0;
    }
    const chip = picks?.active_chip;
    if (chip) {
      chipsUsed.push({ 
        manager: row.player_name,
        team: row.entry_name, 
        chip, 
        emoji: chipEmoji[chip] || '🎯' 
      });
    }
  });
  
  // 7. Transfer ROI for current GW - find best/worst individual transfers
  const allTransfers: Array<{ manager: string; team: string; playerName: string; points: number }> = [];
  standings.forEach((row) => {
    const entryId = row.entry;
    const transfers = (transfersByEntry[entryId] || []).filter((t: any) => t.event === gameweek);
    transfers.forEach((t: any) => {
      const pts = pointsByElement[t.element_in] || 0;
      const name = elementIdToName[t.element_in] || `#${t.element_in}`;
      allTransfers.push({
        manager: row.player_name,
        team: row.entry_name,
        playerName: name,
        points: pts
      });
    });
  });
  
  // Sort all individual transfers by points (highest first)
  const sortedTransfers = allTransfers.sort((a, b) => b.points - a.points);
  const bestTransfer = sortedTransfers[0] || { manager: '-', team: '-', playerName: 'Ingen bytter', points: 0 };
  const worstTransfer = sortedTransfers[sortedTransfers.length - 1] || { manager: '-', team: '-', playerName: 'Ingen bytter', points: 0 };
  
  // 8. Differential hero (fewest owners, highest points)
  const ownershipCount: Record<number, number> = {};
  standings.forEach((row) => {
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
  
  let diffPlayerName = '-';
  let diffPointsValue = 0;
  const diffOwners: string[] = [];
  const diffManagers: string[] = [];
  if (diffCandidate !== null) {
    const dc = diffCandidate as { id: number; owners: number; points: number };
    diffPlayerName = elementIdToName[dc.id] || `#${dc.id}`;
    diffPointsValue = dc.points;
    standings.forEach((row) => {
      const entryId = row.entry;
      const picks = picksByEntry[entryId]?.picks || [];
      if (picks.some((p: any) => p.element === dc.id)) {
        diffOwners.push(row.entry_name);
        diffManagers.push(row.player_name);
      }
    });
  }
  
  // 9. Weekly stats calculations
  const weekWinner = [...standings].sort((a, b) => (b.event_total || 0) - (a.event_total || 0))[0];
  const weekLoser = [...standings].sort((a, b) => (a.event_total || 0) - (b.event_total || 0))[0];
  const benchWarmer = Object.entries(benchByEntry)
    .map(([entryId, bench]) => {
      const row = standings.find((r) => r.entry === Number(entryId));
      return { 
        entryId: Number(entryId),
        manager: row?.player_name || 'Ukjent', 
        team: row?.entry_name || 'Ukjent',
        benchPoints: bench as number 
      };
    })
    .sort((a, b) => {
      const pointsDiff = b.benchPoints - a.benchPoints;
      if (pointsDiff !== 0) return pointsDiff;
      return a.entryId - b.entryId; // Tie-breaker
    })[0];
  
  const movements = standings.map(s => ({ 
    manager: s.player_name, 
    team: s.entry_name, 
    change: (s.last_rank || s.rank) - s.rank 
  }));
  const riser = [...movements].sort((a, b) => b.change - a.change)[0];
  const faller = [...movements].sort((a, b) => a.change - b.change)[0];
  
  // 10. Next deadline
  const nextEvent = events.find((e) => !e.finished && !e.is_current);
  const nextDeadline = nextEvent ? {
    gw: nextEvent.id,
    date: new Date(nextEvent.deadline_time).toLocaleDateString('no-NO'),
    time: new Date(nextEvent.deadline_time).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }),
  } : { 
    gw: gameweek + 1, 
    date: 'TBA', 
    time: 'TBA' 
  };
  
  // 11. Build snapshot
  const diffPlayer: string = diffPlayerName;
  const diffPoints: number = diffPointsValue;

  const snapshot: Snapshot = {
    meta: {
      leagueId,
      leagueName,
      gameweek,
      createdAt: new Date().toISOString(),
    },
    butler: {
      summary: '', // Will be generated after snapshot is complete
    },
    top3: standings.slice(0, 3).map((team, index) => ({
      rank: (index + 1) as 1|2|3,
      team: team.entry_name,
      manager: team.player_name,
      points: team.total
    })),
    bottom3: standings.slice(-3).map((team, index) => ({
      rank: standings.length - 2 + index,
      team: team.entry_name,
      manager: team.player_name,
      points: team.total
    })),
    weekly: {
      winner: {
        team: weekWinner?.entry_name || '-',
        manager: weekWinner?.player_name || '-',
        points: weekWinner?.event_total || 0
      },
      loser: {
        team: weekLoser?.entry_name || '-',
        manager: weekLoser?.player_name || '-',
        points: weekLoser?.event_total || 0
      },
      benchWarmer: {
        manager: benchWarmer?.manager || '-',
        team: benchWarmer?.team || '-',
        benchPoints: benchWarmer?.benchPoints || 0
      },
      chipsUsed: {
        count: chipsUsed.length,
        list: chipsUsed
      },
      movements: {
        riser: {
          manager: riser?.manager || '-',
          team: riser?.team || '-',
          delta: Math.max(0, riser?.change || 0)
        },
        faller: {
          manager: faller?.manager || '-',
          team: faller?.team || '-',
          delta: Math.min(0, faller?.change || 0)
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
        manager: bestTransfer.manager,
        team: bestTransfer.team,
        player: bestTransfer.playerName,
        roi: bestTransfer.points
      },
      bomb: {
        manager: worstTransfer.manager,
        team: worstTransfer.team,
        player: worstTransfer.playerName,
        roi: worstTransfer.points
      }
    },
    highlights: [
      { id: 1, text: `Rundens helt: ${weekWinner?.player_name || '-'} med ${weekWinner?.event_total || 0} poeng` },
      { id: 2, text: `${chipsUsed.length} chips ble aktivert denne runden` },
      { id: 3, text: `Største bevegelse: ${riser?.manager || '-'} (+${Math.max(0, riser?.change || 0)} plasser)` }
    ],
    differentialHero: {
      player: diffPlayer,
      points: diffPoints,
      ownership: diffOwners.length,
      ownedBy: diffOwners,
      managers: diffManagers
    }
  };
  
  // 12. Generate butler assessment based on snapshot
  snapshot.butler.summary = generateButlerAssessment(snapshot);
  
  console.log(`[snapshot] Composed snapshot for GW ${gameweek} with ${standings.length} teams`);
  return snapshot;
}
