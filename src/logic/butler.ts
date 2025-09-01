// Butler's arrogant assessment generator focused on gameweek performance
export function generateButlerAssessment(data: { weeklyStats: any }): string {
  const { weeklyStats } = data;

  if (!weeklyStats) {
    return "Butleren er for opptatt med å observere kompetente mennesker til å kommentere denne uken.";
  }

  // Extract gameweek-specific data
  const weekWinner = weeklyStats.weekWinner;
  const weekLoser = weeklyStats.weekLoser;
  const benchWarmer = weeklyStats.benchWarmer;
  const riser = weeklyStats.movements?.riser;
  const faller = weeklyStats.movements?.faller;
  const chipsUsed = weeklyStats.chipsUsed || [];
  const currentGw = weeklyStats.currentGw || weeklyStats?.formData?.currentGw || 0;

  // Deterministic selection helpers (seeded by GW + names so text is stable per GW)
  const hash = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  };
  const pick = <T>(arr: T[], seed: string): T => arr[Math.abs(hash(seed)) % arr.length];
  const seedBase = JSON.stringify({
    gw: currentGw,
    w: weekWinner?.manager,
    l: weekLoser?.manager,
    r: riser?.manager,
    f: faller?.manager,
    b: benchWarmer?.benchPoints
  });

  // Phrase banks
  const openings = [
    "Butleren har observert denne ukens amatøriske fremvisning:",
    "Som forventet leverte managerne en blandet forestilling:",
    "Butleren noterer seg følgende fra denne ukens prestasjoner:",
    "Etter å ha studert tallene med profesjonell forakt:",
    "Som alltid må butleren korrigere managernes oppfatning av suksess:"
  ];

  const topPhrases = [
    `${weekWinner?.manager} tok ${weekWinner?.points} poeng${riser?.change > 0 && riser.manager === weekWinner?.manager ? ` og klatret ${riser.change} plasser` : ''} – imponerende, men fortsatt under butlerens standard.`,
    `${weekWinner?.manager} leverte ${weekWinner?.points} poeng denne runden – et sjeldent øyeblikk av kompetanse som butleren anerkjenner.`,
    `${weekWinner?.manager} scoret ${weekWinner?.points} poeng – en prestasjon som nesten kvalifiserer som tilfredsstillende.`,
    `${weekWinner?.manager} oppnådde ${weekWinner?.points} poeng, noe som beviser at selv amatører kan ha lykkedager.`
  ];

  const weakPhrases = [
    `${weekLoser?.manager} leverte ${weekLoser?.points} poeng – så svakt at selv benken hans vurderte å melde overgang.`,
    `${weekLoser?.manager} scoret ${weekLoser?.points} poeng, en prestasjon som får butleren til å vurdere karriereskifte som manager.`,
    `${faller?.change < 0 ? `${faller.manager} falt ${Math.abs(faller.change)} plasser` : `${weekLoser?.manager} leverte ${weekLoser?.points} poeng`} – butleren er ikke overrasket.`,
    `${benchWarmer?.benchPoints > 10 ? `${benchWarmer.manager} hadde ${benchWarmer.benchPoints} poeng på benken` : `${weekLoser?.manager} scoret ${weekLoser?.points} poeng`} – en kunstform som krever dedikert inkompetanse.`
  ];

  const specialEvents = chipsUsed.length > 0 
    ? [`${chipsUsed[0].teamName.split(' ')[0]} aktiverte en chip – butleren håper det var verdt investeringen.`]
    : ["Ingen våget seg på chips denne uken – en beslutning butleren respekterer."];

  const punchlines = [
    "Denne runden beviste at man kan klatre, falle og fortsatt ikke imponere. Butleren forventer mer neste uke.",
    "Som alltid er butleren imponert over managernes evne til å skuffe forventningene.",
    "Butleren konkluderer med at fotball tydeligvis er vanskeligere enn det ser ut på TV.",
    "Til tross for disse prestasjonene, har butleren fortsatt tro på at forbedring er mulig.",
    "Butleren vil fortsette å observere med profesjonell tålmodighet og økende bekymring.",
    "Som vanlig må butleren justere sine forventninger nedover for neste uke.",
    "Butleren noterer seg at selv lave forventninger kan skuffes."
  ];

  // Deterministic selections
  const opening = pick(openings, seedBase + '|o');
  const topPhrase = pick(topPhrases, seedBase + '|t');
  const weakPhrase = pick(weakPhrases, seedBase + '|w');
  const specialEvent = pick(specialEvents, seedBase + '|s');
  const punchline = pick(punchlines, seedBase + '|p');

  return `${opening} ${topPhrase} ${weakPhrase} ${specialEvent} ${punchline}`;
}
