export const config = {
  runtime: 'edge'
};

export default async function handler(): Promise<Response> {
  return new Response(
    JSON.stringify({ ok: true, routes: ['/api/index', '/api/health', '/api/ai-summary'] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}


