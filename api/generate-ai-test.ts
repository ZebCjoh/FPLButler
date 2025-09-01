import { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { generateButlerAssessment } from '../src/logic/butler';

interface AISummary {
  gameweek: number;
  summary: string;
  generatedAt: string;
}

/**
 * Manual test endpoint to generate AI summary for current gameweek
 * Only works in development or when manually triggered
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[AI Test] Manually generating AI summary...');
    
    // Fetch current FPL data (simplified version)
    const [bootstrapResponse, leagueResponse] = await Promise.all([
      fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
          'Accept': 'application/json',
          'Referer': 'https://fantasy.premierleague.com/',
        },
      }),
      fetch('https://fantasy.premierleague.com/api/leagues-classic/155099/standings/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
          'Accept': 'application/json',
          'Referer': 'https://fantasy.premierleague.com/',
        },
      })
    ]);

    if (!bootstrapResponse.ok || !leagueResponse.ok) {
      throw new Error('Failed to fetch FPL data for AI summary');
    }

    const [bootstrapData, leagueData] = await Promise.all([
      bootstrapResponse.json(),
      leagueResponse.json()
    ]);

    // Get current gameweek
    const currentGW = bootstrapData.events.find((event: any) => event.is_current)?.id || 3;
    
    // Get league entries
    const leagueEntries = leagueData.standings?.results || [];
    
    // Sort by event_total to find week winner/loser
    const sortedByEventTotal = [...leagueEntries].sort((a, b) => (b.event_total || 0) - (a.event_total || 0));
    
    // Create weekly stats for AI generation
    const weeklyStats = {
      weekWinner: sortedByEventTotal[0] ? {
        manager: sortedByEventTotal[0].player_name,
        points: sortedByEventTotal[0].event_total || 0
      } : null,
      weekLoser: sortedByEventTotal[sortedByEventTotal.length - 1] ? {
        manager: sortedByEventTotal[sortedByEventTotal.length - 1].player_name,
        points: sortedByEventTotal[sortedByEventTotal.length - 1].event_total || 0
      } : null,
      benchWarmer: {
        manager: 'Unknown',
        benchPoints: 0
      },
      movements: {
        riser: { manager: 'Unknown', change: 0 },
        faller: { manager: 'Unknown', change: 0 }
      },
      chipsUsed: []
    };

    // Generate AI assessment
    const aiSummary = generateButlerAssessment({ weeklyStats });
    const generatedAt = new Date().toISOString();
    
    const aiSummaryData: AISummary = {
      gameweek: currentGW,
      summary: aiSummary,
      generatedAt
    };

    // Store AI summary in Blob
    await put('fpl-butler/ai-summary.json', JSON.stringify(aiSummaryData, null, 2), {
      contentType: 'application/json'
    });

    console.log(`[AI Test] Generated and stored AI summary for GW ${currentGW}: "${aiSummary.substring(0, 50)}..."`);
    
    return res.status(200).json({
      success: true,
      gameweek: currentGW,
      summary: aiSummary,
      generatedAt,
      message: 'AI summary generated and stored successfully'
    });
    
  } catch (error) {
    console.error('[AI Test] Error generating AI summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
