export interface Snapshot {
  meta: {
    leagueId: string;
    leagueName: string;
    gameweek: number;
    createdAt: string; // ISO
  };
  butler: {
    summary: string;
    templateId: string;
  };
  top3: Array<{ rank: 1|2|3; team: string; manager: string; points: number }>;
  bottom3: Array<{ rank: number; team: string; manager: string; points: number }>;
  weekly: {
    winner: { team: string; manager: string; points: number };
    loser: { team: string; manager: string; points: number };
    benchWarmer: { manager: string; team: string; benchPoints: number };
    chipsUsed: { count: number; list: Array<{ manager: string; team: string; chip: string; emoji: string }> };
    movements: {
      riser: { manager: string; team: string; delta: number };
      faller: { manager: string; team: string; delta: number };
    };
    nextDeadline: { gw: number; date: string; time: string };
  };
  form3: {
    window: number;
    hot: Array<{ manager: string; team: string; points: number }>;
    cold: Array<{ manager: string; team: string; points: number }>;
  };
  transferRoi: {
    genius: { manager: string; team: string; player?: string; roi: number };
    bomb: { manager: string; team: string; player?: string; roi: number };
  };
  highlights: Array<{ id: number; text: string }>;
  differentialHero: { 
    player: string; 
    points: number; 
    ownership: number;
    ownedBy: string[];
    managers: string[];
  };
}

// Legacy compatibility types for existing components
export interface LegacyWeeklyStats {
  weekWinner: { teamName: string; manager: string; points: number };
  weekLoser: { teamName: string; manager: string; points: number };
  benchWarmer: { manager: string; benchPoints: number };
  chipsUsed: Array<{ teamName: string; chip: string; emoji: string }>;
  movements: {
    riser: { teamName: string; manager: string; change: number };
    faller: { teamName: string; manager: string; change: number };
  };
  nextDeadline: { date: string; time: string; gameweek: number };
  formTable: {
    hotStreak: Array<{ manager: string; formPoints: number }>;
    coldStreak: Array<{ manager: string; formPoints: number }>;
  };
  formData?: { window?: number };
  transferROI: {
    genius: { manager: string; transfersIn: Array<{ name: string; points: number }> };
    flop: { manager: string; transfersIn: Array<{ name: string; points: number }> };
  };
  differential: {
    player: string;
    points: number;
    ownership: number;
    managers: string[];
  };
}

// Converter function from Snapshot to legacy format
export function snapshotToLegacy(snapshot: Snapshot): LegacyWeeklyStats {
  return {
    weekWinner: {
      teamName: snapshot.weekly.winner.team,
      manager: snapshot.weekly.winner.manager,
      points: snapshot.weekly.winner.points
    },
    weekLoser: {
      teamName: snapshot.weekly.loser.team,
      manager: snapshot.weekly.loser.manager,
      points: snapshot.weekly.loser.points
    },
    benchWarmer: {
      manager: snapshot.weekly.benchWarmer.manager,
      benchPoints: snapshot.weekly.benchWarmer.benchPoints
    },
    chipsUsed: snapshot.weekly.chipsUsed.list.map(chip => ({
      teamName: chip.team,
      chip: chip.chip,
      emoji: chip.emoji
    })),
    movements: {
      riser: {
        teamName: snapshot.weekly.movements.riser.team,
        manager: snapshot.weekly.movements.riser.manager,
        change: snapshot.weekly.movements.riser.delta
      },
      faller: {
        teamName: snapshot.weekly.movements.faller.team,
        manager: snapshot.weekly.movements.faller.manager,
        change: snapshot.weekly.movements.faller.delta
      }
    },
    nextDeadline: {
      date: snapshot.weekly.nextDeadline.date,
      time: snapshot.weekly.nextDeadline.time,
      gameweek: snapshot.weekly.nextDeadline.gw
    },
    formTable: {
      hotStreak: snapshot.form3.hot.map(h => ({
        manager: h.manager,
        formPoints: h.points
      })),
      coldStreak: snapshot.form3.cold.map(c => ({
        manager: c.manager,
        formPoints: c.points
      }))
    },
    formData: { window: snapshot.form3.window },
    transferROI: {
      genius: {
        manager: snapshot.transferRoi.genius.manager,
        transfersIn: [{ name: snapshot.transferRoi.genius.player || 'Ingen bytter', points: snapshot.transferRoi.genius.roi }]
      },
      flop: {
        manager: snapshot.transferRoi.bomb.manager,
        transfersIn: [{ name: snapshot.transferRoi.bomb.player || 'Ingen bytter', points: snapshot.transferRoi.bomb.roi }]
      }
    },
    differential: {
      player: snapshot.differentialHero.player,
      points: snapshot.differentialHero.points,
      ownership: snapshot.differentialHero.ownership,
      managers: snapshot.differentialHero.managers
    }
  };
}
