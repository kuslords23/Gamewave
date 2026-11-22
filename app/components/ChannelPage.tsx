'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Radio, Users, Lock, Send, Plus, LoaderCircle, Link2, ShieldCheck } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { supabase } from '../lib/supabase';

type Channel = { id: string; owner_id: string; name: string; description: string; privacy: 'public' | 'private'; invite_code?: string; avatar_url?: string | null };
type ChannelPost = { id: string; user_id: string; user_name: string; user_avatar: string | null; title: string | null; content: string | null; post_type: string; media_url: string | null; created_at: string; likes: number; comments_count: number };
type OwnPost = { id: string; title: string | null; content: string | null; created_at: string };

export default function ChannelPage() {
  const params = useParams<{ channelId: string }>();
  const router = useRouter();
  const channelId = params.channelId;
  const [viewer, setViewer] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [role, setRole] = useState('member');
  const [memberCount, setMemberCount] = useState(0);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [ownPosts, setOwnPosts] = useState<OwnPost[]>([]);
  const [selectedPost, setSelectedPost] = useState('');
  const [draft, setDraft] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !channelId) { setLoading(false); return; }
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const current = session.data.session?.user.id || null;
      setViewer(current);
      const channelResult = await supabase.from('scn_post_channels').select('id,owner_id,name,description,privacy,invite_code,avatar_url').eq('id', channelId).maybeSingle();
      if (channelResult.error || !channelResult.data) {
        setChannel(null); setIsMember(false); setPosts([]); setLoading(false); return;
      }
      const currentChannel = channelResult.data as Channel;
      setChannel(currentChannel);
      const membership = current
        ? await supabase.from('scn_post_channel_members').select('role').eq('channel_id', channelId).eq('user_id', current).maybeSingle()
        : { data: null };
      const member = Boolean(membership.data);
      setIsMember(member);
      setRole(String(membership.data?.role || 'member'));
      if (!member) {
        setPosts([]); setOwnPosts([]);
      } else {
        const [postLinks, count, own] = await Promise.all([
          supabase.from('scn_post_channel_posts').select('post_id').eq('channel_id', channelId).order('created_at', { ascending: false }).limit(80),
          supabase.from('scn_post_channel_members').select('user_id', { count: 'exact', head: true }).eq('channel_id', channelId),
          supabase.from('feed_posts').select('id,title,content,created_at').eq('user_id', current).order('created_at', { ascending: false }).limit(40),
        ]);
        setMemberCount(count.count || 0);
        setOwnPosts((own.data || []) as OwnPost[]);
        const ids = (postLinks.data || []).map(row => String(row.post_id));
        if (ids.length) {
          const result = await supabase.from('feed_posts').select('id,user_id,user_name,user_avatar,title,content,post_type,media_url,created_at,likes,comments_count').in('id', ids);
          const byId = new Map(((result.data || []) as ChannelPost[]).map(post => [post.id, post]));
          setPosts(ids.map(id => byId.get(id)).filter(Boolean) as ChannelPost[]);
        } else setPosts([]);
      }
      if (!member && currentChannel.privacy === 'public') {
        const count = await supabase.from('scn_post_channel_members').select('user_id', { count: 'exact', head: true }).eq('channel_id', channelId);
        setMemberCount(count.count || 0);
      }
    } catch (error) {
      console.error('Channel load failed:', error);
      toast.error('Could not load this channel.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => { void load(); }, [load]);

  const join = async (code?: string) => {
    if (!supabase || !viewer) { toast.error('Sign in to join this channel.'); return; }
    setBusy(true);
    const result = await supabase.rpc('join_scn_post_channel', { p_channel_id: channelId, p_invite_code: code || null });
    if (result.error) toast.error(result.error.message);
    else { toast.success('You joined the channel.'); setInviteCode(''); await load(); }
    setBusy(false);
  };

  const publish = async () => {
    if (!supabase || !viewer || !draft.trim()) return;
    setBusy(true);
    const result = await supabase.rpc('create_scn_post_channel_text_post', { p_channel_id: channelId, p_content: draft.trim() });
    if (result.error) toast.error(result.error.message);
    else { setDraft(''); toast.success('Published to the channel and added to the main feed.'); await load(); }
    setBusy(false);
  };

  const shareExistingPost = async () => {
    if (!supabase || !viewer || !selectedPost) return;
    setBusy(true);
    const result = await supabase.from('scn_post_channel_posts').insert({ channel_id: channelId, post_id: selectedPost, added_by: viewer });
    if (result.error) toast.error(result.error.message);
    else { setSelectedPost(''); toast.success('Post shared to this channel.'); await load(); }
    setBusy(false);
  };

  const isOwner = Boolean(viewer && channel && viewer === channel.owner_id);

  return <main className="scn-channel-page">
    <Toaster richColors position="top-center"/>
    <header><button onClick={() => router.back()}><ArrowLeft size={17}/> Back</button><b>KUS POST CHANNEL</b><Link href="/">Feed</Link></header>
    <section className="scn-channel-content">
      {loading ? <div className="scn-channel-state"><LoaderCircle className="scn-channel-spin"/> Loading channel…</div>
        : !channel ? <div className="scn-channel-state"><Radio size={30}/><b>Channel unavailable</b><p>This channel may be private, or the link may be invalid.</p>{viewer && <form onSubmit={e => { e.preventDefault(); void join(inviteCode); }}><input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Private channel invite code"/><button disabled={!inviteCode.trim() || busy}>Join with code</button></form>}</div>
        : <>
          <div className="scn-channel-hero"><span className="scn-channel-icon"><Radio size={26}/></span><div className="scn-channel-heading"><span>{channel.privacy === 'private' ? <><Lock size={12}/> PRIVATE CHANNEL</> : 'PUBLIC CHANNEL'}</span><h1>{channel.name}</h1><p>{channel.description || 'A channel on KUS Post.'}</p><small><Users size={13}/> {memberCount} members · {isOwner ? 'You own this channel' : isMember ? role : 'Open publishing space'}</small></div></div>
          {isOwner && channel.privacy === 'private' && channel.invite_code && <div className="scn-channel-invite"><span>Private invite code: <b>{channel.invite_code}</b></span><button onClick={() => { void navigator.clipboard.writeText(channel.invite_code || ''); toast.success('Invite code copied.'); }}>Copy code</button></div>}
          {!isMember ? <div className="scn-channel-join"><div><b>Join this channel</b><p>{channel.privacy === 'private' ? 'Enter the invitation code shared by the channel owner.' : 'Join to read the channel timeline and publish posts.'}</p></div>{channel.privacy === 'public' ? <button onClick={() => void join()} disabled={busy}>Join channel</button> : <form onSubmit={e => { e.preventDefault(); void join(inviteCode); }}><input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Invite code"/><button disabled={busy || !inviteCode.trim()}>Join</button></form>}</div>
            : <>
              <div className="scn-channel-publish"><div><span>CHANNEL POST</span><h2>Share something with your members</h2></div><textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} maxLength={10000} placeholder="Write an update, question or announcement…"/><div className="scn-channel-publish-footer"><small>{draft.length}/10000 · New posts also appear in the main feed.</small><button onClick={() => void publish()} disabled={busy || !draft.trim()}><Send size={15}/> Publish</button></div></div>
              <div className="scn-channel-share-existing"><label><span><Link2 size={14}/> Share one of your existing posts</span><select value={selectedPost} onChange={e => setSelectedPost(e.target.value)}><option value="">Choose a post…</option>{ownPosts.map(post => <option key={post.id} value={post.id}>{(post.title || post.content || 'Untitled post').slice(0,90)}</option>)}</select></label><button onClick={() => void shareExistingPost()} disabled={busy || !selectedPost}><Plus size={14}/> Add to channel</button></div>
              <div className="scn-channel-feed-heading"><div><span>CHANNEL TIMELINE</span><h2>Latest posts</h2></div>{isOwner && <span className="scn-channel-owner"><ShieldCheck size={13}/> Owner</span>}</div>
              {posts.length === 0 ? <div className="scn-channel-state">No posts here yet. Publish the first update.</div> : <div className="scn-channel-posts">{posts.map(post => <article key={post.id}><Link className="scn-channel-author" href={'/member/' + post.user_id}><span>{post.user_avatar || post.user_name.slice(0,1)}</span><b>{post.user_name}</b><small>{new Date(post.created_at).toLocaleString()}</small></Link>{post.title && <h3>{post.title}</h3>}{post.content && <p>{post.content}</p>}{post.media_url && (post.post_type === 'video' ? <video src={post.media_url} controls playsInline/> : post.post_type === 'image' ? <img src={post.media_url} alt="Post media"/> : null)}<footer><span>{post.likes || 0} likes · {post.comments_count || 0} comments</span><Link href={'/post/' + post.id}>Open post ↗</Link></footer></article>)}</div>}
            </>}
        </>}
    </section>
    <style jsx>{`
      .scn-channel-page{min-height:100vh;background:var(--gw-bg,#0c0c12);color:var(--gw-text,#f5f5f7);padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}
      header{height:62px;display:flex;align-items:center;gap:14px;padding:0 max(14px,calc((100vw - 960px)/2));border-bottom:1px solid var(--gw-line,rgba(255,255,255,.1));position:sticky;top:0;background:var(--gw-glass,rgba(12,12,18,.92));backdrop-filter:blur(18px);z-index:10}header>b{flex:1;font-size:11px;letter-spacing:.17em}header button,header a{display:flex;align-items:center;gap:7px;border:1px solid var(--gw-line,rgba(255,255,255,.12));border-radius:10px;background:var(--gw-soft,rgba(255,255,255,.05));color:inherit;padding:9px 11px;text-decoration:none;font-size:12px}
      .scn-channel-content{max-width:960px;margin:26px auto;padding:0 16px}.scn-channel-hero{display:flex;align-items:center;gap:17px;padding:25px;border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:20px;background:linear-gradient(120deg,rgba(144,38,78,.2),var(--gw-surface,rgba(24,24,34,.88)))}.scn-channel-icon{width:62px;height:62px;display:grid;place-items:center;border-radius:18px;background:#8f2d53;color:#fff}.scn-channel-heading>span{display:flex;align-items:center;gap:5px;color:#e5c66e;font-size:9px;font-weight:900;letter-spacing:.17em}.scn-channel-heading h1{font-size:clamp(24px,4vw,34px);margin:7px 0}.scn-channel-heading p{color:var(--gw-muted,#aaaab7);font-size:13px;line-height:1.5}.scn-channel-heading small{display:flex;align-items:center;gap:6px;color:var(--gw-muted,#aaaab7);font-size:11px;margin-top:9px}
      .scn-channel-invite{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;padding:12px 15px;border:1px dashed var(--gw-line,rgba(255,255,255,.18));border-radius:12px;color:var(--gw-muted,#aaaab7);font-size:11px}.scn-channel-invite b{color:var(--gw-text,#fff);letter-spacing:.12em}.scn-channel-invite button{border:0;border-radius:8px;background:#8d294d;color:#fff;padding:8px 11px;font-size:11px;font-weight:800}.scn-channel-join{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:15px;padding:17px;border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:15px;background:var(--gw-surface,rgba(24,24,34,.88))}.scn-channel-join b{font-size:14px}.scn-channel-join p{font-size:12px;color:var(--gw-muted,#aaaab7);margin-top:5px}.scn-channel-join form{display:flex;gap:8px}.scn-channel-join input,.scn-channel-join button,.scn-channel-join>button{padding:10px 12px;border-radius:9px;border:1px solid var(--gw-line,rgba(255,255,255,.13));background:var(--gw-soft,rgba(255,255,255,.05));color:inherit;font-size:12px}.scn-channel-join button{background:#9e3158;border:0;color:white;font-weight:800}
      .scn-channel-publish{margin-top:16px;padding:19px;border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:17px;background:var(--gw-surface,rgba(24,24,34,.88))}.scn-channel-publish span,.scn-channel-feed-heading span{font-size:9px;font-weight:900;letter-spacing:.18em;color:#e5c66e}.scn-channel-publish h2,.scn-channel-feed-heading h2{font-size:20px;margin:5px 0 13px}.scn-channel-publish textarea,.scn-channel-share-existing select{width:100%;border:1px solid var(--gw-line,rgba(255,255,255,.13));border-radius:11px;background:var(--gw-soft,rgba(255,255,255,.05));color:var(--gw-text,#fff);padding:12px;font:inherit;font-size:13px;resize:vertical}.scn-channel-publish-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px}.scn-channel-publish-footer small{color:var(--gw-muted,#aaaab7);font-size:10px}.scn-channel-publish-footer button,.scn-channel-share-existing>button{display:flex;align-items:center;gap:7px;border:0;border-radius:10px;background:#9e3158;color:white;padding:10px 13px;font-size:12px;font-weight:800}
      .scn-channel-share-existing{display:flex;align-items:end;gap:9px;flex-wrap:wrap;margin-top:12px;padding:14px;border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:14px}.scn-channel-share-existing label{display:grid;gap:7px;flex:1;min-width:200px}.scn-channel-share-existing label span{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--gw-muted,#aaaab7)}.scn-channel-share-existing select{padding:9px}
      .scn-channel-feed-heading{display:flex;align-items:end;justify-content:space-between;margin:27px 2px 13px}.scn-channel-owner{display:flex;align-items:center;gap:5px;color:#e5c66e;font-size:11px}.scn-channel-posts{display:grid;gap:12px}.scn-channel-posts article{padding:17px;border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:15px;background:var(--gw-surface,rgba(24,24,34,.88))}.scn-channel-author{display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none}.scn-channel-author>span{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#4b3143;color:#e5c66e;overflow:hidden}.scn-channel-author b{font-size:12px}.scn-channel-author small{margin-left:auto;color:var(--gw-muted,#aaaab7);font-size:10px}.scn-channel-posts h3{font-size:17px;margin:13px 0 7px}.scn-channel-posts p{font-size:13px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.scn-channel-posts article>img,.scn-channel-posts article>video{width:100%;max-height:500px;object-fit:contain;border-radius:12px;margin-top:10px}.scn-channel-posts footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:13px;padding-top:11px;border-top:1px solid var(--gw-line,rgba(255,255,255,.08));font-size:10px;color:var(--gw-muted,#aaaab7)}.scn-channel-posts footer a{color:#e5c66e;text-decoration:none}
      .scn-channel-state{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:var(--gw-muted,#aaaab7);text-align:center}.scn-channel-state b{color:var(--gw-text,#fff)}.scn-channel-state p{font-size:12px}.scn-channel-state form{display:flex;gap:8px}.scn-channel-state input,.scn-channel-state button{padding:10px;border:1px solid var(--gw-line,rgba(255,255,255,.12));border-radius:9px;background:var(--gw-soft,rgba(255,255,255,.05));color:inherit}.scn-channel-state button{background:#9e3158;color:#fff}.scn-channel-spin{animation:scn-channel-spin 1s linear infinite}@keyframes scn-channel-spin{to{transform:rotate(360deg)}}
      button:disabled{opacity:.5;cursor:not-allowed}@media(max-width:600px){.scn-channel-content{padding:0 11px;margin:14px auto}.scn-channel-hero{align-items:flex-start;padding:17px;gap:12px}.scn-channel-icon{width:48px;height:48px;border-radius:14px}.scn-channel-join{align-items:stretch}.scn-channel-join form{width:100%}.scn-channel-join input{flex:1;min-width:0}.scn-channel-author small{font-size:9px}.scn-channel-publish{padding:14px}}
    `}</style>
  </main>;
}
