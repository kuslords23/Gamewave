'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, LoaderCircle, UserPlus, UserCheck } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { supabase } from '../../lib/supabase';
import QuotedPostPreview from './QuotedPostPreview';

type Member = { id: string; name: string; username: string | null; avatar: string | null; bio: string | null };
type MemberPost = { id: string; user_id: string; user_name: string; user_avatar: string | null; title: string | null; content: string | null; post_type: string; media_url: string | null; cover_url: string | null; link_url: string | null; link_platform: string | null; quoted_post_id: string | null; likes: number; comments_count: number; reposts: number; created_at: string };

function Avatar({ name, src }: { name: string; src: string | null }) {
  return <span className="member-avatar">{src && (/^https?:|^\\//.test(src)) ? <img src={src} alt="" /> : src || name.slice(0, 1).toUpperCase()}</span>;
}

export default function MemberProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const key = decodeURIComponent(params.username || '');
  const [member, setMember] = useState<Member | null>(null);
  const [posts, setPosts] = useState<MemberPost[]>([]);
  const [viewer, setViewer] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const load = useCallback(async () => {
    if (!supabase || !key) { setLoading(false); return; }
    setLoading(true);
    const byId = await supabase.from('scn_post_public_profiles').select('id,name,username,avatar,bio').eq('id', key).maybeSingle();
    const result = byId.data ? byId : await supabase.from('profiles').select('id,name,username,avatar,bio').eq('username', key).maybeSingle();
    if (result.error || !result.data) { setMember(null); setPosts([]); setLoading(false); return; }
    const profile = result.data as Member;
    setMember(profile);
    const [postRows, followerRows, followingRows, session] = await Promise.all([
      supabase.from('feed_posts').select('id,user_id,user_name,user_avatar,title,content,post_type,media_url,cover_url,link_url,link_platform,quoted_post_id,likes,comments_count,reposts,created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(80),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('target_type', 'user').eq('target_id', profile.id),
      supabase.from('follows').select('target_id', { count: 'exact', head: true }).eq('target_type', 'user').eq('follower_id', profile.id),
      supabase.auth.getSession(),
    ]);
    setPosts((postRows.data || []) as MemberPost[]);
    setFollowers(followerRows.count || 0);
    setFollowingCount(followingRows.count || 0);
    const current = session.data.session?.user.id || null;
    setViewer(current);
    if (current && current !== profile.id) {
      const edge = await supabase.from('follows').select('target_id').eq('follower_id', current).eq('target_type', 'user').eq('target_id', profile.id).maybeSingle();
      setFollowing(!!edge.data);
    } else setFollowing(false);
    setLoading(false);
  }, [key]);

  useEffect(() => { void load(); }, [load]);

  const toggleFollow = async () => {
    if (!supabase || !member) return;
    if (!viewer) { toast.error('Sign in to follow members.'); return; }
    if (viewer === member.id) return;
    setBusy(true);
    const result = following
      ? await supabase.from('follows').delete().eq('follower_id', viewer).eq('target_type', 'user').eq('target_id', member.id)
      : await supabase.from('follows').insert({ follower_id: viewer, target_type: 'user', target_id: member.id, target_name: member.name, target_avatar: member.avatar || '👑' });
    if (result.error) toast.error(result.error.message);
    else { setFollowing(!following); setFollowers(value => Math.max(0, value + (following ? -1 : 1))); }
    setBusy(false);
  };

  return <main className="member-page">
    <header className="member-top"><button onClick={() => router.back()}><ArrowLeft size={18}/> Back</button><b>KUS POST</b><Link href="/">Feed <ArrowUpRight size={15}/></Link></header>
    <section className="member-content">
      {loading ? <div className="member-state"><LoaderCircle className="member-spin"/> Loading profile…</div>
        : !member ? <div className="member-state"><b>Member not found</b><p>This profile may be unavailable.</p><Link href="/">Return to feed</Link></div>
        : <>
          <section className="member-hero">
            <Avatar name={member.name || 'SCN member'} src={member.avatar}/>
            <div className="member-identity"><span>MEMBER PROFILE</span><h1>{member.name || 'SCN member'}</h1><p>@{member.username || 'scn-member'}</p><small>{posts.length} posts · {followers} followers · {followingCount} following</small>{member.bio && <p className="member-bio">{member.bio}</p>}</div>
            {viewer !== member.id && <button onClick={() => void toggleFollow()} disabled={busy}>{following ? <UserCheck size={16}/> : <UserPlus size={16}/>} {following ? 'Following' : 'Follow'}</button>}
          </section>
          <div className="member-post-heading"><div><span>PUBLIC ACTIVITY</span><h2>Posts and conversations</h2></div></div>
          {posts.length === 0 ? <div className="member-state">No public posts yet.</div> : <div className="member-post-list">{posts.map(post => <article className="member-post" key={post.id}>
            {post.quoted_post_id && <span className="member-quote-label">QUOTE REPOST</span>}
            <Link className="member-post-author" href={'/member/' + post.user_id}><Avatar name={post.user_name} src={post.user_avatar}/><span><b>{post.user_name}</b><small>{new Date(post.created_at).toLocaleString()}</small></span></Link>
            {post.title && <h3>{post.title}</h3>}{post.content && <p>{post.content}</p>}
            {post.quoted_post_id && <QuotedPostPreview postId={post.quoted_post_id}/>}
            {post.media_url && (post.post_type === 'video' ? <video src={post.media_url} poster={post.cover_url || undefined} controls playsInline/> : post.post_type === 'image' ? <img src={post.media_url} alt="Post media"/> : post.post_type === 'audio' ? <audio src={post.media_url} controls/> : null)}{post.link_url && <a className="member-external-link" href={post.link_url} target="_blank" rel="noreferrer">{post.link_platform || 'Open link'} ↗</a>}
            <div className="member-post-stats"><span>{post.likes} likes</span><span>{post.comments_count} comments</span><span>{post.reposts} reposts</span><Link href={'/post/' + post.id}>Open post <ArrowUpRight size={13}/></Link></div>
          </article>)}</div>}
        </>}
    </section>
    <style jsx>{`
      .member-page{min-height:100vh;background:radial-gradient(ellipse at 12% 0%,rgba(250,45,108,.10),transparent 34%),radial-gradient(ellipse at 88% 8%,rgba(212,175,55,.10),transparent 32%),var(--gw-bg,#0c0c12);color:var(--gw-text,#f5f5f7);padding-bottom:48px}
      .member-top{height:66px;display:flex;align-items:center;gap:16px;padding:0 max(16px,calc((100vw - 980px)/2));border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;background:rgba(12,12,18,.9);backdrop-filter:blur(18px);z-index:4}.member-top b{flex:1;letter-spacing:.16em;font-size:12px}.member-top button,.member-top a{display:flex;align-items:center;gap:7px;color:inherit;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 12px;text-decoration:none;font-size:12px}
      .member-content{max-width:980px;margin:28px auto;padding:0 16px}.member-hero{display:flex;align-items:center;gap:18px;padding:25px;border:1px solid rgba(255,255,255,.1);border-radius:22px;background:rgba(24,24,34,.88)}.member-avatar{width:76px;height:76px;display:grid;place-items:center;overflow:hidden;flex:none;border-radius:50%;background:#342c3c;border:2px solid rgba(212,175,55,.45);color:#f4d88a;font-size:25px;font-weight:800}.member-avatar img{width:100%;height:100%;object-fit:cover}.member-identity{flex:1;min-width:0}.member-identity>span,.member-post-heading span{font-size:9px;font-weight:900;letter-spacing:.2em;color:#e8c66c}.member-identity h1{font-size:clamp(23px,4vw,34px);margin:5px 0}.member-identity p{color:#c28ca4;font-size:13px}.member-identity small{display:block;color:#aaaab7;margin-top:9px;font-size:11px}.member-bio{margin-top:10px;color:#c9c9d3;font-size:13px;line-height:1.6}.member-hero>button{display:flex;align-items:center;gap:8px;padding:11px 15px;border:0;border-radius:11px;background:linear-gradient(120deg,#fa2d6c,#d83b86);color:white;font-weight:750}.member-post-heading{display:flex;align-items:end;justify-content:space-between;margin:28px 3px 15px}.member-post-heading h2{font-size:22px;margin-top:5px}.member-post-list{display:grid;gap:14px}.member-post{padding:21px;border:1px solid rgba(255,255,255,.09);border-radius:19px;background:rgba(24,24,34,.88)}.member-quote-label{font-size:9px;font-weight:900;letter-spacing:.16em;color:#e8c66c}.member-post-author{display:flex;align-items:center;gap:10px;margin-bottom:15px;color:inherit;text-decoration:none}.member-post-author .member-avatar{width:38px;height:38px;font-size:15px}.member-post-author span:last-child{display:grid;gap:3px}.member-post-author b{font-size:12px}.member-post-author small{font-size:10px;color:#9999a9}.member-post h3{font-size:20px;margin:0 0 9px}.member-post>p{font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.member-post>img,.member-post>video{width:100%;max-height:560px;object-fit:contain;border-radius:14px;margin-top:15px;background:#08080d}.member-post>audio{display:block;width:100%;margin-top:15px}.member-external-link{display:block;margin-top:14px;padding:12px;border-radius:10px;background:rgba(255,255,255,.05);color:#f1d88c;text-decoration:none;font-size:12px}.member-post-stats{display:flex;gap:15px;align-items:center;flex-wrap:wrap;margin-top:17px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;color:#aaaab7}.member-post-stats a{display:flex;align-items:center;gap:4px;color:#f1d88c;text-decoration:none;margin-left:auto}.member-state{min-height:220px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;color:#aaaab7;text-align:center}.member-state b{color:#f5f5f7}.member-state a{color:#f1d88c}.member-spin{animation:member-spin 1s linear infinite}@keyframes member-spin{to{transform:rotate(360deg)}}
      @media(max-width:600px){.member-content{margin:16px auto;padding:0 11px}.member-hero{padding:16px;gap:12px;flex-wrap:wrap}.member-avatar{width:60px;height:60px}.member-hero>button{margin-left:auto}.member-post{padding:15px}.member-top{padding:0 11px}}
    `}</style>
    <style jsx global>{`
      .quoted-post-preview{margin-top:14px;border:1px solid rgba(212,175,55,.25);border-radius:13px;background:rgba(255,255,255,.035);overflow:hidden}.quoted-post-link{display:grid;gap:7px;padding:13px;color:inherit;text-decoration:none}.quoted-post-author{display:flex;align-items:center;gap:7px;font-size:11px;color:#d8c4a0}.quoted-post-copy{font-size:12px;line-height:1.55;color:#c8c8d1;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.quoted-post-link small{display:flex;align-items:center;gap:4px;color:#f1d88c;font-size:10px}.quoted-post-media{font-size:10px;color:#aaaab7}.quoted-post-missing,.quoted-post-loading{display:flex;align-items:center;gap:7px;padding:13px;font-size:11px;color:#aaaab7}
    `}</style>
    <Toaster position="top-center" richColors/>
  </main>;
}
