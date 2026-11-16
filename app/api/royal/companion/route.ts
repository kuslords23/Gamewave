import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 1_000_000;
const HISTORY_LIMIT = 12;

export async function POST(request: NextRequest) {
  const auth = request.headers.get('x-supabase-auth') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!auth) return NextResponse.json({ error: 'Sign in to speak with Royal.' }, { status: 401 });

  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 });
  if (prompt.length > 30_000) return NextResponse.json({ error: 'Prompt is too large.' }, { status: 413 });

  const history = Array.isArray(body?.history) ? body.history.slice(-HISTORY_LIMIT).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { role?: unknown; content?: unknown };
    if ((row.role !== 'user' && row.role !== 'assistant') || typeof row.content !== 'string') return [];
    return [{ role: row.role, content: row.content.slice(0, 12_000) }];
  }) : [];

  const origin = (process.env.KUS_AI_ORIGIN || 'https://kus-ai-app.vercel.app').replace(/\/$/, '');
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId.slice(0, 120) : 'scn-post';
  const requested = body?.royalPreferences && typeof body.royalPreferences === 'object' ? body.royalPreferences as Record<string, unknown> : {};
  const royalPreferences = {
    activityInsights: requested.activityInsights === true,
    contentInteractions: requested.contentInteractions === true,
    discoveryActivity: requested.discoveryActivity === true,
    creatorActivity: requested.creatorActivity === true,
    allowDrafts: requested.allowDrafts !== false,
    allowContentManagement: requested.allowContentManagement === true,
  };

  const forwarded = {
    companionId: 'hub',
    conversationId,
    prompt: [
      'The user is inside SCN Post, the dedicated social companion in the Sport-Clan-Nexus ecosystem.',
      'Help with social publishing, community discovery, creator workflows, profiles, short-form video, conversations and understanding SCN activity.',
      'SCN Post shares the Hub identity, feed, social graph and KUS Core memory. Do not invent app records, audience metrics, content, or completed actions.',
      'Publishing, account changes and other consequential actions must use the existing app workflow and Guardian authorization where applicable.',
      'The following Gamewave Royal preferences are user-selected context permissions, not independent authorization to execute actions: ' + JSON.stringify(royalPreferences) + '.',
      'Only use Gamewave activity signals explicitly supplied by the app and covered by enabled permissions. Do not infer or claim access to unprovided activity. Never inspect or request private message contents, credentials, payment details or sensitive account data.',
      'User request: ' + prompt,
    ].join('\n'),
    history,
    mode: 'royal',
    royalPreferences,
  };

  try {
    const upstream = await fetch(origin + '/api/royal/companion', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-supabase-auth': auth,
        accept: request.headers.get('accept') || 'text/event-stream, application/json',
      },
      body: JSON.stringify(forwarded),
      cache: 'no-store',
      signal: request.signal,
    });
    const headers = new Headers();
    for (const name of ['content-type', 'cache-control', 'connection', 'x-royal-companion']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('cache-control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ error: 'The shared Royal gateway is temporarily unavailable.' }, { status: 502 });
  }
}
