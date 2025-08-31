import { runCheck } from './check-gw';

/**
 * Test endpoint for local development
 * Calls the same logic as the cron but accessible for manual testing
 * Only works in development environment
 */
export default async function handler(req: any, res: any) {
  // Security: Only allow in development
  if (process.env.VERCEL_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoint not available in production' });
  }

  // Only allow GET for manual testing
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Test] Running manual gameweek check...');
  
  const result = await runCheck();
  
  console.log('[Test] Manual check complete:', {
    ok: result.ok,
    currentGw: result.currentGw,
    isFinished: result.isFinished,
    didTrigger: result.didTrigger
  });

  // Add test metadata to response
  const testResult = {
    ...result,
    _test: true,
    _environment: process.env.VERCEL_ENV || 'development',
    _timestamp: new Date().toISOString()
  };

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(200).json(testResult);
}
