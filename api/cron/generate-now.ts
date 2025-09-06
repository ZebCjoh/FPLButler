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
  
  const { weekWinner, weekLoser } = weeklyStats;
  // const riser = weeklyStats.movements?.riser; 
  // const faller = weeklyStats.movements?.faller; 
  // const chipsUsed = weeklyStats.chipsUsed || []; 
  const currentGw = weeklyStats.currentGw || 0;
  
  const hash = (s:string)=>{let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);} return h>>>0;};
  const pick = <T,>(arr:T[], seed:string)=>arr[Math.abs(hash(seed))%arr.length];
  const seed = JSON.stringify({gw:currentGw,w:weekWinner?.manager,l:weekLoser?.manager});
  
  // 5 forskjellige strukturer for maksimal variasjon
  const structures = [
    () => generateClassicStructure(weeklyStats, pick, seed),
    () => generateStoryStructure(weeklyStats, pick, seed),
    () => generateListStructure(weeklyStats, pick, seed),
    () => generateComparisonStructure(weeklyStats, pick, seed),
    () => generateThematicStructure(weeklyStats, pick, seed)
  ];
  
  return pick(structures, seed + '|structure')();
}

function generateClassicStructure(weeklyStats: any, pick: any, seed: string): string {
  const { weekWinner, weekLoser, benchWarmer } = weeklyStats;
  const riser = weeklyStats.movements?.riser; const faller = weeklyStats.movements?.faller; const chipsUsed = weeklyStats.chipsUsed || [];
  
  const openings=['Butleren har observert denne ukens amatøriske fremvisning:','Som forventet leverte managerne en blandet forestilling:','Butleren noterer seg følgende fra denne ukens prestasjoner:','Etter å ha studert tallene med profesjonell forakt:','Som alltid må butleren korrigere managernes oppfatning av suksess:','Ukens analyse avslører de vanlige mistankene:','Butlerens øyne har igjen vitnet amatørisme av høyeste kaliber:','Med sin sedvanlige tålmodighet observerer butleren:'];
  
  const top=[`${weekWinner?.manager} tok ${weekWinner?.points} poeng${riser?.change>0&&riser?.manager===weekWinner?.manager?` og klatret ${riser.change} plasser`:''} – imponerende, men fortsatt under butlerens standard.`,`${weekWinner?.manager} leverte ${weekWinner?.points} poeng denne runden – et sjeldent øyeblikk av kompetanse som butleren anerkjenner.`,`${weekWinner?.manager} scoret ${weekWinner?.points} poeng – en prestasjon som nesten kvalifiserer som tilfredsstillende.`,`${weekWinner?.manager} oppnådde ${weekWinner?.points} poeng, noe som beviser at selv amatører kan ha lykkedager.`,`${weekWinner?.manager} imponerte med ${weekWinner?.points} poeng – butleren må innrømme at det var uventet kompetent.`,`${weekWinner?.manager} leverte ${weekWinner?.points} poeng og beviste at sporadisk dyktighet eksisterer.`];
  
  const weak=[`${weekLoser?.manager} leverte ${weekLoser?.points} poeng – så svakt at selv benken hans vurderte å melde overgang.`,`${weekLoser?.manager} scoret ${weekLoser?.points} poeng, en prestasjon som får butleren til å vurdere karriereskifte som manager.`,`${faller?.change<0?`${faller?.manager} falt ${Math.abs(faller?.change)} plasser`:`${weekLoser?.manager} leverte ${weekLoser?.points} poeng`} – butleren er ikke overrasket.`,`${benchWarmer?.benchPoints>10?`${benchWarmer?.manager} hadde ${benchWarmer?.benchPoints} poeng på benken`:`${weekLoser?.manager} scoret ${weekLoser?.points} poeng`} – en kunstform som krever dedikert inkompetanse.`,`${weekLoser?.manager} oppnådde ${weekLoser?.points} poeng og bekreftet butlerens laveste forventninger.`,`${weekLoser?.manager} leverte en forestilling på ${weekLoser?.points} poeng som vil huskes av alle feil grunner.`];
  
  const special=chipsUsed.length>0?[`${(chipsUsed[0].teamName||'').split(' ')[0]} aktiverte en chip – butleren håper det var verdt investeringen.`,`En chip ble brukt av ${(chipsUsed[0].teamName||'').split(' ')[0]} – desperat, men forståelig.`,`${(chipsUsed[0].teamName||'').split(' ')[0]} tok sjansen med en chip – butleren respekterer håpet.`]:['Ingen våget seg på chips denne uken – en beslutning butleren respekterer.','Ukens chip-bruk var ikke-eksisterende – kanskje visdom, kanskje feighet.'];
  
  const punch=['Denne runden beviste at man kan klatre, falle og fortsatt ikke imponere. Butleren forventer mer neste uke.','Som alltid er butleren imponert over managernes evne til å skuffe forventningene.','Butleren konkluderer med at fotball tydeligvis er vanskeligere enn det ser ut på TV.','Til tross for disse prestasjonene, har butleren fortsatt tro på at forbedring er mulig.','Butleren vil fortsette å observere med profesjonell tålmodighet og økende bekymring.','Som vanlig må butleren justere sine forventninger nedover for neste uke.','Butleren noterer seg at selv lave forventninger kan skuffes.','Etter denne uken er butleren overbevist om at fotball-ekspertise er en myte.','Butleren konkluderer: ambisjon og resultat står i omvendt proporsjon.'];
  
  return `${pick(openings,seed+'|o')} ${pick(top,seed+'|t')} ${pick(weak,seed+'|w')} ${pick(special,seed+'|s')} ${pick(punch,seed+'|p')}`;
}

