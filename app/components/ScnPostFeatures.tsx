'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bell, BarChart3, Check, Compass, Crown, Film, Heart, MessageCircle, Plus, Search, Send, Share2, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ScnPost } from '../lib/feedTypes';
import './ScnPostFeatures.css';

type FeatureTab = 'friends' | 'reels' | 'messages' | 'communities' | 'notifications' | 'profile' | 'creator' | 'royal';
type Profile = { id: string; name: string; username?: string; avatar?: string };
type Person = { id: string; name: string; username: string; avatar: string };
type ChatMessage = { id: string; conversation_id: string; sender_id: string | null; content: string | null; message: string | null; created_at: string };
type Notice = { id: string; title: string; body: string | null; category: string | null; read: boolean; created_at: string; metadata?: Record<string, unknown> };
type RoyalTurn = { role: 'user' | 'assistant'; content: string };
type Community = { id: string; name: string; description: string; privacy: 'public' | 'private'; invite_code: string; conversation_id: string; created_at: string };

const tabs: { id: FeatureTab; label: string; icon: typeof Users }[] = [
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'reels', label: 'Reels', icon: Film },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'communities', label: 'Communities', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile', label: 'My profile', icon: Compass },
  { id: 'creator', label: 'Creator studio', icon: BarChart3 },
  { id: 'royal', label: 'Royal', icon: Crown },
];

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return <span className="scnf-avatar">{src && (src.startsWith('http') || src.startsWith('/')) ? <img src={src} alt="" /> : src || name.slice(0, 1).toUpperCase()}</span>;
}
function ago(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? minutes + 'm ago' : minutes < 1440 ? Math.floor(minutes / 60) + 'h ago' : Math.floor(minutes / 1440) + 'd ago';
}
function conversationId(a: string, b: string) { const pair = [a, b].sort(); const ah = pair[0].replace(/-/g, ''); const bh = pair[1].replace(/-/g, ''); const mix = Array.from({ length: 32 }, (_, i) => { const av = parseInt(ah[i % ah.length] || '0', 16); const bv = parseInt(bh[i % bh.length] || '0', 16); return ((av ^ bv) % 16).toString(16); }).join(''); return mix.slice(0, 8) + '-' + mix.slice(8, 12) + '-4' + mix.slice(12, 15) + '-8' + mix.slice(15, 18) + '-' + mix.slice(18, 30); }

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
  const [viewedReels, setViewedReels] = useState<Set<string>>(new Set());
  const [reelIndex, setReelIndex] = useState(0);
  const [noticeFilter, setNoticeFilter] = useState<'all' | 'unread'>('all');
  const [chatAllowed, setChatAllowed] = useState<boolean | null>(null);
  const [royalTurns, setRoyalTurns] = useState<RoyalTurn[]>([]);
  const [royalPrompt, setRoyalPrompt] = useState('');
  const [royalStreaming, setRoyalStreaming] = useState('');
  const [royalBusy, setRoyalBusy] = useState(false);
  const [royalError, setRoyalError] = useState('');
  const royalAbort = useRef<AbortController | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityMembers, setCommunityMembers] = useState<Set<string>>(new Set());
  const [communitySearch, setCommunitySearch] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [communityDescription, setCommunityDescription] = useState('');
  const [communityPrivacy, setCommunityPrivacy] = useState<'public' | 'private'>('public');
  const [communityGroupId, setCommunityGroupId] = useState('');
  const [communityInviteCode, setCommunityInviteCode] = useState('');
  const [communityBusy, setCommunityBusy] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [communityMessages, setCommunityMessages] = useState<ChatMessage[]>([]);
  const [communityMessageDraft, setCommunityMessageDraft] = useState('');

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

  const loadCommunities = useCallback(async () => {
    if (!supabase) return;
    const [g, m] = await Promise.all([
      supabase.from('scn_post_groups').select('id,name,description,privacy,invite_code,conversation_id,created_at').order('created_at', { ascending: false }).limit(80),
      supabase.from('scn_post_group_members').select('group_id').eq('user_id', user.id),
    ]);
    if (g.error) { toast.error('Communities are unavailable. Apply migration 054 first.'); return; }
    setCommunities((g.data || []) as Community[]);
    setCommunityMembers(new Set((m.data || []).map(row => String(row.group_id))));
  }, [user.id]);

  const loadCommunityMessages = useCallback(async (group: Community) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('chat_messages').select('id,conversation_id,sender_id,content,message,created_at').eq('conversation_id', group.conversation_id).order('created_at', { ascending: true }).limit(300);
    if (error) { toast.error(error.message); return; }
    setCommunityMessages((data || []) as ChatMessage[]);
  }, []);

  const createCommunity = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !communityName.trim()) return;
    setCommunityBusy(true);
    const name = communityName.trim();
    const description = communityDescription.trim();
    const { data, error } = await supabase.rpc('create_scn_post_group', { p_name: name, p_description: description, p_privacy: communityPrivacy });
    if (error) toast.error(error.message);
    else {
      const row = Array.isArray(data) ? data[0] : data;
      await loadCommunities();
      setCommunityName(''); setCommunityDescription('');
      if (row?.id) {
        const group = { id: String(row.id), name, description, privacy: communityPrivacy, invite_code: String(row.invite_code || ''), conversation_id: String(row.conversation_id || ''), created_at: new Date().toISOString() } as Community;
        setSelectedCommunity(group); setCommunityMembers(old => new Set(old).add(group.id));
        toast.success('Community created');
      }
    }
    setCommunityBusy(false);
  };

  const joinCommunity = async (group: Community, inviteCode?: string) => {
    if (!supabase) return;
    setCommunityBusy(true);
    const { error } = await supabase.rpc('join_scn_post_group', { p_group_id: group.id, p_invite_code: inviteCode || null });
    if (error) toast.error(error.message);
    else {
      setCommunityMembers(old => new Set(old).add(group.id)); setSelectedCommunity(group);
      setCommunityGroupId(''); setCommunityInviteCode('');
      await loadCommunityMessages(group); toast.success('Joined ' + group.name);
    }
    setCommunityBusy(false);
  };

  const sendCommunityMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !selectedCommunity || !communityMessageDraft.trim()) return;
    const content = communityMessageDraft.trim();
    const { error } = await supabase.from('chat_messages').insert({ conversation_id: selectedCommunity.conversation_id, sender_id: user.id, content, message: content, read: false });
    if (error) toast.error(error.message);
    else { setCommunityMessageDraft(''); await loadCommunityMessages(selectedCommunity); }
  };

  const shareCommunityInvite = async (group: Community) => {
    const url = window.location.origin + '/?community=' + group.id + '&invite=' + encodeURIComponent(group.invite_code);
    try { if (navigator.share) await navigator.share({ title: group.name + ' on SCN Post', text: 'Join my SCN community', url }); else { await navigator.clipboard.writeText(url); toast.success('Invite link copied'); } }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) toast.error('Could not share invite'); }
  };

  const loadNotices = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('notifications').select('id,title,body,category,read,created_at,metadata').eq('user_id', user.id).order('created_at', { ascending: false }).limit(80);
    if (error) { toast.error('Notifications unavailable: ' + error.message); return; }
    setNotices((data || []) as Notice[]);
  }, [user.id]);

  const checkChatAccess = useCallback(async (person: Person) => {
    if (!supabase) return false;
    const [mutual, accepted] = await Promise.all([
      supabase.from('follows').select('follower_id').eq('target_type', 'user').or('and(follower_id.eq.' + user.id + ',target_id.eq.' + person.id + '),and(follower_id.eq.' + person.id + ',target_id.eq.' + user.id + ')'),
      supabase.from('chat_requests').select('id').eq('status', 'accepted').or('and(from_user_id.eq.' + user.id + ',to_user_id.eq.' + person.id + '),and(from_user_id.eq.' + person.id + ',to_user_id.eq.' + user.id + ')').limit(1),
    ]);
    const rows = mutual.data || [];
    const mutualFollow = rows.some(row => String(row.follower_id) === user.id) && rows.some(row => String(row.follower_id) === person.id);
    return mutualFollow || Boolean((accepted.data || []).length);
  }, [user.id]);

  const loadMessages = useCallback(async (person: Person) => {
    if (!supabase) return;
    const allowed = await checkChatAccess(person);
    setChatAllowed(allowed);
    if (!allowed) { setMessages([]); return; }
    const id = conversationId(user.id, person.id);
    const membership = await supabase.from('conversation_members').upsert({ conversation_id: id, user_id: user.id }, { onConflict: 'conversation_id,user_id' });
    if (membership.error) { toast.error(membership.error.message); return; }
    const { data, error } = await supabase.from('chat_messages').select('id,conversation_id,sender_id,content,message,created_at').eq('conversation_id', id).order('created_at', { ascending: true }).limit(200);
    if (error) { toast.error('Could not load conversation: ' + error.message); return; }
    setMessages((data || []) as ChatMessage[]);
  }, [user.id, checkChatAccess]);

  useEffect(() => { void loadFollowing(); }, [loadFollowing]);
  useEffect(() => { if (!supabase) return; void supabase.from('feed_post_likes').select('post_id').eq('user_id', user.id).then(({ data }) => setLiked(new Set((data || []).map(row => String(row.post_id))))); void supabase.from('feed_post_reposts').select('post_id').eq('user_id', user.id).then(({ data }) => setReposted(new Set((data || []).map(row => String(row.post_id))))); }, [user.id]);
  useEffect(() => { if (activeTab === 'friends' || activeTab === 'messages') void searchPeople(); }, [activeTab, searchPeople]);
  useEffect(() => { if (profile) { setProfileName(profile.name || ''); setProfileUsername(profile.username || ''); setProfileAvatar(profile.avatar || ''); } }, [profile]);
  useEffect(() => { if (activeTab === 'notifications') void loadNotices(); }, [activeTab, loadNotices]);
  useEffect(() => { if (activeTab === 'communities') { void loadCommunities(); const params = new URLSearchParams(window.location.search); const groupId = params.get('community'); const invite = params.get('invite'); if (groupId) { setCommunityGroupId(groupId); setCommunityInviteCode(invite || ''); } } }, [activeTab, loadCommunities]);
  useEffect(() => { if (!supabase || activeTab !== 'communities' || !selectedCommunity || !communityMembers.has(selectedCommunity.id)) return; void loadCommunityMessages(selectedCommunity); const channel = supabase.channel('scn-post-community-' + selectedCommunity.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'conversation_id=eq.' + selectedCommunity.conversation_id }, payload => { const row = payload.new as ChatMessage; setCommunityMessages(old => old.some(item => item.id === row.id) ? old : [...old, row]); }).subscribe(); return () => { if (supabase) void supabase.removeChannel(channel); }; }, [activeTab, selectedCommunity, communityMembers, loadCommunityMessages]);
  useEffect(() => { if (activeTab === 'messages' && selectedPerson) void loadMessages(selectedPerson); }, [activeTab, selectedPerson, loadMessages]);
  useEffect(() => {
    if (!supabase || activeTab !== 'messages' || !selectedPerson) return;
    const id = conversationId(user.id, selectedPerson.id);
    const channel = supabase.channel('scn-post-dm-' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'conversation_id=eq.' + id }, payload => {
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
    const cid = conversationId(user.id, selectedPerson.id);
    if (!await checkChatAccess(selectedPerson)) { setChatAllowed(false); toast.error('Direct messaging opens after a mutual follow or an accepted chat request.'); setMessageBusy(false); return; }
    const membership = await supabase.from('conversation_members').upsert({ conversation_id: cid, user_id: user.id }, { onConflict: 'conversation_id,user_id' });
    if (membership.error) { toast.error(membership.error.message); setMessageBusy(false); return; }
    const { error } = await supabase.from('chat_messages').insert({ conversation_id: cid, sender_id: user.id, content, message: content, read: false });
    if (error) toast.error(error.message);
    else { setMessageDraft(''); setChatAllowed(true); }
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

  const recordReelView = async (post: ScnPost) => { if (!supabase || viewedReels.has(post.id)) return; setViewedReels(old => new Set(old).add(post.id)); const { error } = await supabase.rpc('bump_feed_post_view_count', { p_id: post.id }); if (error) console.warn('Reel view count was not recorded:', error.message); };

  const sharePost = async (post: ScnPost) => {
    const url = window.location.origin + '/?post=' + post.id;
    try { if (navigator.share) await navigator.share({ title: 'SCN Post', text: post.content || 'See this post', url }); else { await navigator.clipboard.writeText(url); toast.success('Link copied'); } }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) toast.error('Could not share post'); }
  };

  const sendRoyal = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = royalPrompt.trim();
    if (!prompt || royalBusy || !supabase) return;
    setRoyalTurns(old => [...old, { role: 'user', content: prompt }]);
    setRoyalPrompt('');
    setRoyalError('');
    setRoyalStreaming('');
    setRoyalBusy(true);
    const controller = new AbortController();
    royalAbort.current = controller;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (session.error || !token) throw new Error('Your SCN session has expired. Sign in again.');
      const response = await fetch('/api/royal/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-supabase-auth': token, 'Accept': 'text/event-stream, application/json' },
        body: JSON.stringify({ conversationId: 'scn-post', prompt, history: royalTurns.slice(-12), mode: 'royal' }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
        throw new Error(body.error || body.message || 'Royal could not respond (' + response.status + ').');
      }
      const contentType = response.headers.get('content-type') || '';
      let answer = '';
      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventName = 'message';
        const processBlock = (block: string) => {
          const dataLines: string[] = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
          }
          if (!dataLines.length) return;
          let data: Record<string, unknown>;
          try { data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>; } catch { eventName = 'message'; return; }
          if (eventName === 'token' && typeof data.text === 'string') {
            answer += data.text;
            setRoyalStreaming(answer);
          }
          if (eventName === 'done' && typeof data.answer === 'string') answer = data.answer;
          if (eventName === 'error') throw new Error(typeof data.error === 'string' ? data.error : 'Royal stream failed.');
          eventName = 'message';
        };
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let boundary = buffer.indexOf('\n\n');
          while (boundary >= 0) { processBlock(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); boundary = buffer.indexOf('\n\n'); }
        }
        buffer += decoder.decode();
        if (buffer.trim()) processBlock(buffer);
      } else {
        const body = await response.json() as Record<string, unknown>;
        answer = typeof body.answer === 'string' ? body.answer : typeof body.content === 'string' ? body.content : '';
      }
      if (!answer.trim()) throw new Error('Royal returned an empty response.');
      setRoyalTurns(old => [...old, { role: 'assistant', content: answer.trim() }]);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setRoyalError(error instanceof Error ? error.message : 'Royal is temporarily unavailable.');
    } finally {
      royalAbort.current = null;
      setRoyalBusy(false);
      setRoyalStreaming('');
    }
  };

  const renderBody = () => {
    if (activeTab === 'royal') return <section className="scnf-panel scnf-royal-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">SHARED KUS INTELLIGENCE</span><h2>Royal</h2><p>Your SCN Post companion, connected to the shared Royal runtime.</p></div><span className="scnf-royal-status"><i/> KUS Core · Guardian boundaries</span></div>
      <div className="scnf-royal-welcome"><span className="scnf-royal-mark">♛</span><div><b>What are we building today?</b><p>Ask Royal to help with social strategy, creator workflows, content ideas, community discovery or your next post.</p></div></div>
      {royalTurns.length === 0 && <div className="scnf-royal-starters">{['Help me plan a week of posts for my audience','Turn this idea into a strong social post','How can I grow a creator community on SCN?'].map(item => <button key={item} onClick={() => setRoyalPrompt(item)}>{item}</button>)}</div>}
      <div className="scnf-royal-transcript">{royalTurns.map((turn, index) => <article key={index} className={'scnf-royal-turn '+turn.role}><small>{turn.role === 'assistant' ? '♛ Royal' : 'You'}</small><p>{turn.content}</p></article>)}{royalStreaming && <article className="scnf-royal-turn assistant"><small>♛ Royal · responding</small><p>{royalStreaming}</p></article>}{royalError && <div className="scnf-royal-error">{royalError}</div>}</div>
      <form className="scnf-royal-compose" onSubmit={sendRoyal}><textarea value={royalPrompt} onChange={e => setRoyalPrompt(e.target.value)} rows={2} placeholder="Message Royal about your social world…" disabled={royalBusy}/>{royalBusy ? <button type="button" onClick={() => royalAbort.current?.abort()}>Stop</button> : <button type="submit" disabled={!royalPrompt.trim()}><Send size={17}/> Send</button>}</form>
      <p className="scnf-royal-footnote">Royal uses the shared KUS intelligence gateway. It does not bypass Guardian approval for protected actions.</p>
    </section>;

    if (activeTab === 'friends') return <section className="scnf-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">YOUR PEOPLE</span><h2>Find your circle</h2><p>Discover SCN members and build your following.</p></div><span className="scnf-count">{following.size} following</span></div>
      <div className="scnf-search"><Search size={18}/><input value={peopleQuery} onChange={e => setPeopleQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchPeople(); }} placeholder="Search by name or username"/><button onClick={() => void searchPeople()}>Search</button></div>
      {peopleBusy ? <p className="scnf-muted">Finding members…</p> : <div className="scnf-people-grid">{people.map(person => <article className="scnf-person" key={person.id}><Avatar name={person.name} src={person.avatar}/><div className="scnf-person-copy"><b>{person.name}</b><small>@{person.username.replace(/^@/, '') || 'scn-member'}</small></div><button className={following.has(person.id) ? 'scnf-follow is-following' : 'scnf-follow'} onClick={() => void toggleFollow(person)}>{following.has(person.id) ? <Check size={15}/> : <UserPlus size={15}/>} {following.has(person.id) ? 'Following' : 'Follow'}</button><button className="scnf-message-shortcut" onClick={() => { setSelectedPerson(person); onTabChange('messages'); setChatAllowed(null); }} title="Message"><MessageCircle size={17}/></button></article>)}</div>}
      {!peopleBusy && people.length === 0 && <div className="scnf-empty">No members found. Try another name or username.</div>}
    </section>;

    if (activeTab === 'reels') return <section className="scnf-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">SHORT-FORM VIDEO</span><h2>Reels</h2><p>Discover video posts from across the SCN community.</p></div><button className="scnf-gold-button" onClick={onCreatePost}><Plus size={16}/> Create video</button></div>
      {reels.length === 0 ? <div className="scnf-empty"><Film size={30}/><b>No reels yet</b><p>Video posts published to the shared SCN feed will appear here.</p><button className="scnf-gold-button" onClick={onCreatePost}>Upload a video</button></div> : <div className="scnf-reels-layout"><div className="scnf-reel-stage"><div className="scnf-reel-video-wrap"><video key={reels[reelIndex]?.id} src={reels[reelIndex]?.media_url || ''} controls playsInline autoPlay muted loop className="scnf-reel-video" onPlay={() => void recordReelView(reels[reelIndex])}/><div className="scnf-reel-overlay"><span>{reels[reelIndex]?.user_name}</span><p>{reels[reelIndex]?.content}</p></div></div><div className="scnf-reel-actions"><button onClick={() => void toggleLike(reels[reelIndex])} className={liked.has(reels[reelIndex]?.id) ? 'active' : ''}><Heart size={19}/>Like</button><button onClick={() => void toggleRepost(reels[reelIndex])} className={reposted.has(reels[reelIndex]?.id) ? 'active' : ''}><Share2 size={19}/>Repost</button><button onClick={() => void sharePost(reels[reelIndex])}><Send size={19}/>Share</button></div></div><div className="scnf-reel-rail">{reels.map((reel, index) => <button key={reel.id} className={index === reelIndex ? 'selected' : ''} onClick={() => setReelIndex(index)}><span>{index + 1}</span><div><b>{reel.user_name}</b><small>{reel.content || 'Video post'}</small></div></button>)}</div></div>}
    </section>;

    if (activeTab === 'communities') return <section className="scnf-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">COMMUNITY SPACES</span><h2>Communities</h2><p>Build or join shared spaces using SCN group membership and conversations.</p></div></div>
      <div className="scnf-community-layout">
        <div className="scnf-community-discovery">
          <form className="scnf-community-create" onSubmit={createCommunity}><b>Create a community</b><input value={communityName} onChange={e => setCommunityName(e.target.value)} placeholder="Community name" maxLength={64} required/><textarea value={communityDescription} onChange={e => setCommunityDescription(e.target.value)} placeholder="What is this community about?" rows={2}/><div><select value={communityPrivacy} onChange={e => setCommunityPrivacy(e.target.value as 'public'|'private')}><option value="public">Public</option><option value="private">Private · invite code</option></select><button className="scnf-gold-button" disabled={communityBusy || !communityName.trim()}><Plus size={15}/> Create</button></div></form>
          <div className="scnf-community-title"><b>Discover spaces</b><span>{communities.length} found</span></div><div className="scnf-search"><Search size={16}/><input value={communitySearch} onChange={e => setCommunitySearch(e.target.value)} placeholder="Search communities"/></div>
          <div className="scnf-community-list">{communities.filter(group => (group.name + ' ' + group.description).toLowerCase().includes(communitySearch.toLowerCase())).map(group => <article key={group.id} className={selectedCommunity?.id === group.id ? 'selected' : ''}><div><b>{group.name}</b><small>{group.description || 'A community in SCN Post'} · {group.privacy}</small></div>{communityMembers.has(group.id) ? <button onClick={() => { setSelectedCommunity(group); void loadCommunityMessages(group); }}>Open</button> : <button onClick={() => void joinCommunity(group)} disabled={communityBusy}>Join</button>}</article>)}</div>
          <div className="scnf-community-invite"><b>Join with an invite</b><input value={communityGroupId} onChange={e => setCommunityGroupId(e.target.value)} placeholder="Community ID"/><input value={communityInviteCode} onChange={e => setCommunityInviteCode(e.target.value)} placeholder="Invite code"/><button onClick={() => { const group = communities.find(item => item.id === communityGroupId.trim()); if (group) void joinCommunity(group, communityInviteCode); else toast.error('The community is not visible yet. Check the invite details.'); }} disabled={communityBusy || !communityGroupId.trim()}>Join private community</button></div>
        </div>
        <div className="scnf-community-chat">{selectedCommunity ? <><header><div><b>{selectedCommunity.name}</b><small>{selectedCommunity.privacy} community</small></div>{communityMembers.has(selectedCommunity.id) && <button onClick={() => void shareCommunityInvite(selectedCommunity)}>Invite</button>}</header>{communityMembers.has(selectedCommunity.id) ? <><div className="scnf-community-messages">{communityMessages.map(message => <div key={message.id} className={message.sender_id === user.id ? 'mine' : ''}><p>{message.content || message.message}</p><small>{message.sender_id === user.id ? 'You' : 'Member'} · {ago(message.created_at)}</small></div>)}{communityMessages.length === 0 && <div className="scnf-empty">Start the community conversation.</div>}</div><form className="scnf-chat-compose" onSubmit={sendCommunityMessage}><input value={communityMessageDraft} onChange={e => setCommunityMessageDraft(e.target.value)} placeholder="Message the community…"/><button disabled={!communityMessageDraft.trim()}><Send size={17}/></button></form></> : <div className="scnf-empty"><Users size={28}/><b>Join this community</b><p>Join to read and contribute to its conversation.</p><button className="scnf-gold-button" onClick={() => void joinCommunity(selectedCommunity)}>Join community</button></div>}</> : <div className="scnf-empty"><Users size={30}/><b>Your community space</b><p>Select a community or create one to start a shared conversation.</p></div>}</div>
      </div>
    </section>;

    if (activeTab === 'messages') return <section className="scnf-panel scnf-messages-panel">
      <div className="scnf-panel-head"><div><span className="scnf-kicker">PRIVATE CONVERSATIONS</span><h2>Messages</h2><p>Direct messages use the existing SCN chat message store.</p></div></div>
      <div className="scnf-chat-layout"><aside className="scnf-chat-people"><div className="scnf-chat-section-title">Start a conversation</div>{people.slice(0, 24).map(person => <button key={person.id} className={selectedPerson?.id === person.id ? 'selected' : ''} onClick={() => setSelectedPerson(person)}><Avatar name={person.name} src={person.avatar}/><span><b>{person.name}</b><small>@{person.username.replace(/^@/, '') || 'member'}</small></span></button>)}{people.length === 0 && <p className="scnf-muted">Search for people in Friends first.</p>}</aside>
      <div className="scnf-chat-thread">{selectedPerson ? <><header><Avatar name={selectedPerson.name} src={selectedPerson.avatar}/><div><b>{selectedPerson.name}</b><small>SCN member</small></div></header><div className="scnf-chat-messages">{messages.map(message => <div key={message.id} className={message.sender_id === user.id ? 'scnf-chat-bubble mine' : 'scnf-chat-bubble'}><p>{message.content || message.message}</p><small>{ago(message.created_at)}</small></div>)}{messages.length === 0 && <div className="scnf-empty">Start the conversation with {selectedPerson.name}.</div>}</div>{chatAllowed === false && <div className="scnf-chat-access-note">Direct messages require a mutual follow or an accepted SCN chat request. Follow each other first, or accept the request in SCN Chat.</div>}<form className="scnf-chat-compose" onSubmit={sendMessage}><input value={messageDraft} onChange={e => setMessageDraft(e.target.value)} placeholder="Write a message…"/><button disabled={messageBusy || !messageDraft.trim()}><Send size={17}/></button></form></> : <div className="scnf-empty"><MessageCircle size={28}/><b>Choose someone to message</b><p>Select a member from the list to open a direct conversation.</p></div>}</div></div>
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
      <div className="scnf-metric-grid"><article><span>Published posts</span><b>{myPosts.length}</b><small>Across all formats</small></article><article><span>Total likes</span><b>{myPosts.reduce((sum, post) => sum + Number(post.likes || 0), 0)}</b><small>On your posts</small></article><article><span>Comments</span><b>{myPosts.reduce((sum, post) => sum + Number(post.comments_count || 0), 0)}</b><small>Community responses</small></article><article><span>Reposts</span><b>{myPosts.reduce((sum, post) => sum + Number(post.reposts || 0), 0)}</b><small>Shared onward</small></article><article><span>Video views</span><b>{myPosts.reduce((sum, post) => sum + Number(post.view_count || 0), 0)}</b><small>Recorded views</small></article><article><span>Audio listens</span><b>{myPosts.reduce((sum, post) => sum + Number(post.listen_count || 0), 0)}</b><small>Recorded listens</small></article></div>
      <div className="scnf-section-title">Your content</div><div className="scnf-creator-list">{myPosts.map(post => <article key={post.id}><span className="scnf-content-type">{post.post_type}</span><div><b>{post.title || post.content || 'Untitled post'}</b><small>{ago(post.created_at)}</small></div><span>{post.likes} ♥</span><span>{post.comments_count} comments</span></article>)}</div>
      <div className="scnf-info-note">These totals use the existing SCN feed counters. Audience retention, follower growth, campaign attribution and revenue analytics are not yet available in this companion.</div>
    </section>;
  };

  return <div className="scnf-workspace">
    <header className="scnf-topbar"><div><span className="scnf-brand-dot">S</span><div><b>SCN POST</b><small>YOUR SOCIAL SPACE</small></div></div><nav>{tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => { onTabChange(tab.id); if (tab.id === 'messages') { void searchPeople(); setChatAllowed(null); } setReelIndex(0); }} data-tab={tab.id}><Icon size={17}/><span>{tab.label}</span></button>; })}</nav><button className="scnf-close" onClick={onClose} aria-label="Back to feed"><X size={18}/></button></header>
    <main className="scnf-main">{renderBody()}</main>
  </div>;
}
