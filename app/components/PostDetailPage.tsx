'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, MessageCircle, Share2, Send, LoaderCircle } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { supabase } from '../lib/supabase';
import FeedPostText from './feed/FeedPostText';
import QuotedPostPreview from './QuotedPostPreview';
import type { ScnPost, ScnComment } from '../lib/feedTypes';

type ThreadComment = ScnComment & { replies: ThreadComment[] };
function buildCommentTree(items: ScnComment[]): ThreadComment[] {
  const map = new Map<string, ThreadComment>();
  const roots: ThreadComment[] = [];
  items.forEach(comment => map.set(comment.id, { ...comment, replies: [] }));
  map.forEach(comment => {
    if (comment.parent_id && map.has(comment.parent_id)) map.get(comment.parent_id)!.replies.push(comment);
    else roots.push(comment);
  });
  return roots;
}

const POST_COLUMNS = 'id,post_type,user_id,user_name,user_avatar,title,description,content,hashtags,media_url,media_mime,link_url,link_platform,cover_url,likes,comments_count,reposts,created_at,sound_title,sound_artist,quoted_post_id';

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return <span className="post-avatar">{src && (/^https?:|^\//.test(src)) ? <img src={src} alt="" /> : src || name.slice(0, 1).toUpperCase()}</span>;
}

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params?.id;
  const [post, setPost] = useState<ScnPost | null>(null);
  const [comments, setComments] = useState<ScnComment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('SCN member');
  const [userAvatar, setUserAvatar] = useState('👑');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ScnComment | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<ScnPost[]>([]);
  const [quotePosts, setQuotePosts] = useState<ScnPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadPost = useCallback(async () => {
    if (!supabase || !postId) {
      setError('Post service is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = await supabase.from('feed_posts').select(POST_COLUMNS).eq('id', postId).maybeSingle();
    if (fetchError) setError(fetchError.message);
    else if (!data) setError('This post may have been deleted or is not available to your account.');
    else { setPost(data as ScnPost); setError(''); }
    setLoading(false);
  }, [postId]);

  const loadComments = useCallback(async () => {
    if (!supabase || !postId) { setCommentsLoading(false); return; }
    setCommentsLoading(true);
    const { data, error: fetchError } = await supabase.from('feed_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true }).limit(300);
    if (fetchError) toast.error('Could not load the discussion: ' + fetchError.message);
    else setComments((data || []) as ScnComment[]);
    setCommentsLoading(false);
  }, [postId]);

  useEffect(() => {
    if (!supabase) { setLoading(false); setCommentsLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u) {
        setUserId(u.id);
        setUserName(String(u.user_metadata?.name || u.email?.split('@')[0] || 'SCN member'));
        setUserAvatar(String(u.user_metadata?.avatar || '👑'));
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUserId(u?.id || null);
      setUserName(String(u?.user_metadata?.name || u?.email?.split('@')[0] || 'SCN member'));
      setUserAvatar(String(u?.user_metadata?.avatar || '👑'));
    });
    void loadPost();
    void loadComments();
    return () => listener.subscription.unsubscribe();
  }, [loadPost, loadComments]);

  useEffect(() => {
    if (!supabase || !post?.hashtags?.length) { setRelatedPosts([]); return; }
    let live = true;
    supabase.from('feed_posts').select(POST_COLUMNS).overlaps('hashtags', post.hashtags).neq('id', post.id).order('created_at', { ascending: false }).limit(4)
      .then(({ data }) => { if (live) setRelatedPosts((data || []) as ScnPost[]); });
    return () => { live = false; };
  }, [post]);

  useEffect(() => {
    if (!supabase || !post?.id) { setQuotePosts([]); return; }
    let live = true;
    supabase.from('feed_posts').select(POST_COLUMNS).eq('quoted_post_id', post.id).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => { if (live) setQuotePosts((data || []) as ScnPost[]); });
    return () => { live = false; };
  }, [post?.id]);

  useEffect(() => {
    if (!supabase || !postId) return;
    const channel = supabase.channel('scn-post-detail-' + postId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments', filter: 'post_id=eq.' + postId }, () => void loadComments())
      .subscribe();
    return () => { if (supabase) void supabase.removeChannel(channel); };
  }, [postId, loadComments]);

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !userId || !post || !draft.trim()) {
      if (!userId) toast.error('Sign in to join the discussion.');
      return;
    }
    setSending(true);
    const { error: insertError } = await supabase.from('feed_comments').insert({
      post_id: post.id, user_id: userId, user_name: userName, user_avatar: userAvatar, body: draft.trim(), parent_id: replyTo?.id || null,
    });
    if (insertError) toast.error(insertError.message);
    else { setDraft(''); setReplyTo(null); }
    setSending(false);
  };

  const sharePost = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: post?.title || 'Post on KUS Post', text: post?.content || 'Join this conversation', url });
      else { await navigator.clipboard.writeText(url); toast.success('Post link copied'); }
    } catch (shareError) {
      if (!(shareError instanceof Error && shareError.name === 'AbortError')) toast.error('Could not share this post.');
    }
  };

  const renderComment = (comment: ThreadComment, depth = 0): JSX.Element => <article className="post-comment" key={comment.id} style={{ marginLeft: Math.min(depth, 3) * 14 }}>
    <Avatar name={comment.user_name} src={comment.user_avatar}/>
    <div className="post-comment-content"><b>{comment.user_name}</b><small>{new Date(comment.created_at).toLocaleString()}</small><p>{comment.body}</p>
      <button className="post-comment-reply" type="button" onClick={() => setReplyTo(comment)}>Reply</button>
      {comment.replies.length > 0 && <div className="post-comment-replies">{comment.replies.map(child => renderComment(child, depth + 1))}</div>}
    </div>
  </article>;

  const mediaKind = post?.post_type === 'video' || post?.media_mime?.startsWith('video/') ? 'video'
    : post?.post_type === 'audio' || post?.media_mime?.startsWith('audio/') ? 'audio'
    : post?.media_url ? 'image' : 'none';

  return <main className="post-detail-shell">
    <header className="post-detail-top"><button type="button" onClick={() => router.back()} aria-label="Go back"><ArrowLeft size={19} /></button><div><b>KUS POST</b><small>THE CONVERSATION</small></div><button type="button" onClick={() => router.push('/')} aria-label="Go to feed">Feed <ArrowUpRight size={15}/></button></header>
    <div className="post-detail-layout">
      <section className="post-detail-main">
        {loading ? <div className="post-detail-state"><LoaderCircle className="spin" /> Loading post…</div>
          : error ? <div className="post-detail-state"><b>Post unavailable</b><p>{error}</p><button onClick={() => router.push('/')}>Return to feed</button></div>
          : post && <>
            <article className="post-detail-card">
              <div className="post-detail-author"><Avatar name={post.user_name} src={post.user_avatar}/><div><b><a href={'/member/'+post.user_id}>{post.user_name}</a></b><small>{new Date(post.created_at).toLocaleString()} · {post.post_type.replace('_', ' ')}</small></div></div>
              {post.title && <h1>{post.title}</h1>}
              {post.content && <div className="post-detail-copy"><FeedPostText text={post.content}/></div>}{post.quoted_post_id && <QuotedPostPreview postId={post.quoted_post_id}/>}
              {mediaKind === 'image' && post.media_url && <img className="post-detail-media" src={post.media_url} alt={post.content || 'Post image'}/>}
              {mediaKind === 'video' && post.media_url && <video className="post-detail-media" src={post.media_url} poster={post.cover_url || undefined} controls playsInline preload="metadata"/>}
              {mediaKind === 'audio' && post.media_url && <div className="post-detail-audio"><b>{post.sound_title || post.title || 'Audio post'}</b><small>{post.sound_artist || post.user_name}</small><audio src={post.media_url} controls/></div>}
              {post.link_url && <a className="post-detail-link" href={post.link_url} target="_blank" rel="noreferrer">{post.link_platform || 'Open link'} <ArrowUpRight size={16}/></a>}
              {!!post.hashtags?.length && <div className="post-detail-tags">{post.hashtags.map(tag => <span key={tag}>#{tag}</span>)}</div>}
              <div className="post-detail-stats"><span><Heart size={16}/> {post.likes} likes</span><span><MessageCircle size={16}/> {post.comments_count} comments</span><span>{post.reposts} reposts</span></div>
              <div className="post-detail-actions"><span><MessageCircle size={17}/> Discussion</span><button onClick={() => void sharePost()}><Share2 size={17}/> Share post</button></div>
            </article>
            <section className="post-discussion">
              <div className="post-discussion-heading"><div><span>OPEN CONVERSATION</span><h2>Discussion</h2></div><small>{comments.length} comments</small></div>
              {replyTo && <div className="post-replying-to"><span>Replying to <b>{replyTo.user_name}</b></span><button type="button" onClick={() => setReplyTo(null)}>Cancel</button></div>}
              <form className="post-comment-form" onSubmit={submitComment}><Avatar name={userName} src={userAvatar}/><input value={draft} onChange={event => setDraft(event.target.value)} placeholder={userId ? (replyTo ? 'Write a reply…' : 'Add something thoughtful…') : 'Sign in to comment'} disabled={!userId || sending}/><button disabled={!userId || !draft.trim() || sending} aria-label="Send comment"><Send size={17}/></button></form>
              {commentsLoading ? <p className="post-detail-muted">Loading discussion…</p>
                : comments.length === 0 ? <div className="post-discussion-empty"><MessageCircle size={24}/><b>Start the conversation</b><p>Be the first to respond to this post.</p></div>
                : <div className="post-comment-list">{buildCommentTree(comments).map(comment => renderComment(comment))}</div>}
            </section>
            {relatedPosts.length > 0 && <section className="post-related-discussions"><div><span>KEEP EXPLORING</span><h2>Related conversations</h2></div>{relatedPosts.map(item => <a key={item.id} href={'/post/' + item.id}><b>{item.user_name}</b><p>{item.title || item.content || 'Open this conversation'}</p><small>{item.comments_count} comments · {item.likes} likes</small></a>)}</section>}
            {quotePosts.length > 0 && <section className="post-related-discussions"><div><span>POST CONTEXT</span><h2>Posts quoting this</h2></div>{quotePosts.map(item => <a key={item.id} href={'/post/' + item.id}><b>{item.user_name}</b><p>{item.content || 'Open this quote repost'}</p><small>{new Date(item.created_at).toLocaleDateString()} · {item.comments_count} comments</small></a>)}</section>}
          </>}
      </section>
      <aside className="post-detail-aside"><span>ONE POST. ONE PLACE.</span><h2>Good conversations deserve room.</h2><p>Share this page to bring people directly to the original post and its discussion.</p><button onClick={() => void sharePost()} disabled={!post}><Share2 size={16}/> Share this post</button></aside>
    </div>
    <style jsx>{`
      .post-detail-shell{min-height:100vh;background:radial-gradient(ellipse at 12% 0%,rgba(250,45,108,.10),transparent 34%),radial-gradient(ellipse at 88% 8%,rgba(212,175,55,.10),transparent 32%),var(--gw-bg,#0c0c12);color:var(--gw-text,#f5f5f7);padding-bottom:50px}
      .post-detail-top{height:72px;display:flex;align-items:center;gap:16px;padding:0 max(20px,calc((100vw - 1120px)/2));border-bottom:1px solid rgba(255,255,255,.08);background:rgba(12,12,18,.82);position:sticky;top:0;z-index:5;backdrop-filter:blur(18px)}
      .post-detail-top button{display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(255,255,255,.04);color:inherit;padding:9px 12px;font-size:12px}
      .post-detail-top div{flex:1}.post-detail-top b,.post-detail-top small{display:block}.post-detail-top b{font-size:12px;letter-spacing:.16em}.post-detail-top small{font-size:9px;letter-spacing:.18em;color:#b5a1aa;margin-top:4px}
      .post-detail-layout{max-width:1120px;margin:34px auto;padding:0 20px;display:grid;grid-template-columns:minmax(0,720px) minmax(220px,1fr);gap:24px;align-items:start}
      .post-detail-card,.post-discussion,.post-detail-aside{border:1px solid rgba(255,255,255,.09);border-radius:22px;background:rgba(24,24,34,.88);box-shadow:0 20px 60px rgba(0,0,0,.16)}
      .post-detail-card{padding:24px}.post-detail-author{display:flex;align-items:center;gap:12px;margin-bottom:24px}.post-avatar{width:44px;height:44px;border-radius:50%;overflow:hidden;display:grid;place-items:center;flex:none;background:#342c3c;border:1px solid rgba(212,175,55,.35);color:#f4d88a;font-weight:800}.post-avatar img{width:100%;height:100%;object-fit:cover}.post-detail-author b,.post-detail-author small{display:block}.post-detail-author b{font-size:14px}.post-detail-author small{font-size:11px;color:#9999a9;margin-top:4px}
      .post-detail-card h1{font-size:clamp(24px,4vw,34px);line-height:1.15;letter-spacing:-.04em;margin:0 0 16px}.post-detail-copy{font-size:15px;line-height:1.75;overflow-wrap:anywhere}.post-detail-media{display:block;width:100%;max-height:680px;object-fit:contain;border-radius:16px;margin-top:20px;background:#08080d}.post-detail-audio{display:grid;gap:8px;padding:18px;margin-top:18px;background:rgba(255,255,255,.04);border-radius:15px}.post-detail-audio small{color:#a4a4b2}.post-detail-audio audio{width:100%}.post-detail-link{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding:14px;border-radius:13px;background:rgba(255,255,255,.05);color:#f1d88c;text-decoration:none;overflow-wrap:anywhere}.post-detail-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;color:#f28bab;font-size:12px}.post-detail-stats{display:flex;gap:18px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.08);padding:17px 0;color:#a9a9b6;font-size:12px}.post-detail-stats span{display:flex;align-items:center;gap:6px}.post-detail-actions{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,.08);padding-top:14px;color:#c5c5d0;font-size:12px}.post-detail-actions span,.post-detail-actions button{display:flex;align-items:center;gap:8px}.post-detail-actions button,.post-detail-aside button{border:0;border-radius:11px;padding:10px 14px;background:linear-gradient(120deg,#fa2d6c,#d83b86);color:white;font-weight:750;font-size:12px}
      .post-discussion{margin-top:18px;padding:22px}.post-discussion-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.post-discussion-heading span,.post-detail-aside>span{font-size:9px;font-weight:900;letter-spacing:.2em;color:#e8c66c}.post-discussion-heading h2{font-size:23px;margin-top:5px}.post-discussion-heading small{font-size:11px;color:#a5a5b2}.post-comment-form{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(255,255,255,.035)}.post-comment-form input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:inherit;font-size:13px}.post-comment-form button{width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:10px;background:#fa2d6c;color:white}.post-comment-form button:disabled{opacity:.4}.post-comment-list{display:grid;gap:18px;margin-top:22px}.post-comment{display:flex;gap:11px}.post-comment>div{flex:1;min-width:0}.post-comment b,.post-comment small{display:block}.post-comment b{font-size:12px}.post-comment small{font-size:10px;color:#9292a2;margin-top:3px}.post-comment p{font-size:13px;line-height:1.6;margin-top:7px;overflow-wrap:anywhere}.post-comment-content{flex:1;min-width:0}.post-comment-reply{margin-top:7px;border:0;background:transparent;color:#f1d88c;font-size:10px;font-weight:800;padding:3px 0}.post-comment-replies{display:grid;gap:14px;margin-top:12px;padding-left:12px;border-left:1px solid rgba(212,175,55,.2)}.post-replying-to{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;margin-bottom:8px;border-radius:10px;background:rgba(212,175,55,.08);font-size:11px;color:#d7c6a0}.post-replying-to button{border:0;background:transparent;color:#f1d88c;font-size:10px}.post-related-discussions{display:grid;gap:10px;margin-top:18px;padding:20px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(24,24,34,.72)}.post-related-discussions>div>span{font-size:9px;font-weight:900;letter-spacing:.2em;color:#e8c66c}.post-related-discussions h2{font-size:20px;margin-top:5px}.post-related-discussions>a{display:block;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;color:inherit;text-decoration:none;background:rgba(255,255,255,.025)}.post-related-discussions>a b{font-size:11px}.post-related-discussions>a p{margin-top:5px;font-size:12px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.post-related-discussions>a small{display:block;margin-top:6px;color:#a5a5b2;font-size:9px}.post-discussion-empty,.post-detail-state{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px;color:#a8a8b6}.post-discussion-empty b,.post-detail-state b{color:#f3f3f5}.post-discussion-empty p,.post-detail-state p{font-size:12px}.post-detail-state button{margin-top:8px;padding:10px 14px;border:0;border-radius:10px;background:#fa2d6c;color:white}.post-detail-muted{font-size:12px;color:#a5a5b2;padding:20px 0}.post-detail-aside{padding:22px;position:sticky;top:94px}.post-detail-aside h2{font-size:22px;line-height:1.2;margin:13px 0}.post-detail-aside p{font-size:12px;line-height:1.7;color:#aaaab7}.post-detail-aside button{display:flex;align-items:center;gap:8px;margin-top:18px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      @media(max-width:760px){.post-detail-layout{grid-template-columns:1fr;margin:18px auto;padding:0 12px}.post-detail-aside{display:none}.post-detail-card,.post-discussion{padding:16px;border-radius:17px}.post-detail-top{height:62px;padding:0 12px}.post-detail-top button{padding:8px}.post-detail-card h1{font-size:25px}.post-detail-media{max-height:70vh}.post-detail-stats{gap:11px;font-size:11px}}
    `}</style>
    <Toaster position="top-center" richColors />
  </main>;
}