function generateStoryStructure(weeklyStats: any, pick: any, seed: string): string {
  const { weekWinner, weekLoser } = weeklyStats;
  const themes = ['Ukens saga handler om triumf og nederlag','Historien som utspant seg denne uken','I denne episoden av managerial drama','Ukens narrative følger et kjent mønster','Som i enhver god tragedie'];
  const stories = [`så vi ${weekWinner?.manager} stige til toppen med ${weekWinner?.points} poeng, mens ${weekLoser?.manager} sank til bunns med ${weekLoser?.points}. En klassisk fortelling om kontraster som butleren har sett utallige ganger.`,`opplevde vi ${weekWinner?.manager} briljere med ${weekWinner?.points} poeng og ${weekLoser?.manager} demonstrere hvordan man oppnår ${weekLoser?.points} poeng med stil. Butleren noterer kunstnivået.`,`bevitnet vi ${weekWinner?.manager} vise hvordan ${weekWinner?.points} poeng skal oppnås, mens ${weekLoser?.manager} illustrerte alternativet med ${weekLoser?.points}. Butleren applauderer begge for klarhet.`];
  const surprises = ['Det overraskende var ikke resultatene, men mangelen på overraskelser.','Butleren ble faktisk overrasket – over hvor forutsigbart alt var.','Ukens plot twist: ingen plot twist.'];
  const conclusions = ['Butleren avventer neste kapittel med sedvanlig optimisme.','Historia fortsetter, butleren observerer.','Og slik ender et nytt kapittel i boken om managerial middelmådighet.'];
  
  return `${pick(themes,seed+'|theme')} ${pick(stories,seed+'|story')} ${pick(surprises,seed+'|surprise')} ${pick(conclusions,seed+'|conclusion')}`;
}

