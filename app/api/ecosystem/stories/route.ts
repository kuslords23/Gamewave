import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Story = { id: string; title: string; imageUrl: string; url: string; source: string; creator?: string };

export async function GET() {
  const endpoint = process.env.KUS_ECOSYSTEM_STORIES_URL;
  const key = process.env.KUS_ECOSYSTEM_API_KEY;
  if (!endpoint) return NextResponse.json({ stories: [], connected: false, reason: 'Ecosystem story API is not configured.' });
  try {
    const target = new URL(endpoint);
    if (target.protocol !== 'https:') throw new Error('The ecosystem story endpoint must use HTTPS.');
    const response = await fetch(target, {
      headers: { Accept: 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!response.ok) return NextResponse.json({ stories: [], connected: false }, { status: 200 });
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload.stories) ? payload.stories : [];
    const safe: Story[] = rows.slice(0, 40).map((row: any, index: number) => ({
      id: String(row.id || row.story_id || index),
      title: String(row.title || row.caption || 'Ecosystem story').slice(0, 180),
      imageUrl: String(row.imageUrl || row.image_url || row.media_url || ''),
      url: String(row.url || row.deep_link || ''),
      source: String(row.source || row.app_name || 'KUS ecosystem').slice(0, 60),
      creator: row.creator ? String(row.creator).slice(0, 80) : undefined,
    })).filter((story: Story) => /^https:\/\//i.test(story.imageUrl) && /^https:\/\//i.test(story.url));
    return NextResponse.json({ stories: safe, connected: true });
  } catch {
    return NextResponse.json({ stories: [], connected: false });
  }
}
