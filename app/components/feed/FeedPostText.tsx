'use client';
import React from 'react';
/** Ported from SCN's renderer: preserve mention and hashtag highlighting. */
export default function FeedPostText({text}:{text:string}){if(!text)return null;const parts=text.split(/(@[\\w.]+|#[\\w\\u00C0-\\u024F]+)/g);return <p className="post-copy">{parts.map((part,i)=>part.startsWith('@')?<span key={i} className="mention">{part}</span>:part.startsWith('#')?<span key={i} className="hashtag">{part}</span>:<span key={i}>{part}</span>)}</p>;}