function generateListStructure(weeklyStats: any, pick: any, seed: string): string {
  const { weekWinner, weekLoser, benchWarmer } = weeklyStats;
  const intros = ['Butlerens tre hovedobservasjoner fra denne uken:','Ukens viktigste lærdommer, ifølge butleren:','Tre ting som kjennetegnet denne runden:','Butlerens liste over ukens bemerkelsesverdigheter:'];
  const point1 = [`Førstens: ${weekWinner?.manager} leverte ${weekWinner?.points} poeng og viste sporadisk kompetanse.`,`Punkt én: ${weekWinner?.manager} oppnådde ${weekWinner?.points} poeng mot alle odds.`,`For det første: ${weekWinner?.manager} scoret ${weekWinner?.points} poeng og overrasket butleren.`];
  const point2 = [`Andrens: ${weekLoser?.manager} med ${weekLoser?.points} poeng bekreftet at konsistens finnes – bare ikke den type man ønsker.`,`Punkt to: ${weekLoser?.manager} leverte ${weekLoser?.points} poeng og viste dedication til underprestasjoner.`,`For det andre: ${weekLoser?.manager} oppnådde ${weekLoser?.points} poeng med imponerende forutsigbarhet.`];
  const point3 = benchWarmer?.benchPoints > 10 ? [`Tredjens: ${benchWarmer?.manager} hadde ${benchWarmer?.benchPoints} poeng på benken – en kunst få behersker.`,`Punkt tre: ${benchWarmer?.manager} demonstrerte benkens potensial med ${benchWarmer?.benchPoints} poeng.`] : [`Tredjens: Benkebruk var gjennomgående kreativt denne uken.`,`Punkt tre: Benkevalgene illustrerte mangfoldet i strategisk tenkning.`];
  const summaries = ['Butleren konkluderer at listen kunne vært lenger, men tålmodigheten har grenser.','Som alltid bekrefter listen at fotball er komplisert, management enda mer.','Listen avsluttes her av hensyn til lesernes mentale helse.'];
  
  return `${pick(intros,seed+'|intro')} ${pick(point1,seed+'|p1')} ${pick(point2,seed+'|p2')} ${pick(point3,seed+'|p3')} ${pick(summaries,seed+'|summary')}`;
}

function generateComparisonStructure(weeklyStats: any, pick: any, seed: string): string {
  const { weekWinner, weekLoser } = weeklyStats;
  const observers = ['Butleren sammenligner denne ukens prestasjoner:','I sitt komparative blikk noterer butleren:','Ved å stille prestasjonene ved siden av hverandre ser butleren:'];
  const winners = [`På den ene siden har vi ${weekWinner?.manager} som leverte ${weekWinner?.points} poeng – et eksempel på hva fokus kan oppnå.`,`Først: ${weekWinner?.manager} med ${weekWinner?.points} poeng viser at kompetanse sporadisk eksisterer.`,`I det ene hjørnet: ${weekWinner?.manager} leverte ${weekWinner?.points} poeng og hevet standarden.`];
  const losers = [`På den andre siden finner vi ${weekLoser?.manager} med ${weekLoser?.points} poeng – et like tydelig eksempel på alternativet.`,`Deretter: ${weekLoser?.manager} med ${weekLoser?.points} poeng illustrerer spektrets andre ende.`,`I det andre hjørnet: ${weekLoser?.manager} oppnådde ${weekLoser?.points} poeng og satte sin egen standard.`];
  const historical = ['Historisk sett er dette mønsteret velkjent for butleren.','Sammenlignet med tidligere uker er dette gjenkjennelig.','I kontekst av sesongen er dette intet nytt under solen.'];
  const futures = ['Butleren forutsier lignende kontraster neste uke.','Framtiden vil bringe varianter av samme tema.','Neste runde vil sannsynligvis følge etablerte mønstre.'];
  
  return `${pick(observers,seed+'|obs')} ${pick(winners,seed+'|win')} ${pick(losers,seed+'|lose')} ${pick(historical,seed+'|hist')} ${pick(futures,seed+'|fut')}`;
}

