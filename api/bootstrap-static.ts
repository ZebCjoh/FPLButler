import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache configuration
const CACHE_DURATION_SECONDS = 60; // 1 minute
let cache = {
  data: null as any,
  timestamp: 0,
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && response.status >= 500 && retries > 0) {
      console.warn(`FPL API request failed with status ${response.status}. Retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`FPL API request failed with error: ${error}. Retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  // Check cache first
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_DURATION_SECONDS * 1000) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
  }

  res.setHeader('X-Cache', 'MISS');

  const FPL_API_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
  const requestOptions: RequestInit = {
    headers: {
      'User-Agent': 'FPLButler/1.0 (https://github.com/ZebCjoh/FPLButler)',
    },
  };

  try {
    const response = await fetchWithRetry(FPL_API_URL, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch FPL data after multiple retries. Status: ${response.status}, Body: ${errorText}`);
      return res.status(response.status).json({ error: `Failed to fetch data from FPL API. Status: ${response.status}` });
    }

    const data = await response.json();

    // Update cache
    cache = {
      data,
      timestamp: Date.now(),
    };

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('An unhandled error occurred while fetching FPL data:', error);
    return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
  }
}
