export const config = {
  runtime: 'edge'
};

export default async function handler(_req: Request): Promise<Response> {
  return new Response(
    JSON.stringify({ ok: true, service: 'health', time: new Date().toISOString() }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}