function generateThematicStructure(weeklyStats: any, pick: any, seed: string): string {
  const { weekWinner, weekLoser, benchWarmer } = weeklyStats;
  const riser = weeklyStats.movements?.riser; const faller = weeklyStats.movements?.faller;
  
  const themes = ['Kaos','Stabilitet','Overraskelser','Konsistens','Kontraster','Ironi','Forutsigbarhet'];
  const selectedTheme = pick(themes, seed + '|theme');
  
  const themeIntros = {
    'Kaos': ['Ukens tema er kaos, og managerne leverte som forventet.','Kaos regjerte denne uken, til butlerens glede.'],
    'Stabilitet': ['Stabilitet var ukens uoffisielle motto.','Stabilitet dominerte, på godt og vondt.'],
    'Overraskelser': ['Overraskelser skulle bli ukens kjerneelement.','Uken var full av overraskelser, enkelte positive.'],
    'Konsistens': ['Konsistens var det definierende trekket.','Konsistens preget uken, bare ikke alltid positivt.'],
    'Kontraster': ['Kontraster definerte denne gameweek.','Ukens kontraster var slående.'],
    'Ironi': ['Ironi var ukens ledestjerne.','Ironien var tykk som tåke denne uken.'],
    'Forutsigbarhet': ['Forutsigbarhet var ukens røde tråd.','Alt utviklet seg forutsigbart denne uken.']
  };
  
  const analyses = {
    'Kaos': [`${weekWinner?.manager} navigerte kaoset til ${weekWinner?.points} poeng, mens ${weekLoser?.manager} lot seg overmanne og endte på ${weekLoser?.points}.`],
    'Stabilitet': [`${weekWinner?.manager} holdt kursen til ${weekWinner?.points} poeng, mens ${weekLoser?.manager} stabiliserte seg på ${weekLoser?.points}.`],
    'Overraskelser': [`${weekWinner?.manager} overrasket med ${weekWinner?.points} poeng, mens ${weekLoser?.manager} overrasket negativt med ${weekLoser?.points}.`],
    'Konsistens': [`${weekWinner?.manager} var konsistent sterk med ${weekWinner?.points} poeng, ${weekLoser?.manager} konsistent svak med ${weekLoser?.points}.`],
    'Kontraster': [`Kontrasten mellom ${weekWinner?.manager}s ${weekWinner?.points} poeng og ${weekLoser?.manager}s ${weekLoser?.points} var påfallende.`],
    'Ironi': [`Ironisk nok leverte ${weekWinner?.manager} ${weekWinner?.points} poeng når det minst var forventet, mens ${weekLoser?.manager} skuffet med ${weekLoser?.points} når håpet var størst.`],
    'Forutsigbarhet': [`Som ventet leverte ${weekWinner?.manager} ${weekWinner?.points} poeng, og ${weekLoser?.manager} ${weekLoser?.points} – alt ifølge butlerens prognoser.`]
  };
  
  const conclusions = ['Butleren noterer temaets gjennomslag.','Temaet bekreftes av resultatene.','Som alltid illustrerer temaet managernes essens.'];
  
  return `${pick(themeIntros[selectedTheme as keyof typeof themeIntros] || themeIntros['Kaos'], seed+'|intro')} ${pick(analyses[selectedTheme as keyof typeof analyses] || analyses['Kaos'], seed+'|analysis')} ${pick(conclusions, seed+'|conclusion')}`;
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

    // Also save to history via internal API call
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://fpl-butler.vercel.app';
      const historyResponse = await fetch(`${baseUrl}/api/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameweek: gw,
          summary: summary
        })
      });
      
      if (historyResponse.ok) {
        console.log(`[generate-now] Saved GW ${gw} to history successfully`);
      } else {
        console.warn(`[generate-now] Failed to save to history: ${historyResponse.status}`);
      }
    } catch (historyError) {
      console.warn(`[generate-now] History save error:`, historyError);
    }

    return res.status(200).json({ ok: true, gameweek: gw, url });
  } catch (error: any) {
    console.error('[generate-now] Error:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Unknown error' });
  }
}


