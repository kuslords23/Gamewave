'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bell, BarChart3, Check, Compass, Film, Heart, MessageCircle, Plus, Search, Send, Share2, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ScnPost } from '../lib/feedTypes';
import './ScnPostFeatures.css';

type FeatureTab = 'friends' | 'reels' | 'messages' | 'notifications' | 'profile' | 'creator';
type Profile = { id: string; name: string; username?: string; avatar?: string };
type Person = { id: string; name: string; username: string; avatar: string };
type ChatMessage = { id: string; thread_id: string; sender_id: string | null; sender_name: string; sender_avatar: string | null; content: string | null; created_at: string };
type Notice = { id: string; title: string; body: string | null; category: string | null; read: boolean; created_at: string; metadata?: Record<string, unknown> };

const tabs: { id: FeatureTab; label: string; icon: typeof Users }[] = [
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'reels', label: 'Reels', icon: Film },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile', label: 'My profile', icon: Compass },
  { id: 'creator', label: 'Creator studio', icon: BarChart3 },
];

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return <span className="scnf-avatar">{src && (src.startsWith('http') || src.startsWith('/')) ? <img src={src} alt="" /> : src || name.slice(0, 1).toUpperCase()}</span>;
}
function ago(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? minutes + 'm ago' : minutes < 1440 ? Math.floor(minutes / 60) + 'h ago' : Math.floor(minutes / 1440) + 'd ago';
}
function threadId(a: string, b: string) { return [a, b].sort().join(':'); }

