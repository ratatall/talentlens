import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'TalentLens — Evidence-first talent discovery', description: 'Search synthetic candidate profiles, inspect source evidence, and refine your search with explicit feedback.' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
