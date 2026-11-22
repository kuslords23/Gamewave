'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowUpRight, LoaderCircle, UserPlus, UserCheck, ImagePlus,
  Camera, Globe, BriefcaseBusiness, GraduationCap, Building2, Heart,
  Bookmark, Users, Radio, Video, Phone, Link2, Mail, Pencil, Save,
  X, ExternalLink, MapPin, Plus, Lock, ChevronRight,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { supabase } from '../lib/supabase';
import QuotedPostPreview from './QuotedPostPreview';

type Member = { id: string; name: string; username: string | null; avatar: string | null; bio: string | null };
type MemberPost = { id: string; user_id: string; user_name: string; user_avatar: string | null; title: string | null; content: string | null; post_type: string; media_url: string | null; cover_url: string | null; link_url: string | null; link_platform: string | null; quoted_post_id: string | null; likes: number; comments_count: number; reposts: number; created_at: string };
type Visibility = 'public' | 'followers' | 'private';
type ProfileDetails = Record<string, string>;
type Space = { id: string; name: string; description: string; privacy: string; owner_id: string };
type ProfileTab = 'posts' | 'gallery' | 'about' | 'activity' | 'spaces' | 'live';
type ActivityTab = 'liked' | 'saved';

const SCN_BASE_URL = (process.env.NEXT_PUBLIC_SCN_APP_URL || 'https://sport-clan-nexus.vercel.app').replace(/\/$/, '');
const DEFAULT_DETAILS: ProfileDetails = {
  location: '', work: '', education: '', business: '', relationshipStatus: '',
  website: '', publicEmail: '', interests: '', skills: '', languages: '',
};
const DEFAULT_VISIBILITY: Record<string, Visibility> = {
  cover: 'public', location: 'private', work: 'public', education: 'public',
  business: 'public', relationshipStatus: 'private', website: 'public',
  publicEmail: 'private', interests: 'public', skills: 'public', languages: 'public',
};
const DETAIL_FIELDS: { key: keyof ProfileDetails; label: string; icon: typeof BriefcaseBusiness; placeholder: string }[] = [
  { key: 'location', label: 'Location', icon: MapPin, placeholder: 'City, region or country' },
  { key: 'work', label: 'Work and career', icon: BriefcaseBusiness, placeholder: 'Role, employer, experience and achievements' },
  { key: 'education', label: 'Education', icon: GraduationCap, placeholder: 'Schools, qualifications and courses' },
  { key: 'business', label: 'Business', icon: Building2, placeholder: 'Business name, industry, products or services' },
  { key: 'relationshipStatus', label: 'Relationship status', icon: Heart, placeholder: 'Optional relationship status' },
  { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://yourwebsite.com' },
  { key: 'publicEmail', label: 'Public contact email', icon: Mail, placeholder: 'contact@example.com' },
  { key: 'interests', label: 'Interests', icon: Heart, placeholder: 'Music, football, technology…' },
  { key: 'skills', label: 'Skills', icon: BriefcaseBusiness, placeholder: 'Leadership, design, writing…' },
  { key: 'languages', label: 'Languages', icon: Globe, placeholder: 'English, Twi, French…' },
];

function Avatar({ name, src }: { name: string; src: string | null }) {
  return <span className="member-avatar">{src && (/^https?:|^\//.test(src)) ? <img src={src} alt="" /> : src || name.slice(0, 1).toUpperCase()}</span>;
}

function externalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
}

function orderedPosts(ids: string[], rows: MemberPost[]) {
  const byId = new Map(rows.map(row => [row.id, row]));
  return ids.map(id => byId.get(id)).filter(Boolean) as MemberPost[];
}

export default function MemberProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const key = decodeURIComponent(params.username || '');
  const [member, setMember] = useState<Member | null>(null);
  const [posts, setPosts] = useState<MemberPost[]>([]);
  const [gallery, setGallery] = useState<MemberPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<MemberPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<MemberPost[]>([]);
  const [channels, setChannels] = useState<Space[]>([]);
  const [discoverChannels, setDiscoverChannels] = useState<Space[]>([]);
  const [groups, setGroups] = useState<Space[]>([]);
  const [liveStreams, setLiveStreams] = useState<{ id: string; title: string; viewer_count: number; thumbnail_url: string | null; created_at: string }[]>([]);
  const [viewer, setViewer] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [activityTab, setActivityTab] = useState<ActivityTab>('liked');
  const [editing, setEditing] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [details, setDetails] = useState<ProfileDetails>(DEFAULT_DETAILS);
  const [visibility, setVisibility] = useState<Record<string, Visibility>>(DEFAULT_VISIBILITY);
  const [coverUrl, setCoverUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelPrivacy, setChannelPrivacy] = useState<'public' | 'private'>('public');
  const [creatingChannel, setCreatingChannel] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !key) { setLoading(false); return; }
    setLoading(true);
    const lookupKey = member?.id || key;
    try {
      const sessionResult = await supabase.auth.getSession();
      const current = sessionResult.data.session?.user.id || null;
      setViewer(current);
      const byId = await supabase.from('scn_post_public_profiles').select('id,name,username,avatar,bio').eq('id', lookupKey).maybeSingle();
      const result = byId.data ? byId : await supabase.from('scn_post_public_profiles').select('id,name,username,avatar,bio').eq('username', lookupKey).maybeSingle();
      if (result.error || !result.data) { setMember(null); setPosts([]); setLoading(false); return; }
      const profile = result.data as Member;
      setMember(profile);
      setProfileName(profile.name || '');
      setProfileUsername(profile.username || '');
      setProfileBio(profile.bio || '');

      const [postRows, followerRows, followingRows] = await Promise.all([
        supabase.from('feed_posts').select('id,user_id,user_name,user_avatar,title,content,post_type,media_url,cover_url,link_url,link_platform,quoted_post_id,likes,comments_count,reposts,created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(80),
        supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('target_type', 'user').eq('target_id', profile.id),
        supabase.from('follows').select('target_id', { count: 'exact', head: true }).eq('target_type', 'user').eq('follower_id', profile.id),
      ]);
      const memberPosts = (postRows.data || []) as MemberPost[];
      setPosts(memberPosts);
      setGallery(memberPosts.filter(post => Boolean(post.media_url) && ['image', 'video', 'audio'].includes(post.post_type)));
      setFollowers(followerRows.count || 0);
      setFollowingCount(followingRows.count || 0);

      if (current && current !== profile.id) {
        const edge = await supabase.from('follows').select('target_id').eq('follower_id', current).eq('target_type', 'user').eq('target_id', profile.id).maybeSingle();
        setFollowing(!!edge.data);
      } else setFollowing(false);

      let detailRow: { details?: ProfileDetails; visibility?: Record<string, Visibility>; cover_url?: string | null } | null = null;
      if (current === profile.id) {
        const own = await supabase.from('scn_post_profile_details').select('details,visibility,cover_url').eq('user_id', profile.id).maybeSingle();
        detailRow = own.data as typeof detailRow;
      } else if (current) {
        const followerView = await supabase.from('scn_post_followers_profile_details').select('details,cover_url').eq('user_id', profile.id).maybeSingle();
        if (followerView.data) detailRow = followerView.data as typeof detailRow;
        else {
          const publicView = await supabase.from('scn_post_public_profile_details').select('details,cover_url').eq('user_id', profile.id).maybeSingle();
          detailRow = publicView.data as typeof detailRow;
        }
      } else {
        const publicView = await supabase.from('scn_post_public_profile_details').select('details,cover_url').eq('user_id', profile.id).maybeSingle();
        detailRow = publicView.data as typeof detailRow;
      }
      setDetails({ ...DEFAULT_DETAILS, ...(detailRow?.details || {}) });
      if (detailRow?.visibility) setVisibility({ ...DEFAULT_VISIBILITY, ...detailRow.visibility });
      setCoverUrl(detailRow?.cover_url || '');

      if (current === profile.id) {
        const [likeRows, saveRows] = await Promise.all([
          supabase.from('feed_post_likes').select('post_id').eq('user_id', current).order('created_at', { ascending: false }).limit(80),
          supabase.from('feed_post_saves').select('post_id').eq('user_id', current).order('created_at', { ascending: false }).limit(80),
        ]);
        const likeIds = (likeRows.data || []).map(row => String(row.post_id));
        const saveIds = (saveRows.data || []).map(row => String(row.post_id));
        const [likedResult, savedResult] = await Promise.all([
          likeIds.length ? supabase.from('feed_posts').select('id,user_id,user_name,user_avatar,title,content,post_type,media_url,cover_url,link_url,link_platform,quoted_post_id,likes,comments_count,reposts,created_at').in('id', likeIds) : Promise.resolve({ data: [] as MemberPost[] }),
          saveIds.length ? supabase.from('feed_posts').select('id,user_id,user_name,user_avatar,title,content,post_type,media_url,cover_url,link_url,link_platform,quoted_post_id,likes,comments_count,reposts,created_at').in('id', saveIds) : Promise.resolve({ data: [] as MemberPost[] }),
        ]);
        setLikedPosts(orderedPosts(likeIds, (likedResult.data || []) as MemberPost[]));
        setSavedPosts(orderedPosts(saveIds, (savedResult.data || []) as MemberPost[]));
      } else {
        setLikedPosts([]);
        setSavedPosts([]);
      }

      if (current === profile.id) {
        const [channelMemberships, groupMemberships, liveRows] = await Promise.all([
          supabase.from('scn_post_channel_members').select('channel_id').eq('user_id', profile.id),
          supabase.from('scn_post_group_members').select('group_id').eq('user_id', profile.id),
          supabase.from('user_live_streams').select('id,title,viewer_count,thumbnail_url,created_at').eq('user_id', profile.id).eq('status', 'live').in('privacy', ['public', 'followers']).order('created_at', { ascending: false }).limit(8),
        ]);
        const channelIds = (channelMemberships.data || []).map(row => String(row.channel_id));
        const groupIds = (groupMemberships.data || []).map(row => String(row.group_id));
        const [channelRows, groupRows, publicChannelRows] = await Promise.all([
          channelIds.length ? supabase.from('scn_post_channels').select('id,name,description,privacy,owner_id').in('id', channelIds) : Promise.resolve({ data: [] as Space[] }),
          groupIds.length ? supabase.from('scn_post_groups').select('id,name,description,privacy,owner_id').in('id', groupIds) : Promise.resolve({ data: [] as Space[] }),
          supabase.from('scn_post_channels').select('id,name,description,privacy,owner_id').eq('privacy', 'public').order('created_at', { ascending: false }).limit(24),
        ]);
        setChannels((channelRows.data || []) as Space[]);
        setGroups((groupRows.data || []) as Space[]);
        setDiscoverChannels((publicChannelRows.data || []) as Space[]);
        setLiveStreams((liveRows.data || []) as typeof liveStreams);
      } else {
        const [channelRows, groupRows, liveRows] = await Promise.all([
          supabase.from('scn_post_channels').select('id,name,description,privacy,owner_id').eq('owner_id', profile.id).eq('privacy', 'public').limit(24),
          supabase.from('scn_post_groups').select('id,name,description,privacy,owner_id').eq('owner_id', profile.id).eq('privacy', 'public').limit(24),
          supabase.from('user_live_streams').select('id,title,viewer_count,thumbnail_url,created_at').eq('user_id', profile.id).eq('status', 'live').in('privacy', ['public', 'followers']).order('created_at', { ascending: false }).limit(8),
        ]);
        setChannels((channelRows.data || []) as Space[]);
        setGroups((groupRows.data || []) as Space[]);
        setDiscoverChannels([]);
        setLiveStreams((liveRows.data || []) as typeof liveStreams);
      }
    } catch (error) {
      console.error('Member profile load failed:', error);
      toast.error('Could not load this profile.');
    } finally {
      setLoading(false);
    }
  }, [key, member?.id]);

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

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>, kind: 'avatar' | 'cover') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !supabase || !viewer || !member || viewer !== member.id) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose an image file.'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Images must be 8 MB or smaller.'); return; }
    setUploading(kind);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = viewer + '/profile/' + kind + '-' + crypto.randomUUID() + '.' + extension;
      const uploaded = await supabase.storage.from('kus-images').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (uploaded.error) throw uploaded.error;
      const url = supabase.storage.from('kus-images').getPublicUrl(path).data.publicUrl;
      if (kind === 'avatar') {
        const updated = await supabase.from('profiles').update({ avatar: url }).eq('id', viewer);
        if (updated.error) throw updated.error;
        setMember(current => current ? { ...current, avatar: url } : current);
      } else {
        setCoverUrl(url);
      }
      toast.success(kind === 'avatar' ? 'Profile picture updated.' : 'Cover photo uploaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploading(null);
    }
  };

  const saveProfile = async () => {
    if (!supabase || !member || viewer !== member.id) return;
    setSaving(true);
    try {
      const cleanName = profileName.trim();
      const cleanUsername = profileUsername.trim().replace(/^@/, '');
      if (!cleanName) throw new Error('Display name is required.');
      if (!cleanUsername) throw new Error('Username is required.');
      const profileUpdate = await supabase.from('profiles').update({
        name: cleanName,
        username: cleanUsername,
        bio: profileBio.trim(),
      }).eq('id', member.id);
      if (profileUpdate.error) throw profileUpdate.error;
      const detailUpdate = await supabase.from('scn_post_profile_details').upsert({
        user_id: member.id,
        cover_url: coverUrl || null,
        details,
        visibility,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (detailUpdate.error) throw detailUpdate.error;
      setMember(current => current ? { ...current, name: profileName.trim(), username: profileUsername.trim().replace(/^@/, '') || null, bio: profileBio.trim() } : current);
      setEditing(false);
      toast.success('Profile saved.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const createChannel = async () => {
    if (!supabase || !viewer || !channelName.trim()) return;
    setCreatingChannel(true);
    const result = await supabase.rpc('create_scn_post_channel', {
      p_name: channelName.trim(), p_description: channelDescription.trim(), p_privacy: channelPrivacy,
    });
    if (result.error) toast.error(result.error.message);
    else {
      toast.success('Channel created.');
      setChannelName(''); setChannelDescription('');
      await load();
    }
    setCreatingChannel(false);
  };

  const joinChannel = async (channel: Space) => {
    if (!supabase || !viewer) { toast.error('Sign in to join channels.'); return; }
    const invite = channel.privacy === 'private' ? window.prompt('Enter the channel invite code') : null;
    if (channel.privacy === 'private' && !invite) return;
    const result = await supabase.rpc('join_scn_post_channel', { p_channel_id: channel.id, p_invite_code: invite });
    if (result.error) toast.error(result.error.message);
    else { toast.success('Joined channel.'); await load(); }
  };

  const renderPosts = (items: MemberPost[]) => items.length === 0
    ? <div className="member-state">Nothing to show here yet.</div>
    : <div className="member-post-list">{items.map(post => <article className="member-post" key={post.id}>
      {post.quoted_post_id && <span className="member-quote-label">QUOTE REPOST</span>}
      <Link className="member-post-author" href={'/member/' + post.user_id}><Avatar name={post.user_name} src={post.user_avatar}/><span><b>{post.user_name}</b><small>{new Date(post.created_at).toLocaleString()}</small></span></Link>
      {post.title && <h3>{post.title}</h3>}{post.content && <p>{post.content}</p>}
      {post.quoted_post_id && <QuotedPostPreview postId={post.quoted_post_id}/>}
      {post.media_url && (post.post_type === 'video' ? <video src={post.media_url} poster={post.cover_url || undefined} controls playsInline/> : post.post_type === 'image' ? <img src={post.media_url} alt="Post media"/> : post.post_type === 'audio' ? <audio src={post.media_url} controls/> : null)}
      {post.link_url && <a className="member-external-link" href={post.link_url} target="_blank" rel="noreferrer">{post.link_platform || 'Open link'} ↗</a>}
      <div className="member-post-stats"><span>{post.likes} likes</span><span>{post.comments_count} comments</span><span>{post.reposts} reposts</span><Link href={'/post/' + post.id}>Open post <ArrowUpRight size={13}/></Link></div>
    </article>)}</div>;

  const isOwn = Boolean(member && viewer === member.id);
  const website = details.website ? externalUrl(details.website) : '';
  const visibleDetails = DETAIL_FIELDS.filter(field => Boolean(details[field.key]?.trim()));
  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'posts', label: 'Posts' }, { id: 'gallery', label: 'Gallery' }, { id: 'about', label: 'About' },
    { id: 'activity', label: 'Activity' }, { id: 'spaces', label: 'Channels & groups' }, { id: 'live', label: 'Live' },
  ];

  return <main className="member-page">
    <Toaster richColors position="top-center"/>
    <header className="member-top"><button onClick={() => router.back()}><ArrowLeft size={18}/> Back</button><b>KUS POST</b><Link href="/">Feed <ArrowUpRight size={15}/></Link></header>
    <section className="member-content">
      {loading ? <div className="member-state"><LoaderCircle className="member-spin"/> Loading profile…</div>
        : !member ? <div className="member-state"><b>Member not found</b><p>This profile may be unavailable.</p><Link href="/">Return to feed</Link></div>
        : <>
          <section className="member-hero">
            <div className="member-cover" style={coverUrl ? { backgroundImage: 'linear-gradient(180deg,transparent,rgba(0,0,0,.42)),url("' + coverUrl + '")' } : undefined}>
              {!coverUrl && <span>YOUR STORY, YOUR SPACE</span>}
              {isOwn && editing && <label className="member-cover-upload"><ImagePlus size={15}/> Change cover<input type="file" accept="image/*" onChange={e => void uploadImage(e, 'cover')}/></label>}
            </div>
            <div className="member-identity-row">
              <div className="member-avatar-wrap"><Avatar name={member.name || 'SCN member'} src={member.avatar}/>{isOwn && editing && <label className="member-avatar-upload" title="Change profile picture"><Camera size={15}/><input type="file" accept="image/*" onChange={e => void uploadImage(e, 'avatar')}/></label>}</div>
              <div className="member-identity"><span>MEMBER PROFILE</span><h1>{member.name || 'SCN member'}</h1><p>@{member.username || 'scn-member'}</p><small>{posts.length} posts · {followers} followers · {followingCount} following</small></div>
              <div className="member-actions">
                {isOwn ? <button className="member-primary" onClick={() => setEditing(value => !value)}><Pencil size={15}/>{editing ? 'Close editor' : 'Edit profile'}</button>
                  : <><button className="member-primary" onClick={() => void toggleFollow()} disabled={busy}>{following ? <UserCheck size={15}/> : <UserPlus size={15}/>} {following ? 'Following' : 'Follow'}</button>
                    {viewer && <><a className="member-secondary" href={SCN_BASE_URL + '/call/' + member.id + '?type=audio'}><Phone size={15}/> Audio call</a><a className="member-secondary" href={SCN_BASE_URL + '/call/' + member.id + '?type=video'}><Video size={15}/> Video call</a></>}
                  </>}
              </div>
            </div>
            {member.bio && <p className="member-bio">{member.bio}</p>}
            <div className="member-profile-links">
              {website && <a href={website} target="_blank" rel="noreferrer"><Link2 size={14}/> Website <ExternalLink size={12}/></a>}
              {details.publicEmail && <a href={'mailto:' + details.publicEmail}><Mail size={14}/> Email</a>}
              {details.location && <span><MapPin size={14}/>{details.location}</span>}
            </div>
            {isOwn && <div className="member-owner-shortcuts"><a href={SCN_BASE_URL + '/live'}><Radio size={15}/> Go live with SCN</a><span>SCN provides live audio/video sessions and calls.</span></div>}
          </section>

          {editing && isOwn && <section className="member-editor">
            <div className="member-editor-heading"><div><span>PROFILE SETTINGS</span><h2>Edit your identity</h2></div><button onClick={() => setEditing(false)} aria-label="Close editor"><X size={18}/></button></div>
            <div className="member-editor-grid">
              <label>Display name<input value={profileName} onChange={e => setProfileName(e.target.value)} maxLength={80}/></label>
              <label>Username<input value={profileUsername} onChange={e => setProfileUsername(e.target.value)} maxLength={30}/></label>
              <label className="member-editor-wide">About you<textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} rows={3} maxLength={300}/></label>
              {DETAIL_FIELDS.map(field => <label key={field.key}>{field.label}<textarea rows={field.key === 'work' || field.key === 'education' || field.key === 'business' ? 3 : 2} value={details[field.key] || ''} onChange={e => setDetails(current => ({ ...current, [field.key]: e.target.value }))} placeholder={field.placeholder}/><select value={visibility[field.key] || 'private'} onChange={e => setVisibility(current => ({ ...current, [field.key]: e.target.value as Visibility }))}><option value="public">Public</option><option value="followers">Followers only</option><option value="private">Only me</option></select></label>)}
              <label>Cover photo visibility<select value={visibility.cover || 'public'} onChange={e => setVisibility(current => ({ ...current, cover: e.target.value as Visibility }))}><option value="public">Public</option><option value="followers">Followers only</option><option value="private">Only me</option></select></label>
            </div>
            <div className="member-editor-footer"><span>Private information is stored separately from the public profile.</span><button className="member-primary" onClick={() => void saveProfile()} disabled={saving || uploading !== null}><Save size={15}/>{saving ? 'Saving…' : 'Save changes'}</button></div>
          </section>}

          <nav className="member-tabs" aria-label="Profile sections">{tabs.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>

          {tab === 'posts' && <><div className="member-post-heading"><div><span>PUBLIC ACTIVITY</span><h2>Posts and conversations</h2></div></div>{renderPosts(posts)}</>}
          {tab === 'gallery' && <><div className="member-post-heading"><div><span>YOUR MEDIA</span><h2>Photo, video and audio gallery</h2></div><small>{gallery.length} items</small></div>
            {gallery.length === 0 ? <div className="member-state">Photos, videos and audio posts will appear here.</div> : <div className="member-gallery">{gallery.map(post => <Link href={'/post/' + post.id} key={post.id} className="member-gallery-item">{post.post_type === 'video' ? <><video src={post.media_url || undefined} poster={post.cover_url || undefined} muted playsInline/><span>VIDEO</span></> : post.post_type === 'audio' ? <div className="member-gallery-audio"><Radio size={26}/><span>Audio post</span></div> : <img src={post.media_url || ''} alt="Gallery item"/>}</Link>)}</div>}
          </>}
          {tab === 'about' && <section className="member-about"><div className="member-post-heading"><div><span>PERSONAL & PROFESSIONAL</span><h2>About {member.name}</h2></div></div>
            {visibleDetails.length === 0 ? <div className="member-state">This member hasn't added public information yet.</div> : <div className="member-about-grid">{visibleDetails.map(field => { const Icon = field.icon; return <article key={field.key}><Icon size={18}/><div><b>{field.label}</b>{field.key === 'website' ? <a href={website} target="_blank" rel="noreferrer">{details[field.key]}</a> : field.key === 'publicEmail' ? <a href={'mailto:' + details[field.key]}>{details[field.key]}</a> : <p>{details[field.key]}</p>}</div></article>; })}</div>}
          </section>}
          {tab === 'activity' && <section><div className="member-post-heading"><div><span>YOUR INTERACTIONS</span><h2>{isOwn ? 'Your activity' : 'Public activity'}</h2></div></div>
            {isOwn ? <><div className="member-subtabs"><button className={activityTab === 'liked' ? 'active' : ''} onClick={() => setActivityTab('liked')}><Heart size={14}/> Liked posts</button><button className={activityTab === 'saved' ? 'active' : ''} onClick={() => setActivityTab('saved')}><Bookmark size={14}/> Saved posts</button></div>{renderPosts(activityTab === 'liked' ? likedPosts : savedPosts)}<p className="member-private-note"><Lock size={13}/> Your liked and saved posts are visible only to you.</p></> : <div className="member-state">Only public posts and conversations are shown on this profile.</div>}
          </section>}
          {tab === 'spaces' && <section><div className="member-post-heading"><div><span>YOUR SOCIAL SPACES</span><h2>Channels, communities and groups</h2></div></div>
            {isOwn && <div className="member-channel-create"><h3><Plus size={16}/> Create a channel</h3><input value={channelName} onChange={e => setChannelName(e.target.value)} placeholder="Channel name"/><textarea value={channelDescription} onChange={e => setChannelDescription(e.target.value)} placeholder="What is this channel about?" rows={2}/><div><select value={channelPrivacy} onChange={e => setChannelPrivacy(e.target.value as 'public' | 'private')}><option value="public">Public channel</option><option value="private">Private channel</option></select><button className="member-primary" onClick={() => void createChannel()} disabled={creatingChannel || channelName.trim().length < 2}>{creatingChannel ? 'Creating…' : 'Create channel'}</button></div></div>}
            <h3 className="member-space-title"><Radio size={16}/> Channels</h3>
            <div className="member-space-grid">{channels.map(space => <Link href={'/channel/' + space.id} key={space.id} className="member-space-card"><Radio size={18}/><div><b>{space.name}</b><p>{space.description || 'A channel on KUS Post'}</p><small>{space.privacy === 'private' ? 'Private' : 'Public'} · {space.owner_id === member.id ? 'Owner' : 'Member'}</small></div><ChevronRight size={15}/></Link>)}</div>
            {isOwn && discoverChannels.filter(item => !channels.some(own => own.id === item.id)).length > 0 && <><h4 className="member-space-subtitle">Discover public channels</h4><div className="member-space-grid">{discoverChannels.filter(item => !channels.some(own => own.id === item.id)).map(space => <article key={space.id}><Radio size={18}/><div><b>{space.name}</b><p>{space.description || 'A public channel'}</p></div><button onClick={() => void joinChannel(space)}>Join</button></article>)}</div></>}
            <h3 className="member-space-title"><Users size={16}/> Communities and groups</h3>
            {groups.length ? <div className="member-space-grid">{groups.map(space => <article key={space.id}><Users size={18}/><div><b>{space.name}</b><p>{space.description || 'A community space'}</p><small>{space.privacy === 'private' ? 'Private' : 'Public'}</small></div></article>)}</div> : <div className="member-state">No communities or groups to show yet.</div>}
            {isOwn && <Link className="member-manage-spaces" href="/">Open the community manager <ChevronRight size={15}/></Link>}
          </section>}
          {tab === 'live' && <section><div className="member-post-heading"><div><span>SCN LIVE</span><h2>{isOwn ? 'Your live sessions' : 'Live now'}</h2></div>{isOwn && <a className="member-primary" href={SCN_BASE_URL + '/live'}><Radio size={15}/> Go live</a>}</div>
            {liveStreams.length === 0 ? <div className="member-state">No public live session is running right now.</div> : <div className="member-live-grid">{liveStreams.map(stream => <a href={SCN_BASE_URL + '/live/' + stream.id} key={stream.id} className="member-live-card">{stream.thumbnail_url ? <img src={stream.thumbnail_url} alt="Live cover"/> : <div className="member-live-placeholder"><Radio size={28}/></div>}<span className="member-live-pill">LIVE</span><div><b>{stream.title}</b><small>{stream.viewer_count || 0} watching</small></div></a>)}</div>}
          </section>}
        </>}
    </section>
    <style jsx>{`
      .member-page{min-height:100vh;background:var(--gw-bg,#0c0c12);color:var(--gw-text,#f5f5f7);padding-top:env(safe-area-inset-top);padding-bottom:calc(48px + env(safe-area-inset-bottom))}
      .member-top{height:62px;display:flex;align-items:center;gap:14px;padding:0 max(14px,calc((100vw - 1040px)/2));border-bottom:1px solid var(--gw-line,rgba(255,255,255,.1));position:sticky;top:0;background:var(--gw-glass,rgba(12,12,18,.92));backdrop-filter:blur(18px);z-index:20}
      .member-top b{flex:1;letter-spacing:.16em;font-size:12px}.member-top button,.member-top a{display:flex;align-items:center;gap:7px;color:inherit;background:var(--gw-soft,rgba(255,255,255,.05));border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:10px;padding:9px 12px;text-decoration:none;font-size:12px}
      .member-content{max-width:1040px;margin:22px auto;padding:0 16px}.member-hero,.member-editor,.member-post,.member-about{border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:20px;background:var(--gw-surface,rgba(24,24,34,.88));overflow:hidden}
      .member-cover{height:180px;background:linear-gradient(135deg,#4b2037,#211b2e 58%,#4a3a22);background-position:center;background-size:cover;display:flex;align-items:center;justify-content:center;position:relative;color:rgba(255,255,255,.72);font-size:10px;font-weight:900;letter-spacing:.24em}
      .member-cover-upload{position:absolute;right:14px;bottom:12px;display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:10px;background:rgba(0,0,0,.62);color:#fff;font-size:11px;cursor:pointer}.member-cover-upload input,.member-avatar-upload input{display:none}
      .member-identity-row{display:flex;align-items:center;gap:16px;padding:0 22px;margin-top:-32px;position:relative;flex-wrap:wrap}.member-avatar-wrap{position:relative;flex:none}.member-avatar{width:90px;height:90px;display:grid;place-items:center;overflow:hidden;border-radius:50%;background:#342c3c;border:4px solid var(--gw-surface,#181822);color:#f4d88a;font-size:28px;font-weight:800}.member-avatar img{width:100%;height:100%;object-fit:cover}.member-avatar-upload{position:absolute;right:0;bottom:2px;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:#9e3158;color:white;border:2px solid var(--gw-surface,#181822);cursor:pointer}
      .member-identity{flex:1;min-width:160px;padding-top:37px}.member-identity>span,.member-post-heading span,.member-editor-heading span{font-size:9px;font-weight:900;letter-spacing:.2em;color:var(--gw-wine-2,#e8c66c)}.member-identity h1{font-size:clamp(23px,4vw,34px);margin:4px 0}.member-identity p{color:var(--gw-muted,#c28ca4);font-size:13px;margin:0}.member-identity small{display:block;color:var(--gw-muted,#aaaab7);margin-top:8px;font-size:11px}
      .member-actions{display:flex;gap:8px;flex-wrap:wrap}.member-primary,.member-secondary{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 13px;border:0;border-radius:11px;background:linear-gradient(120deg,#9f3459,#d83b86);color:#fff;font-size:12px;font-weight:750;text-decoration:none;cursor:pointer}.member-secondary{background:var(--gw-soft,rgba(255,255,255,.05));border:1px solid var(--gw-line,rgba(255,255,255,.12));color:var(--gw-text,#fff)}
      .member-bio{margin:13px 22px 0;color:var(--gw-text,#e7e7ee);font-size:14px;line-height:1.65;white-space:pre-wrap}.member-profile-links{display:flex;gap:14px;flex-wrap:wrap;padding:13px 22px 0}.member-profile-links a,.member-profile-links span{display:inline-flex;align-items:center;gap:6px;color:var(--gw-muted,#c9c9d3);font-size:12px;text-decoration:none}.member-profile-links a{color:var(--gw-wine-2,#e8c66c)}.member-owner-shortcuts{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 22px 18px}.member-owner-shortcuts a{display:flex;align-items:center;gap:7px;color:#fff;background:#8d294d;border-radius:10px;padding:9px 12px;text-decoration:none;font-size:12px}.member-owner-shortcuts span{color:var(--gw-muted,#aaaab7);font-size:11px}
      .member-editor{margin-top:15px;padding:20px}.member-editor-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.member-editor-heading h2{font-size:20px;margin:5px 0}.member-editor-heading>button{border:0;background:var(--gw-soft,rgba(255,255,255,.07));color:inherit;border-radius:9px;padding:8px}.member-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.member-editor-grid label{display:grid;gap:7px;color:var(--gw-muted,#c9c9d3);font-size:12px}.member-editor-grid input,.member-editor-grid textarea,.member-editor-grid select,.member-channel-create input,.member-channel-create textarea,.member-channel-create select{width:100%;border:1px solid var(--gw-line,rgba(255,255,255,.13));border-radius:10px;background:var(--gw-soft,rgba(255,255,255,.05));color:var(--gw-text,#fff);padding:10px;font:inherit;font-size:13px}.member-editor-grid select{padding:8px}.member-editor-wide{grid-column:1/-1}.member-editor-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:17px}.member-editor-footer span,.member-private-note{display:flex;align-items:center;gap:6px;color:var(--gw-muted,#aaaab7);font-size:11px}
      .member-tabs{display:flex;gap:5px;overflow-x:auto;margin:16px 0;padding:5px;border-bottom:1px solid var(--gw-line,rgba(255,255,255,.1));scrollbar-width:none}.member-tabs button,.member-subtabs button{white-space:nowrap;border:0;border-radius:10px;background:transparent;color:var(--gw-muted,#aaaab7);padding:10px 13px;font-size:12px;font-weight:700;cursor:pointer}.member-tabs button.active,.member-subtabs button.active{background:var(--gw-soft,rgba(255,255,255,.08));color:var(--gw-text,#fff)}
      .member-post-heading{display:flex;align-items:end;justify-content:space-between;margin:24px 3px 14px}.member-post-heading h2{font-size:21px;margin-top:5px}.member-post-heading small{font-size:11px;color:var(--gw-muted,#aaaab7)}
      .member-post-list{display:grid;gap:13px}.member-post{padding:19px}.member-post-author{display:flex;align-items:center;gap:10px;margin-bottom:14px;color:inherit;text-decoration:none}.member-post-author .member-avatar{width:38px;height:38px;font-size:14px;border-width:1px}.member-post-author span:last-child{display:grid;gap:3px}.member-post-author b{font-size:12px}.member-post-author small{font-size:10px;color:var(--gw-muted,#9999a9)}.member-post h3{font-size:19px;margin:0 0 8px}.member-post>p{font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.member-post>img,.member-post>video{width:100%;max-height:560px;object-fit:contain;border-radius:13px;margin-top:14px;background:#08080d}.member-post>audio{display:block;width:100%;margin-top:14px}.member-post-stats{display:flex;gap:13px;align-items:center;flex-wrap:wrap;margin-top:16px;padding-top:13px;border-top:1px solid var(--gw-line,rgba(255,255,255,.08));font-size:11px;color:var(--gw-muted,#aaaab7)}.member-post-stats a{display:flex;align-items:center;gap:4px;color:var(--gw-wine-2,#f1d88c);text-decoration:none;margin-left:auto}.member-quote-label{font-size:9px;font-weight:900;letter-spacing:.16em;color:var(--gw-wine-2,#e8c66c)}
      .member-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.member-gallery-item{position:relative;aspect-ratio:1;overflow:hidden;border-radius:13px;background:var(--gw-soft,rgba(255,255,255,.05));display:grid;place-items:center}.member-gallery-item img,.member-gallery-item video{width:100%;height:100%;object-fit:cover}.member-gallery-item>span{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.68);color:white;padding:5px 7px;border-radius:7px;font-size:9px}.member-gallery-audio{display:grid;place-items:center;gap:7px;color:var(--gw-wine-2,#e8c66c);font-size:11px}
      .member-about{padding:18px}.member-about-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.member-about-grid article{display:flex;gap:12px;padding:13px;border-radius:13px;background:var(--gw-soft,rgba(255,255,255,.04));color:var(--gw-wine-2,#e8c66c)}.member-about-grid article>div{min-width:0}.member-about-grid b{display:block;color:var(--gw-text,#fff);font-size:12px;margin-bottom:5px}.member-about-grid p,.member-about-grid a{display:block;color:var(--gw-muted,#c9c9d3);font-size:13px;line-height:1.5;overflow-wrap:anywhere;text-decoration:none}
      .member-subtabs{display:flex;gap:6px;margin-bottom:14px}.member-subtabs button{display:flex;align-items:center;gap:7px}.member-private-note{margin-top:13px}
      .member-channel-create{padding:16px;border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:15px;background:var(--gw-surface,rgba(24,24,34,.88));display:grid;gap:10px}.member-channel-create h3{display:flex;align-items:center;gap:7px;font-size:14px}.member-channel-create>div{display:flex;gap:9px}.member-space-title{display:flex;align-items:center;gap:8px;margin:22px 2px 12px;font-size:15px}.member-space-subtitle{font-size:12px;color:var(--gw-muted,#aaaab7);margin:17px 2px 10px}.member-space-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.member-space-grid article,.member-space-card{display:flex;align-items:center;gap:11px;padding:13px;border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:13px;background:var(--gw-surface,rgba(24,24,34,.88));color:var(--gw-wine-2,#e8c66c)}.member-space-card{text-decoration:none}.member-space-grid article>div,.member-space-card>div{flex:1;min-width:0}.member-space-grid b{display:block;color:var(--gw-text,#fff);font-size:12px}.member-space-grid p,.member-space-grid small{display:block;color:var(--gw-muted,#aaaab7);font-size:11px;margin-top:4px}.member-space-grid button{border:0;border-radius:8px;background:#8d294d;color:white;padding:7px 9px;font-size:11px}.member-manage-spaces{display:inline-flex;align-items:center;gap:4px;margin-top:14px;color:var(--gw-wine-2,#e8c66c);font-size:12px;text-decoration:none}
      .member-live-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.member-live-card{position:relative;display:block;overflow:hidden;border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:15px;background:var(--gw-surface,rgba(24,24,34,.88));color:inherit;text-decoration:none}.member-live-card>img,.member-live-placeholder{width:100%;aspect-ratio:16/9;object-fit:cover;background:linear-gradient(135deg,#4b2037,#211b2e);display:grid;place-items:center;color:#fff}.member-live-pill{position:absolute;top:9px;left:9px;border-radius:6px;background:#d42d59;color:white;padding:4px 7px;font-size:9px;font-weight:900}.member-live-card>div:last-child{display:grid;gap:5px;padding:11px}.member-live-card b{font-size:13px}.member-live-card small{font-size:11px;color:var(--gw-muted,#aaaab7)}
      .member-state{min-height:170px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:9px;color:var(--gw-muted,#aaaab7);text-align:center}.member-state b{color:var(--gw-text,#f5f5f7)}.member-state a{color:var(--gw-wine-2,#e8c66c)}.member-spin{animation:member-spin 1s linear infinite}@keyframes member-spin{to{transform:rotate(360deg)}}
      @media(max-width:650px){.member-content{margin:12px auto;padding:0 11px}.member-cover{height:130px}.member-identity-row{padding:0 14px;gap:10px}.member-avatar{width:70px;height:70px}.member-identity{padding-top:34px}.member-actions{width:100%;padding:0 0 4px}.member-actions>*{flex:1}.member-bio{margin:12px 14px 0}.member-profile-links{padding:12px 14px 0}.member-owner-shortcuts{padding:12px 14px 16px}.member-editor-grid,.member-about-grid,.member-space-grid,.member-live-grid{grid-template-columns:1fr}.member-editor{padding:15px}.member-gallery{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.member-post{padding:14px}.member-channel-create>div{flex-wrap:wrap}.member-channel-create>div>*{flex:1}.member-identity-row{align-items:flex-start}.member-identity h1{font-size:22px}}
    `}</style>
    <style jsx global>{`
      .quoted-post-preview{margin-top:14px;border:1px solid var(--gw-line,rgba(255,255,255,.1));border-radius:13px;overflow:hidden}
      .member-page button:disabled{opacity:.55;cursor:not-allowed}
    `}</style>
  </main>;
}
