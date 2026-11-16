import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'SCN Post | Stories, ideas and communities',description:'The social publishing companion for Sport-Clan-Nexus.',applicationName:'SCN Post',appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'SCN Post'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#100d18'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
