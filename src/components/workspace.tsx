'use client';
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { defaultQuery, skillCatalog } from '@/lib/profiles';
import type { SearchResponse, SearchInput, Match, Criteria } from '@/lib/types';
const emptySubscribe = () => () => {};
const storageKey = 'talentlens-shortlist-v1';
function getSaved() { try { return localStorage.getItem(storageKey) || '[]'; } catch { return '[]'; } }
function subscribeSaved(callback: () => void) { window.addEventListener('storage', callback); window.addEventListener('shortlist-change', callback); return () => { window.removeEventListener('storage', callback); window.removeEventListener('shortlist-change', callback); }; }
function Icon({name, size=20}: {name: 'search'|'bookmark'|'arrow'|'check'|'close'|'spark'|'sliders'|'pin';size?:number}) {
  const paths = {search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,bookmark:<path d="M6 3h12v18l-6-4-6 4z"/>,arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,check:<path d="m5 12 4 4L19 6"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,spark:<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/></>,sliders:<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>,pin:<><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const suggestions = ['Backend engineers with Python and data pipeline experience', 'React and TypeScript engineers with 3+ years', 'Engineers with Kafka and streaming experience'];
export default function Workspace({initial, initialError, hybridEnabled, llmEnabled}: {initial:SearchResponse; initialError:string; hybridEnabled:boolean; llmEnabled:boolean}) {
  const [query,setQuery] = useState(defaultQuery);
  const [appliedQuery,setAppliedQuery] = useState(defaultQuery);
  const [requiredSkills,setSkills] = useState(['Python']);
  const [prioritySkills,setPriority] = useState<string[]>([]);
  const [minYears,setYears] = useState(0);
  const [mode,setMode] = useState<'keyword'|'hybrid'>('keyword');
  const [result,setResult] = useState(initial);
  const [selected,setSelected] = useState<Match | null>(initial.results[0] ?? null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState(initialError);
  const [notice,setNotice] = useState('');
  const [criteriaNote,setCriteriaNote] = useState('');
  const [view,setView] = useState<'search'|'saved'>('search');
  const [excluded,setExcluded] = useState<string[]>([]);
  const [liked,setLiked] = useState<Match[]>([]);
  const [pendingCriteria,setPending] = useState<Criteria | null>(null);
  const savedRaw = useSyncExternalStore(subscribeSaved,getSaved,()=>'[]');
  const mounted = useSyncExternalStore(emptySubscribe,()=>true,()=>false);
  let saved: Match[] = [];
  try { const parsed = JSON.parse(savedRaw); if (Array.isArray(parsed)) saved = parsed.filter(v => v?.profile?.id && Array.isArray(v.evidence) && Array.isArray(v.missing)); } catch {}
  function toggleSaved(match:Match) {
    const exists = saved.some(s=>s.profile.id===match.profile.id);
    try { localStorage.setItem(storageKey,JSON.stringify(exists ? saved.filter(s=>s.profile.id!==match.profile.id) : [...saved,match])); window.dispatchEvent(new Event('shortlist-change')); setNotice(exists ? 'Removed from your shortlist.' : 'Saved to your shortlist on this device.'); }
    catch { setError('Your browser could not save the shortlist. Check available storage.'); }
  }
  async function runSearch(overrides: Partial<SearchInput> = {}) {
    setBusy(true); setError(''); setNotice('');
    const input = {query,mode,requiredSkills,prioritySkills,minYears,excludedIds:excluded,...overrides};
    try {
      const res = await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setResult(data); setSelected(data.results[0]??null); setAppliedQuery(input.query); setView('search');
    } catch(e) {setError(e instanceof Error?e.message:'Search failed.');}
    finally {setBusy(false);}
  }
  async function interpret(text=query) {
    setQuery(text); setBusy(true); setError(''); setPending(null);
    try {const res = await fetch('/api/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:text})}); const data = await res.json(); if(!res.ok) throw new Error(data.error); setPending(data.criteria); setCriteriaNote(`${data.interpreter} interpretation · ${data.criteria.summary}`);}
    catch(e) {setError(e instanceof Error?e.message:'Could not interpret search.');}
    finally {setBusy(false);}
  }
  const skillCounts = new Map<string,number>();
  liked.forEach(m=>m.profile.skills.forEach(s=> { if(!requiredSkills.includes(s)&&!prioritySkills.includes(s)) skillCounts.set(s,(skillCounts.get(s)||0)+1); }));
  const proposed = [...skillCounts].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([s])=>s);
  const visible = view==='saved' ? saved : result.results.filter(m=>!excluded.includes(m.profile.id));
  const detail = selected && visible.find(m=>m.profile.id===selected.profile.id) || visible[0];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark"><Icon name="search" size={24}/></span>talentlens<span className="brand-dot">.</span></Link>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Workspace"><button className={view==='search'?'nav-item active':'nav-item'} onClick={()=>setView('search')}><Icon name="search"/>Discover talent</button><button className={view==='saved'?'nav-item active':'nav-item'} onClick={()=>setView('saved')}><Icon name="bookmark"/>Shortlist <span className="count">{saved.length}</span></button></nav>
      <div className="sidebar-bottom"><span className="eyebrow">PORTFOLIO LAB</span><h3>A little more signal.</h3><p>Search, inspect the evidence, and refine what matters.</p><div className="data-label"><span className="status-dot"/>360 synthetic profiles</div><p className="small">All people, companies, and résumés in this demo are fictional.</p></div>
    </aside>
    <main>
      <header className="topbar"><div>Workspace <span>/</span> <strong>{view==='saved'?'Shortlist':'Discover'}</strong></div><span className="mode-badge"><span className="status-dot"/>{result.backend==='demo'?'Demo · local keyword search':'OpenSearch backend'}</span></header>
      <div className="content">
        <div className="heading-row"><div><div className="eyebrow">TALENT DISCOVERY</div><h1>{view==='saved'?'Your shortlist':'Find the experience that matters.'}</h1><p>{view==='saved'?'Profiles you saved on this device.':'Start with a brief. Follow the evidence.'}</p></div><span className="edition">01 / SEARCH LAB</span></div>
        {view==='search' && <>
          <form className="search-box" onSubmit={e=>{e.preventDefault();void interpret();}}><Icon name="spark" size={24}/><label className="sr-only" htmlFor="query">Describe the experience you need</label><input id="query" value={query} maxLength={1000} onChange={e=>{setQuery(e.target.value);setPending(null);}} placeholder="Describe the experience you need…" required/><button className="primary" disabled={busy}>{busy?'Working…':'Interpret brief'}<Icon name="arrow" size={17}/></button></form>
          <div className="suggestions"><span>TRY A BRIEF</span>{suggestions.slice(1).map((s,i)=><button key={s} disabled={busy} onClick={()=>void interpret(s)}>{i===0?'React + TypeScript':'Kafka + streaming'} ↗</button>)}</div>
          {pendingCriteria && <section className="interpretation" aria-label="Review interpreted criteria"><div><strong>Review your search criteria</strong><p>{criteriaNote}</p><div className="chips">{pendingCriteria.requiredSkills.map(s=><span className="chip" key={s}>{s}</span>)}<span className="chip">{pendingCriteria.minYears}+ years</span></div></div><button className="primary" disabled={busy} onClick={()=>{setSkills(pendingCriteria.requiredSkills);setYears(pendingCriteria.minYears);setPriority([]);setLiked([]);setExcluded([]);setPending(null);void runSearch({requiredSkills:pendingCriteria.requiredSkills,minYears:pendingCriteria.minYears,prioritySkills:[],excludedIds:[]});}}>Apply & search <Icon name="arrow" size={16}/></button><button className="text-button" onClick={()=>setPending(null)}>Dismiss</button></section>}
          <section className="filters" aria-label="Search criteria"><div className="filter-title"><Icon name="sliders" size={17}/><strong>Must have</strong></div><div className="chips">{requiredSkills.map(s=><button className="chip removable" key={s} onClick={()=>setSkills(requiredSkills.filter(v=>v!==s))} aria-label={`Remove required skill ${s}`}>{s}<Icon name="close" size={12}/></button>)}<select aria-label="Add required skill" value="" onChange={e=>{if(e.target.value && requiredSkills.length<12)setSkills([...requiredSkills,e.target.value]);}}><option value="">+ Add skill</option>{skillCatalog.filter(s=>!requiredSkills.includes(s)).map(s=><option key={s}>{s}</option>)}</select></div><label className="years-label">Experience <select aria-label="Minimum years of experience" value={minYears} onChange={e=>setYears(Number(e.target.value))}>{[...new Set([0,1,2,3,5,8,10,minYears])].sort((a,b)=>a-b).map(n=><option value={n} key={n}>{n===0?'Any':`${n}+ years`}</option>)}</select></label><button className="outline" disabled={busy || !query.trim()} onClick={()=>{setPending(null);void runSearch();}}>Update results</button></section>
          {prioritySkills.length>0&&<div className="priority-row">Prioritizing {prioritySkills.map(s=><button className="chip removable" key={s} onClick={()=>setPriority(prioritySkills.filter(v=>v!==s))}>{s}<Icon name="close" size={12}/></button>)}<span>Use Update results after editing.</span></div>}
          {proposed.length>0&&<section className="feedback-banner"><Icon name="spark"/><div><strong>A pattern in your feedback</strong><p>Your relevant profiles include {proposed.join(' and ')}. Prioritize these skills?</p></div><button className="outline" disabled={busy} onClick={()=>{const next=[...new Set([...prioritySkills,...proposed])].slice(0,12);setPriority(next);void runSearch({prioritySkills:next});}}>Apply refinement</button></section>}
        </>}
        <div aria-live="polite">{error&&<div className="error" role="alert">{error} <span>Previous results are unchanged.</span></div>}{notice&&<div className="notice">{notice}</div>}</div>
        <div className="results-toolbar"><div><strong>{view==='saved'?`${visible.length} saved profiles`:`${visible.length} profiles shown`}</strong>{view==='search'&&<span>from {result.total} retrieved · {result.elapsedMs} ms</span>}</div>{view==='search'&&<label className="search-method">Search method <select value={mode} onChange={e=>setMode(e.target.value as 'keyword'|'hybrid')}><option value="keyword">Keyword</option><option value="hybrid" disabled={!hybridEnabled}>Hybrid{!hybridEnabled?' · setup required':''}</option></select></label>}</div>
        {view==='search'&&<div className="applied-query">Results for “{appliedQuery}”{excluded.length>0&&<button disabled={busy} onClick={()=>{setExcluded([]);void runSearch({excludedIds:[]});}}>Restore {excluded.length} hidden</button>}</div>}
        <div className="results-layout" aria-busy={busy}>
          <section className="result-list" aria-label="Candidate results">
            {visible.length===0&&<div className="empty"><Icon name={view==='saved'?'bookmark':'search'} size={32}/><h2>{view==='saved'?'Make room for your next great find.':'No profiles match this search.'}</h2><p>{view==='saved'?'Save a profile from Discover to keep it here.':'Try fewer required skills, a broader brief, or a lower experience minimum.'}</p><button className="outline" onClick={()=>{if(view==='saved')setView('search');else{setSkills([]);setYears(0);setExcluded([]);void runSearch({requiredSkills:[],minYears:0,excludedIds:[]});}}}>{view==='saved'?'Discover talent':'Clear filters & retry'}</button></div>}
            {visible.map((match,index)=>{const p=match.profile;const isSaved=saved.some(s=>s.profile.id===p.id);return <article key={p.id} className={`candidate-card ${detail?.profile.id===p.id?'selected':''}`}>
              <div className="card-top"><span className={`avatar color-${index%4}`}>{p.name.split(' ').map(s=>s[0]).join('')}</span><button className="profile-name" onClick={()=>setSelected(match)}><h2>{p.name}</h2><span>{p.title} <span className="at">at</span> {p.company}</span></button><button className={`icon-button ${isSaved?'saved':''}`} aria-label={`${isSaved?'Unsave':'Save'} ${p.name}`} aria-pressed={isSaved} onClick={()=>toggleSaved(match)}><Icon name="bookmark"/></button></div>
              <div className="candidate-meta"><span><Icon name="pin" size={14}/>{p.location}</span><span>{p.years} years experience</span></div><div className="chips">{p.skills.map(s=><span className={requiredSkills.includes(s)?'skill matched':'skill'} key={s}>{requiredSkills.includes(s)&&<Icon name="check" size={12}/>} {s}</span>)}</div>
              <div className="evidence-preview"><span className="evidence-label"><Icon name="check" size={14}/>PROFILE EVIDENCE</span><p>{match.evidence[0]?.excerpt||p.experience[0]}</p></div><div className="card-bottom"><button className="text-button" onClick={()=>setSelected(match)}>Inspect profile <Icon name="arrow" size={15}/></button><span className="rank">#{index+1} in this view</span></div>
            </article>;})}
          </section>
          {detail&&<aside className="detail-panel" aria-label={`Profile details for ${detail.profile.name}`}><div className="detail-heading"><span className="eyebrow">THE EVIDENCE</span><span className="synthetic">SYNTHETIC</span></div><h2>{detail.profile.name}</h2><p className="detail-role">{detail.profile.title}</p><p>{detail.profile.summary}</p><div className="divider"/><h3>Why this profile surfaced</h3><p className="small">Excerpts from the résumé, linked to your search criteria.</p>{detail.evidence.length===0?<p className="small">Keyword overlap with your brief. No explicit skill criteria were recognized.</p>:detail.evidence.map(e=><div className="evidence-item" key={e.skill}><strong><Icon name="check" size={15}/>{e.skill}</strong><blockquote>“{e.excerpt}”</blockquote><span className="source">{e.source}</span></div>)}{detail.missing.length>0&&<div className="missing"><strong>No listed evidence for</strong><p>{detail.missing.join(', ')}</p><span>Missing evidence does not prove a lack of experience.</span></div>}<details><summary>Read full experience</summary>{detail.profile.experience.map((e,i)=><p className="experience-text" key={i}>{e}</p>)}<span className="source">Source: {detail.profile.source}</span></details><div className="divider"/><h3>Useful for this search?</h3><p className="small">Feedback suggests skills to prioritize. You decide what changes.</p><div className="feedback-actions"><button className="outline" disabled={liked.some(m=>m.profile.id===detail.profile.id)} onClick={()=>{setLiked([...liked,detail]);setNotice('Marked relevant. Review the suggested refinement above.');}}><Icon name="check" size={16}/>{liked.some(m=>m.profile.id===detail.profile.id)?'Relevant':'Relevant'}</button><button className="outline" disabled={view==='saved'} onClick={()=>{setExcluded([...new Set([...excluded,detail.profile.id])]);setLiked(liked.filter(m=>m.profile.id!==detail.profile.id));setNotice('Hidden from this search. Use Restore hidden to undo.');}}><Icon name="close" size={16}/>Not relevant</button></div></aside>}
        </div>
        <footer><span>{result.method}</span><span>{llmEnabled?'LLM interpretation enabled':'Rule-based interpretation'} · {mounted?'Shortlist saved on this device':'Local shortlist'}</span></footer>
      </div>
    </main>
  </div>;
}
