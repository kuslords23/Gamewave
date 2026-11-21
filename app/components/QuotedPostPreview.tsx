'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type OriginalPost = { id: string; user_id: string; user_name: string; user_avatar: string | null; title: string | null; content: string | null; post_type: string; media_url: string | null; cover_url: string | null; created_at: string };

export default function QuotedPostPreview({ postId }: { postId: string }) {
  const [post, setPost] = useState<OriginalPost | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    if (!supabase || !postId) { setLoading(false); return; }
    supabase.from('feed_posts').select('id,user_id,user_name,user_avatar,title,content,post_type,media_url,cover_url,created_at').eq('id', postId).maybeSingle()
      .then(({ data }) => { if (live) { setPost(data as OriginalPost | null); setLoading(false); } });
    return () => { live = false; };
  }, [postId]);
  return <div className="quoted-post-preview">
    {loading ? <span className="quoted-post-loading"><LoaderCircle size={14}/> Loading original post…</span>
      : post ? <Link href={'/post/' + post.id} className="quoted-post-link">
        <span className="quoted-post-author">{post.user_avatar || '👑'} <b>{post.user_name}</b></span>
        {post.title && <strong>{post.title}</strong>}
        {post.content && <span className="quoted-post-copy">{post.content}</span>}
        {post.media_url && <span className="quoted-post-media">{post.post_type === 'video' ? '▶ Video' : post.post_type === 'audio' ? '♫ Audio' : '▧ Media attached'}</span>}
        <small>View original post <ArrowUpRight size={12}/></small>
      </Link>
      : <span className="quoted-post-missing">The original post is no longer available.</span>}
  </div>
  <style jsx>{`
    .quoted-post-preview{margin-top:14px;border:1px solid rgba(212,175,55,.25);border-radius:13px;background:rgba(255,255,255,.035);overflow:hidden}
    .quoted-post-link{display:grid;gap:7px;padding:13px;color:inherit;text-decoration:none}
    .quoted-post-author{display:flex;align-items:center;gap:7px;font-size:11px;color:#d8c4a0}
    .quoted-post-copy{font-size:12px;line-height:1.55;color:#c8c8d1;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
    .quoted-post-link small{display:flex;align-items:center;gap:4px;color:#f1d88c;font-size:10px}
    .quoted-post-media{font-size:10px;color:#aaaab7}
    .quoted-post-missing,.quoted-post-loading{display:flex;align-items:center;gap:7px;padding:13px;font-size:11px;color:#aaaab7}
  `}</style>;
}
