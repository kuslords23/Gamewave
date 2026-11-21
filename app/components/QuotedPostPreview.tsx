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
  </div>;
}