export default function ScnPostFeatures({ activeTab, onTabChange, onClose, user, profile, posts, onCreatePost }: {
  activeTab: FeatureTab; onTabChange: (tab: FeatureTab) => void; onClose: () => void; user: User; profile: Profile | null; posts: ScnPost[]; onCreatePost: () => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleBusy, setPeopleBusy] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [profileName, setProfileName] = useState(profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || '');
  const [profileUsername, setProfileUsername] = useState(profile?.username || '');
  const [profileAvatar, setProfileAvatar] = useState(profile?.avatar || '');
  const [profileBusy, setProfileBusy] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [reposted, setReposted] = useState<Set<string>>(new Set());
  const [reelIndex, setReelIndex] = useState(0);
  const [noticeFilter, setNoticeFilter] = useState<'all' | 'unread'>('all');

  const currentName = profile?.name || String(user.user_metadata?.name || user.email?.split('@')[0] || 'SCN member');
  const currentAvatar = profile?.avatar || String(user.user_metadata?.avatar || '👑');
  const myPosts = useMemo(() => posts.filter(p => p.user_id === user.id), [posts, user.id]);
  const reels = useMemo(() => posts.filter(p => (p.post_type === 'video' || p.media_mime?.startsWith('video/')) && p.media_url), [posts]);
  const filteredNotices = useMemo(() => notices.filter(n => noticeFilter === 'all' || !n.read), [notices, noticeFilter]);

  const loadFollowing = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('follows').select('target_id').eq('follower_id', user.id).eq('target_type', 'user');
    if (error) { console.warn(error.message); return; }
    setFollowing(new Set((data || []).map(row => String(row.target_id))));
  }, [user.id]);

  const searchPeople = useCallback(async () => {
    if (!supabase) return;
    setPeopleBusy(true);
    const q = peopleQuery.trim().replace(/^@/, '').replace(/[%_]/g, '');
    let query = supabase.from('profiles').select('id,name,username,avatar').neq('id', user.id).order('name').limit(40);
    if (q) query = query.or('name.ilike.%' + q + '%,username.ilike.%' + q + '%');
    const { data, error } = await query;
    if (error) toast.error('Could not search members: ' + error.message);
    else setPeople((data || []).map((row: any) => ({ id: String(row.id), name: row.name || 'SCN member', username: row.username || '', avatar: row.avatar || '👑' })));
    setPeopleBusy(false);
  }, [peopleQuery, user.id]);

  const toggleFollow = async (person: Person) => {
    if (!supabase) return;
    const isFollowing = following.has(person.id);
    setFollowing(old => { const next = new Set(old); isFollowing ? next.delete(person.id) : next.add(person.id); return next; });
    const result = isFollowing
      ? await supabase.from('follows').delete().eq('follower_id', user.id).eq('target_type', 'user').eq('target_id', person.id)
      : await supabase.from('follows').insert({ follower_id: user.id, target_type: 'user', target_id: person.id, target_name: person.name, target_avatar: person.avatar });
    if (result.error) { setFollowing(old => { const next = new Set(old); isFollowing ? next.add(person.id) : next.delete(person.id); return next; }); toast.error(result.error.message); }
    else toast.success(isFollowing ? 'Unfollowed ' + person.name : 'Following ' + person.name);
  };

  const loadNotices = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('notifications').select('id,title,body,category,read,created_at,metadata').eq('user_id', user.id).order('created_at', { ascending: false }).limit(80);
    if (error) { toast.error('Notifications unavailable: ' + error.message); return; }
    setNotices((data || []) as Notice[]);
  }, [user.id]);

  const loadMessages = useCallback(async (person: Person) => {
    if (!supabase) return;
    const id = threadId(user.id, person.id);
    const { data, error } = await supabase.from('chat_messages').select('id,thread_id,sender_id,sender_name,sender_avatar,content,created_at').eq('thread_id', id).eq('thread_type', 'dm').order('created_at', { ascending: true }).limit(200);
    if (error) { toast.error('Could not load conversation: ' + error.message); return; }
    setMessages((data || []) as ChatMessage[]);
  }, [user.id]);

  useEffect(() => { void loadFollowing(); }, [loadFollowing]);
  useEffect(() => { if (!supabase) return; void supabase.from('feed_post_likes').select('post_id').eq('user_id', user.id).then(({ data }) => setLiked(new Set((data || []).map(row => String(row.post_id))))); void supabase.from('feed_post_reposts').select('post_id').eq('user_id', user.id).then(({ data }) => setReposted(new Set((data || []).map(row => String(row.post_id))))); }, [user.id]);
  useEffect(() => { if (activeTab === 'friends') void searchPeople(); }, [activeTab, searchPeople]);
  useEffect(() => { if (activeTab === 'notifications') void loadNotices(); }, [activeTab, loadNotices]);
  useEffect(() => { if (activeTab === 'messages' && selectedPerson) void loadMessages(selectedPerson); }, [activeTab, selectedPerson, loadMessages]);
  useEffect(() => {
    if (!supabase || activeTab !== 'messages' || !selectedPerson) return;
    const id = threadId(user.id, selectedPerson.id);
    const channel = supabase.channel('scn-post-dm-' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'thread_id=eq.' + id }, payload => {
      const row = payload.new as ChatMessage;
      setMessages(old => old.some(item => item.id === row.id) ? old : [...old, row]);
    }).subscribe();
    return () => { if (supabase) void supabase.removeChannel(channel); };
  }, [activeTab, selectedPerson, user.id]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !selectedPerson || !messageDraft.trim()) return;
    setMessageBusy(true);
    const content = messageDraft.trim();
    const { error } = await supabase.from('chat_messages').insert({
      thread_id: threadId(user.id, selectedPerson.id), thread_type: 'dm', sender_id: user.id,
      sender_name: currentName, sender_avatar: currentAvatar, message_type: 'text', content,
    });
    if (error) toast.error(error.message);
    else { setMessageDraft(''); }
    setMessageBusy(false);
    if (!error) await loadMessages(selectedPerson);
  };

  const markNotice = async (notice: Notice) => {
    if (!supabase || notice.read) return;
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notice.id).eq('user_id', user.id);
    if (error) toast.error(error.message);
    else setNotices(old => old.map(item => item.id === notice.id ? { ...item, read: true } : item));
  };
  const markAllNotices = async () => {
    if (!supabase) return;
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
    if (error) toast.error(error.message);
    else setNotices(old => old.map(item => ({ ...item, read: true })));
  };
  const clearNotices = async () => {
    if (!supabase) return;
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
    if (error) toast.error(error.message);
    else setNotices([]);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setProfileBusy(true);
    const { error } = await supabase.from('profiles').update({ name: profileName.trim(), username: profileUsername.trim().replace(/^@/, ''), avatar: profileAvatar.trim() || '👑' }).eq('id', user.id);
    if (error) toast.error('Profile update failed: ' + error.message);
    else toast.success('Profile updated');
    setProfileBusy(false);
  };

  const toggleLike = async (post: ScnPost) => {
    if (!supabase) return;
    const wasLiked = liked.has(post.id);
    setLiked(old => { const next = new Set(old); wasLiked ? next.delete(post.id) : next.add(post.id); return next; });
    const result = wasLiked
      ? await supabase.from('feed_post_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      : await supabase.from('feed_post_likes').insert({ post_id: post.id, user_id: user.id });
    if (result.error) { setLiked(old => { const next = new Set(old); wasLiked ? next.add(post.id) : next.delete(post.id); return next; }); toast.error(result.error.message); }
  };

  const toggleRepost = async (post: ScnPost) => {
    if (!supabase) return;
    const wasReposted = reposted.has(post.id);
    setReposted(old => { const next = new Set(old); wasReposted ? next.delete(post.id) : next.add(post.id); return next; });
    const result = wasReposted
      ? await supabase.from('feed_post_reposts').delete().eq('post_id', post.id).eq('user_id', user.id)
      : await supabase.from('feed_post_reposts').insert({ post_id: post.id, user_id: user.id });
    if (result.error) { setReposted(old => { const next = new Set(old); wasReposted ? next.add(post.id) : next.delete(post.id); return next; }); toast.error(result.error.message); }
    else toast.success(wasReposted ? 'Repost removed' : 'Added to your reposts');
  };

  const sharePost = async (post: ScnPost) => {
    const url = window.location.origin + '/?post=' + post.id;
    try { if (navigator.share) await navigator.share({ title: 'SCN Post', text: post.content || 'See this post', url }); else { await navigator.clipboard.writeText(url); toast.success('Link copied'); } }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) toast.error('Could not share post'); }
  };

  const renderBody = () => {
    if (activeTab === 'friends') return <section className="scnf-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">YOUR PEOPLE</span><h2>Find your circle</h2><p>Discover SCN members and build your following.</p></div><span className="scnf-count">{following.size} following</span></div>
      <div className="scnf-search"><Search size={18}/><input value={peopleQuery} onChange={e => setPeopleQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchPeople(); }} placeholder="Search by name or username"/><button onClick={() => void searchPeople()}>Search</button></div>
      {peopleBusy ? <p className="scnf-muted">Finding members…</p> : <div className="scnf-people-grid">{people.map(person => <article className="scnf-person" key={person.id}><Avatar name={person.name} src={person.avatar}/><div className="scnf-person-copy"><b>{person.name}</b><small>@{person.username.replace(/^@/, '') || 'scn-member'}</small></div><button className={following.has(person.id) ? 'scnf-follow is-following' : 'scnf-follow'} onClick={() => void toggleFollow(person)}>{following.has(person.id) ? <Check size={15}/> : <UserPlus size={15}/>} {following.has(person.id) ? 'Following' : 'Follow'}</button><button className="scnf-message-shortcut" onClick={() => { setSelectedPerson(person); onTabChange('messages'); }} title="Message"><MessageCircle size={17}/></button></article>)}</div>}
      {!peopleBusy && people.length === 0 && <div className="scnf-empty">No members found. Try another name or username.</div>}
    </section>;

    if (activeTab === 'reels') return <section className="scnf-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">SHORT-FORM VIDEO</span><h2>Reels</h2><p>Discover video posts from across the SCN community.</p></div><button className="scnf-gold-button" onClick={onCreatePost}><Plus size={16}/> Create video</button></div>
      {reels.length === 0 ? <div className="scnf-empty"><Film size={30}/><b>No reels yet</b><p>Video posts published to the shared SCN feed will appear here.</p><button className="scnf-gold-button" onClick={onCreatePost}>Upload a video</button></div> : <div className="scnf-reels-layout"><div className="scnf-reel-stage"><div className="scnf-reel-video-wrap"><video key={reels[reelIndex]?.id} src={reels[reelIndex]?.media_url || ''} controls playsInline autoPlay muted loop className="scnf-reel-video"/><div className="scnf-reel-overlay"><span>{reels[reelIndex]?.user_name}</span><p>{reels[reelIndex]?.content}</p></div></div><div className="scnf-reel-actions"><button onClick={() => void toggleLike(reels[reelIndex])} className={liked.has(reels[reelIndex]?.id) ? 'active' : ''}><Heart size={19}/>Like</button><button onClick={() => void toggleRepost(reels[reelIndex])} className={reposted.has(reels[reelIndex]?.id) ? 'active' : ''}><Share2 size={19}/>Repost</button><button onClick={() => void sharePost(reels[reelIndex])}><Send size={19}/>Share</button></div></div><div className="scnf-reel-rail">{reels.map((reel, index) => <button key={reel.id} className={index === reelIndex ? 'selected' : ''} onClick={() => setReelIndex(index)}><span>{index + 1}</span><div><b>{reel.user_name}</b><small>{reel.content || 'Video post'}</small></div></button>)}</div></div>}
    </section>;

    if (activeTab === 'messages') return <section className="scnf-panel scnf-messages-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">PRIVATE CONVERSATIONS</span><h2>Messages</h2><p>Direct messages use the existing SCN chat message store.</p></div></div>
      <div className="scnf-chat-layout"><aside className="scnf-chat-people"><div className="scnf-chat-section-title">Start a conversation</div>{people.slice(0, 24).map(person => <button key={person.id} className={selectedPerson?.id === person.id ? 'selected' : ''} onClick={() => setSelectedPerson(person)}><Avatar name={person.name} src={person.avatar}/><span><b>{person.name}</b><small>@{person.username.replace(/^@/, '') || 'member'}</small></span></button>)}{people.length === 0 && <p className="scnf-muted">Search for people in Friends first.</p>}</aside>
      <div className="scnf-chat-thread">{selectedPerson ? <><header><Avatar name={selectedPerson.name} src={selectedPerson.avatar}/><div><b>{selectedPerson.name}</b><small>SCN member</small></div></header><div className="scnf-chat-messages">{messages.map(message => <div key={message.id} className={message.sender_id === user.id ? 'scnf-chat-bubble mine' : 'scnf-chat-bubble'}><p>{message.content}</p><small>{ago(message.created_at)}</small></div>)}{messages.length === 0 && <div className="scnf-empty">Start the conversation with {selectedPerson.name}.</div>}</div><form className="scnf-chat-compose" onSubmit={sendMessage}><input value={messageDraft} onChange={e => setMessageDraft(e.target.value)} placeholder="Write a message…"/><button disabled={messageBusy || !messageDraft.trim()}><Send size={17}/></button></form></> : <div className="scnf-empty"><MessageCircle size={28}/><b>Choose someone to message</b><p>Select a member from the list to open a direct conversation.</p></div>}</div></div>
    </section>;

    if (activeTab === 'notifications') return <section className="scnf-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">STAY IN THE LOOP</span><h2>Notifications</h2><p>Likes, replies, follows and activity across SCN.</p></div><div className="scnf-notice-tools"><button onClick={() => void markAllNotices()}>Mark all read</button><button onClick={() => void clearNotices()}>Clear all</button></div></div>
      <div className="scnf-filter-row"><button className={noticeFilter === 'all' ? 'selected' : ''} onClick={() => setNoticeFilter('all')}>All</button><button className={noticeFilter === 'unread' ? 'selected' : ''} onClick={() => setNoticeFilter('unread')}>Unread</button><span>{notices.filter(n => !n.read).length} unread</span></div>
      <div className="scnf-notices">{filteredNotices.map(notice => <button key={notice.id} className={notice.read ? 'scnf-notice read' : 'scnf-notice unread'} onClick={() => void markNotice(notice)}><span className="scnf-notice-icon"><Bell size={17}/></span><span><b>{notice.title}</b><small>{notice.body || notice.category || 'SCN activity'} · {ago(notice.created_at)}</small></span>{!notice.read && <i/>}</button>)}</div>
      {filteredNotices.length === 0 && <div className="scnf-empty">You’re all caught up. New activity will appear here.</div>}
    </section>;

    if (activeTab === 'profile') return <section className="scnf-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">YOUR IDENTITY</span><h2>My profile</h2><p>Manage the profile connected to your shared SCN account.</p></div></div>
      <div className="scnf-profile-hero"><Avatar name={profileName || currentName} src={profileAvatar || currentAvatar}/><div><h3>{profileName || currentName}</h3><p>@{profileUsername.replace(/^@/, '') || 'scn-member'}</p><span>{myPosts.length} posts · {following.size} following</span></div></div>
      <form className="scnf-profile-form" onSubmit={saveProfile}><label>Display name<input value={profileName} onChange={e => setProfileName(e.target.value)} required/></label><label>Username<input value={profileUsername} onChange={e => setProfileUsername(e.target.value)} placeholder="your-username"/></label><label>Avatar URL or emoji<input value={profileAvatar} onChange={e => setProfileAvatar(e.target.value)} placeholder="Paste an image URL or use an emoji"/></label><button className="scnf-gold-button" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save profile'}</button></form>
      <div className="scnf-section-title">Your recent posts</div><div className="scnf-own-posts">{myPosts.slice(0, 8).map(post => <article key={post.id}><b>{post.title || post.content || 'Untitled post'}</b><small>{ago(post.created_at)} · {post.likes} likes · {post.comments_count} comments</small></article>)}</div>
    </section>;

    return <section className="scnf-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">CREATOR WORKSPACE</span><h2>Creator studio</h2><p>A live snapshot of content published through your shared SCN identity.</p></div><button className="scnf-gold-button" onClick={onCreatePost}><Plus size={16}/> Publish</button></div>
      <div className="scnf-metric-grid"><article><span>Published posts</span><b>{myPosts.length}</b><small>Across all formats</small></article><article><span>Total likes</span><b>{myPosts.reduce((sum, post) => sum + Number(post.likes || 0), 0)}</b><small>On your posts</small></article><article><span>Comments</span><b>{myPosts.reduce((sum, post) => sum + Number(post.comments_count || 0), 0)}</b><small>Community responses</small></article><article><span>Reposts</span><b>{myPosts.reduce((sum, post) => sum + Number(post.reposts || 0), 0)}</b><small>Shared onward</small></article></div>
      <div className="scnf-section-title">Your content</div><div className="scnf-creator-list">{myPosts.map(post => <article key={post.id}><span className="scnf-content-type">{post.post_type}</span><div><b>{post.title || post.content || 'Untitled post'}</b><small>{ago(post.created_at)}</small></div><span>{post.likes} ♥</span><span>{post.comments_count} comments</span></article>)}</div>
      <div className="scnf-info-note">Reach and audience analytics will appear when the SCN view-count and audience reporting data are connected. This dashboard currently reports only fields available on your published posts.</div>
    </section>;
  };

  return <div className="scnf-workspace">
    <header className="scnf-topbar"><div><span className="scnf-brand-dot">S</span><div><b>SCN POST</b><small>YOUR SOCIAL SPACE</small></div></div><nav>{tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => { onTabChange(tab.id); if (tab.id === 'messages') void searchPeople(); setReelIndex(0); }} data-tab={tab.id}><Icon size={17}/><span>{tab.label}</span></button>; })}</nav><button className="scnf-close" onClick={onClose} aria-label="Back to feed"><X size={18}/></button></header>
    <main className="scnf-main">{renderBody()}</main>
  </div>;
}
