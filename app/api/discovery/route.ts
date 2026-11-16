import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 900;

type FeedKind = 'news' | 'blog';
type FeedItem = { id: string; title: string; url: string; source: string; summary: string; publishedAt?: string; kind: FeedKind };

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ').trim();
}
function tag(xml: string, name: string) {
  const match = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return match?.[1] ? decode(match[1]) : '';
}
function parseFeed(xml: string, kind: FeedKind): FeedItem[] {
  const blocks: string[] = [];
  const itemPattern = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemPattern.exec(xml)) !== null) blocks.push(itemMatch[2]);
  return blocks.map((block, index) => {
    const linkTag = block.match(/<link(?:\s[^>]*?)?\s+href=["']([^"']+)["'][^>]*\/?\s*>/i);
    const url = tag(block, 'link') || linkTag?.[1] || '';
    const title = tag(block, 'title');
    const summary = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content');
    const source = tag(block, 'source') || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return kind === 'blog' ? 'Publisher blog' : 'News'; } })();
    const publishedAt = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated');
    return { id: url || title + index, title, url, source, summary: summary.slice(0, 360), publishedAt, kind };
  }).filter(item => item.title && /^https?:\/\//i.test(item.url));
}
async function readFeed(url: string, kind: FeedKind): Promise<FeedItem[]> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'GamewaveFeed/1.0 (+https://gamewave-nu.vercel.app)' }, signal: AbortSignal.timeout(8000), next: { revalidate: 900 } });
    if (!response.ok) return [];
    return parseFeed(await response.text(), kind);
  } catch { return []; }
}
export async function GET() {
  const googleFeeds = [
    'https://news.google.com/rss/search?q=Ghana+OR+Africa+news&hl=en-GH&gl=GH&ceid=GH:en',
    'https://news.google.com/rss/search?q=world+technology+science+business&hl=en-GH&gl=GH&ceid=GH:en',
  ];
  const blogFeeds = (process.env.GAMEWAVE_BLOG_RSS_URLS || '').split(',').map(x => x.trim()).filter(x => /^https:\/\//i.test(x)).slice(0, 12);
  const [news, blogs] = await Promise.all([
    Promise.all(googleFeeds.map(url => readFeed(url, 'news'))),
    Promise.all(blogFeeds.map(url => readFeed(url, 'blog'))),
  ]);
  const items = [...news.flat(), ...blogs.flat()]
    .filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)
    .sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))
    .slice(0, 40);
  return NextResponse.json({ items, sources: { googleNewsRss: true, blogFeeds: blogFeeds.length }, updatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } });
}
