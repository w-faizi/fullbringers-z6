'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, Bell, Check, ChevronDown, Clipboard, Copy, FileText, Heart, HelpCircle, LockKeyhole, RotateCcw, ScanLine, Shield, ShieldAlert, Sparkles, Timer, X } from 'lucide-react'

type Clause = { id: string; text: string; category: string; risk: 'high' | 'medium' | 'safe'; why: string; points: number }
type Analysis = { clauses: Clause[]; score: number; breakdown: Record<string, number>; insights: string[]; price?: number; trialDays?: number; deadlines: { days: number; label: string }[] }
type ChatItem = { role: 'user' | 'assistant'; content: string; clauseId?: string }

const sample = `TERMS OF SERVICE — STREAMLINE+

1. FREE TRIAL. Your membership begins with a 14-day free trial. To avoid being charged, you must cancel at least 24 hours before your trial ends.

2. AUTOMATIC RENEWAL. After your trial, your subscription automatically renews at $18.99 per month. We will charge your payment method monthly until you cancel. You may cancel at any time in your account settings.

3. REFUNDS. Payments are non-refundable except where required by law. We do not provide prorated refunds for partially used billing periods.

4. YOUR PRIVACY. We collect account, device, and viewing information. We may share your personal information with advertising partners and data brokers to personalize offers and measure campaign performance. You can opt out of targeted advertising in Privacy Settings.

5. DISPUTES. Any dispute arising from these terms will be resolved by binding individual arbitration. You waive the right to participate in a class action or jury trial. You may opt out of arbitration within 30 days of creating your account by emailing legal@streamline.example.

6. CHANGES TO THESE TERMS. We may change these terms or the subscription price at any time. Continued use of the service after changes take effect means you accept the updated terms. We will notify you of material changes by email.`

const patterns: { category: string; risk: Clause['risk']; points: number; regex: RegExp; why: string }[] = [
  { category: 'Money', risk: 'high', points: 22, regex: /auto(?:matic)?(?:ally)?\s*renew|automatically renew|until you cancel/ig, why: 'Your subscription keeps charging automatically. You need to cancel before the next billing date to stop future charges.' },
  { category: 'Money', risk: 'high', points: 20, regex: /non[- ]refundable|no refunds?|not provide prorated refunds/ig, why: 'Getting your money back may be difficult, even if you stop using the service.' },
  { category: 'Privacy', risk: 'high', points: 22, regex: /share.{0,80}(?:advertising partners|third parties|data brokers)|sell.{0,50}(?:data|information)/ig, why: 'Your information can be shared outside this service, including with advertising partners or data brokers.' },
  { category: 'Legal rights', risk: 'high', points: 20, regex: /binding individual arbitration|waive.{0,50}(?:class action|jury trial)/ig, why: 'You may lose the ability to bring a dispute to court or join a group lawsuit.' },
  { category: 'Control', risk: 'medium', points: 14, regex: /may change.{0,100}(?:at any time|continued use|accept the updated)/ig, why: 'The company can change the deal, and simply continuing to use the service may count as agreement.' },
  { category: 'Money', risk: 'medium', points: 10, regex: /free trial|cancel.{0,60}(?:before|trial ends)|at least 24 hours/ig, why: 'The free period has a cancellation cutoff. Missing it may trigger a paid subscription.' },
  { category: 'Control', risk: 'safe', points: 0, regex: /cancel at any time|opt out of targeted advertising/ig, why: 'This gives you a clear option to cancel or limit targeted advertising.' },
]
const cleanText = (value: string) => value.replace(/\s+/g, ' ').trim()
function analyze(text: string): Analysis {
  const clauses: Clause[] = []
  const seen = new Set<string>()
  let index = 0
  for (const rule of patterns) {
    rule.regex.lastIndex = 0
    for (const match of text.matchAll(rule.regex)) {
      const start = Math.max(0, text.lastIndexOf('.', match.index ?? 0) + 1)
      const end = text.indexOf('.', (match.index ?? 0) + match[0].length)
      const sentence = cleanText(text.slice(start, end < 0 ? Math.min(text.length, start + 300) : end + 1))
      if (sentence.length < 24 || seen.has(sentence.toLowerCase())) continue
      seen.add(sentence.toLowerCase())
      clauses.push({ id: `clause-${++index}`, text: sentence, category: rule.category, risk: rule.risk, why: rule.why, points: rule.points })
    }
  }
  const priceMatch = text.match(/\$\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s*)?(?:month|monthly)/i) || text.match(/(?:month|monthly).{0,20}\$\s*(\d+(?:\.\d{1,2})?)/i)
  const trialMatch = text.match(/(\d+)[ -]day\s+free trial/i)
  const trialDays = trialMatch ? Number(trialMatch[1]) : undefined
  const price = priceMatch ? Number(priceMatch[1]) : undefined
  const totals = { Money: 0, Privacy: 0, 'Legal rights': 0, Control: 0 }
  clauses.forEach((c) => { if (c.risk !== 'safe') totals[c.category as keyof typeof totals] += c.points })
  const breakdown = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Math.min(100, v)]))
  const score = Math.min(100, Math.round(Object.values(totals).reduce((a, b) => a + b, 0) * 0.72))
  const insights = [
    trialDays ? `Your ${trialDays}-day trial can turn into a paid subscription if you miss the cancellation window.` : clauses.some(c => c.category === 'Money') ? 'Recurring charges or a strict refund policy could make this more expensive than it first appears.' : 'No trial or recurring charge pattern was detected in the text.',
    clauses.some(c => c.category === 'Privacy') ? 'Your information may be shared with advertising partners or data brokers.' : 'No broad data-sharing clause was detected in the text.',
    clauses.some(c => c.category === 'Legal rights') ? 'Disputes may go to individual arbitration instead of court or a class action.' : 'No arbitration clause was detected in the text.',
  ]
  const deadlines: { days: number; label: string }[] = []
  if (trialDays) {
    const hoursBefore = text.match(/cancel.{0,50}?(\d+)\s*hours? before/i)
    const daysBefore = text.match(/cancel.{0,50}?(\d+)\s*days? before/i)
    const leadDays = hoursBefore ? Math.ceil(Number(hoursBefore[1]) / 24) : daysBefore ? Number(daysBefore[1]) : 0
    deadlines.push({ days: Math.max(0, trialDays - leadDays), label: leadDays ? `Cancel at least ${hoursBefore ? `${hoursBefore[1]} hours` : `${leadDays} days`} before trial ends` : 'Cancel before the free trial converts' })
  }
  const arbitrationMatch = text.match(/opt out of arbitration within (\d+) days/i)
  if (arbitrationMatch) deadlines.push({ days: Number(arbitrationMatch[1]), label: 'Arbitration opt-out window closes' })
  return { clauses: clauses.sort((a, b) => (a.risk === 'high' ? -1 : a.risk === 'medium' ? 0 : 1) - (b.risk === 'high' ? -1 : b.risk === 'medium' ? 0 : 1)), score, breakdown, insights, price, trialDays, deadlines }
}
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const deadlineDate = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d }

export default function GuardianPage() {
  const [text, setText] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [chat, setChat] = useState<ChatItem[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [reminders, setReminders] = useState<{ label: string; date: string; days: number }[]>([])
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'clauses' | 'actions'>('clauses')
  const [toast, setToast] = useState('')
  useEffect(() => { try { setReminders(JSON.parse(localStorage.getItem('guardian-reminders') || '[]')); setSaved(localStorage.getItem('guardian-reminders-enabled') === 'true') } catch {} }, [])
  const totalYear = useMemo(() => analysis?.price && analysis.trialDays ? analysis.price * 12 : 0, [analysis])
  const loadSample = () => { setText(sample); setAnalysis(null); setChat([]) }
  const clear = () => { setText(''); setAnalysis(null); setChat([]) }
  const runAnalysis = () => { if (!text.trim()) return; setAnalysis(analyze(text)); setChat([]); setTab('clauses') }
  const updateReminders = (items: typeof reminders) => { setReminders(items); localStorage.setItem('guardian-reminders', JSON.stringify(items)) }
  const addReminder = async (days: number, label: string) => {
    const date = deadlineDate(days)
    const item = { label, date: date.toISOString(), days }
    const next = [...reminders.filter(r => r.label !== label), item]
    updateReminders(next); setToast('Reminder saved to this browser')
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    if ('Notification' in window && Notification.permission === 'granted') {
      window.setTimeout(() => new Notification('T&C Guardian reminder', { body: label }), Math.max(0, date.getTime() - Date.now()))
    }
    window.setTimeout(() => setToast(''), 2600)
  }
  const exportCalendar = (days: number, label: string) => {
    const date = deadlineDate(days)
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const content = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//T&C Guardian//EN\nBEGIN:VEVENT\nUID:${Date.now()}@guardian.local\nDTSTAMP:${stamp(new Date())}\nDTSTART:${stamp(date)}\nSUMMARY:${label}\nDESCRIPTION:Reminder from T&C Guardian. Review your terms and take action.\nEND:VEVENT\nEND:VCALENDAR`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar' })); const a = document.createElement('a'); a.href = url; a.download = 'guardian-deadline.ics'; a.click(); URL.revokeObjectURL(url)
  }
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); setToast('Copied to clipboard'); window.setTimeout(() => setToast(''), 2400) }
  const sendQuestion = async (prompt = question) => {
    if (!prompt.trim() || !analysis) return
    const nextChat: ChatItem[] = [...chat, { role: 'user', content: prompt }]
    setChat(nextChat); setQuestion(''); setBusy(true); setOffline(false)
    try {
      const response = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, question: prompt, clauses: analysis.clauses }) })
      if (!response.ok) throw new Error('Assistant unavailable')
      const payload = await response.json()
      setChat([...nextChat, { role: 'assistant', content: payload.answer, clauseId: payload.clauseId }])
    } catch {
      setOffline(true)
      const q = prompt.toLowerCase()
      const matches = analysis.clauses.filter(c => (q.includes('refund') && c.category === 'Money' && /refund|non-refundable|prorated/i.test(c.text)) || ((q.includes('data') || q.includes('sell') || q.includes('privacy')) && c.category === 'Privacy') || (q.includes('cancel') && c.category === 'Money' && /cancel|renew|trial/i.test(c.text)) || (q.includes('arbitrat') && c.category === 'Legal rights') || c.text.toLowerCase().split(/\W+/).some(w => w.length > 4 && q.includes(w)))
      const cited = matches[0] || analysis.clauses[0]
      const answer = cited ? `From the text: “${cited.text}”\n\n${cited.why}` : 'I could not find a clause in the pasted text that answers that. I won’t guess.'
      setChat([...nextChat, { role: 'assistant', content: answer, clauseId: cited?.id }])
    } finally { setBusy(false) }
  }
  const draftAction = (kind: 'cancel' | 'delete' | 'optout') => {
    const subject = kind === 'cancel' ? 'Cancel my subscription' : kind === 'delete' ? 'Request to delete my personal data' : 'Opt out of arbitration'
    const body = kind === 'cancel' ? `Hello,\n\nPlease cancel my subscription effective immediately and confirm that no further charges will be made. Please also confirm the effective cancellation date.\n\nAccount email: [your email]\n\nThank you` : kind === 'delete' ? `Hello,\n\nI am requesting deletion of the personal information associated with my account, subject to any retention required by law. Please confirm when this request is complete.\n\nAccount email: [your email]\n\nThank you` : `Hello,\n\nI am exercising my right to opt out of the arbitration provision in your Terms of Service. Please confirm receipt of this notice.\n\nAccount email: [your email]\n\nThank you`
    const contact = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
    return `${kind === 'optout' && contact ? `To: ${contact}\n` : ''}Subject: ${subject}\n\n${body}`
  }
  const scrollToClause = (id?: string) => { if (id) { setTab('clauses'); window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80) } }
  return (
    <main className="app-shell">
      <header className="topbar"><a className="brand" href="#top" aria-label="T&C Guardian home"><span className="brand-mark"><Shield size={18} strokeWidth={2.4} /></span><span>T&C <b>Guardian</b></span></a><div className="top-meta"><span className="status-dot" /> PRIVATE BY DESIGN <span className="top-divider" /> <button className="icon-button" title="Your pasted terms stay in this browser" aria-label="Privacy information"><LockKeyhole size={16} /></button></div></header>
      <div className="main-wrap" id="top">
        <section className="hero"><div className="eyebrow"><span className="eyebrow-line" /> THE FINE PRINT, MADE CLEAR</div><h1>Know what you&apos;re<br className="desktop-break" /> <em>really</em> agreeing to.</h1><p className="hero-copy">Paste the terms. We&apos;ll find the traps, do the math, and help you take action.</p>
          <div className="trust-row"><span><ScanLine size={14} /> Rule-based scan</span><span><LockKeyhole size={14} /> Text stays on your device</span><span><Timer size={14} /> Results in seconds</span></div>
        </section>
        <section className="workspace-grid" aria-label="Terms analyzer">
          <div className="input-card"><div className="card-heading"><div><span className="step-label">01 / INPUT</span><h2>Your terms, right here</h2></div><FileText size={19} className="subtle-icon" /></div><label className="sr-only" htmlFor="terms">Paste terms and conditions</label><textarea id="terms" value={text} onChange={e => setText(e.target.value)} placeholder="Paste a Terms & Conditions page, subscription agreement, or privacy policy…" spellCheck={false} /><div className="editor-footer"><span>{text.length.toLocaleString()} characters <span className="tiny-dot">·</span> stays in this browser</span><div className="editor-actions"><button className="text-button" onClick={loadSample}><FileText size={14} /> Load sample</button><button className="text-button" onClick={clear} disabled={!text}><RotateCcw size={14} /> Clear</button><button className="analyze-button" onClick={runAnalysis} disabled={!text.trim()}><ScanLine size={16} /> Analyze <ArrowRight size={15} /></button></div></div></div>
          <aside className="promise-card"><div className="promise-stamp"><Shield size={23} /></div><span className="step-label">A CLEARER READ</span><p>Not a lawyer.<br />Your <i>first line</i> of defense.</p><div className="promise-foot"><span>BUILT FOR THE REST OF US</span><ArrowDown size={14} /></div></aside>
        </section>
        {!analysis ? <section className="preview-strip"><span className="preview-icon"><ScanLine size={17} /></span><div><strong>Your scan, at a glance</strong><p>Risk score · real yearly cost · deadlines · ready-to-send actions</p></div><span className="preview-arrow"><ArrowDown size={16} /></span></section> : <section className="results" aria-live="polite">
          <div className="result-top"><div><span className="step-label">02 / YOUR READOUT</span><h2>Here&apos;s what stands out.</h2></div><div className="result-actions"><button className="outline-button" onClick={() => copy(`T&C Guardian report\nRisk score: ${analysis.score}/100\n\n${analysis.insights.map((v,i)=>`${i+1}. ${v}`).join('\n')}\n\nThis is an explanation tool, not legal advice.`)}><Copy size={14} /> Share report</button><button className="close-button" onClick={() => setAnalysis(null)} aria-label="Close results"><X size={17} /></button></div></div>
          <div className="summary-grid"><div className="score-card"><div className="score-head"><span className="step-label">RISK SCORE</span><span className="score-status"><span className="risk-dot" /> {analysis.score >= 60 ? 'HIGH ATTENTION' : analysis.score >= 30 ? 'TAKE A CLOSER LOOK' : 'LOWER RISK'}</span></div><div className="score-main"><div className="score-number">{analysis.score}<span>/100</span></div><div className="score-gauge" style={{'--score':`${analysis.score}%`} as React.CSSProperties}><ShieldAlert size={23} /></div></div><div className="score-meter"><i style={{width:`${analysis.score}%`}} /></div><div className="breakdown">{Object.entries(analysis.breakdown).map(([name, score]) => <div key={name}><span>{name}</span><span className="break-meter"><i style={{width:`${score}%`}} /></span><b>{score}</b></div>)}</div></div>
            <div className="tldr-card"><div className="tldr-title"><span className="number-tag">3</span><span className="step-label">THINGS YOU MUST KNOW</span><span className="tldr-mark">READ THIS FIRST</span></div><ol>{analysis.insights.map((insight,i)=><li key={i}><span>0{i+1}</span><p>{insight}</p></li>)}</ol></div></div>
          {analysis.price && analysis.trialDays && <div className="money-card"><div className="money-intro"><span className="money-icon"><ArrowDown size={18} /></span><div><span className="step-label">THE MONEY TRAP</span><h3>What the “free” trial really costs</h3><p>After your {analysis.trialDays}-day trial, this rolls into a recurring plan.</p></div></div><div className="money-math"><div><span>MONTHLY</span><strong>{money(analysis.price)}</strong></div><span className="multiply">× 12</span><div><span>YEAR ONE</span><strong className="annual">{money(totalYear)}<small>/ year</small></strong></div></div></div>}
          {analysis.deadlines.length > 0 && <div className="deadline-card"><div className="deadline-head"><div className="deadline-icon"><Bell size={17} /></div><div><span className="step-label">DON&apos;T MISS THE WINDOW</span><h3>Deadlines worth saving</h3></div></div><div className="deadline-list">{analysis.deadlines.map((d,i)=>{ const date=deadlineDate(d.days); return <div className="deadline-row" key={i}><div className="deadline-date"><strong>{date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</strong><span>IN {d.days} DAYS</span></div><div className="deadline-desc"><strong>{d.label}</strong><span>{date.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span></div><button className="deadline-button" onClick={()=>addReminder(d.days,d.label)}><Bell size={14} /> Remind me</button><button className="calendar-button" onClick={()=>exportCalendar(d.days,d.label)} aria-label="Download calendar reminder"><ArrowDown size={15} /></button></div> })}</div><p className="deadline-note">Reminders are saved in this browser. Calendar export works everywhere.</p></div>}
          <section className="details-section"><div className="details-heading"><div><span className="step-label">03 / THE DETAILS</span><h3>Every clause, in plain English.</h3></div><div className="detail-tabs"><button className={tab==='clauses'?'active':''} onClick={()=>setTab('clauses')}>Clauses <span>{analysis.clauses.length}</span></button><button className={tab==='actions'?'active':''} onClick={()=>setTab('actions')}>Take action</button></div></div>
            {tab==='clauses' ? <div className="clause-list">{analysis.clauses.map(c=><article className={`clause-item ${c.risk}`} id={c.id} key={c.id}><div className="clause-marker">{c.risk==='safe'?<Check size={14}/>:<span />}</div><div className="clause-body"><div className="clause-meta"><span className={`risk-label ${c.risk}`}>{c.risk==='safe'?'GOOD TO KNOW':c.risk==='high'?'WATCH OUT':'WORTH NOTING'}</span><span className="clause-category">{c.category}</span></div><blockquote>“{c.text}”</blockquote><p className="clause-explain"><strong>In plain English</strong> {c.why}</p></div><button className="clause-info" aria-label={`Explain ${c.category} clause`} title={c.why}><HelpCircle size={17}/></button></article>)}</div> : <div className="actions-grid">{[{key:'cancel' as const,title:'Cancel subscription',desc:'Stop the recurring charges.',icon:<X size={17}/>},{key:'delete' as const,title:'Delete my data',desc:'Request removal of your personal information.',icon:<LockKeyhole size={17}/>},{key:'optout' as const,title:'Opt out of arbitration',desc:'Use the opt-out window in the terms.',icon:<Shield size={17}/> }].map(a=><div className="action-tile" key={a.key}><div className="action-icon">{a.icon}</div><div><strong>{a.title}</strong><p>{a.desc}</p></div><button onClick={()=>copy(draftAction(a.key))}><Clipboard size={14}/> Copy draft</button></div>)}</div>}</section>
          <section className="guardian-chat"><div className="chat-header"><div className="guardian-avatar"><Shield size={19}/></div><div><span className="step-label">04 / ASK GUARDIAN</span><h3>Your terms, answered.</h3><p>Answers are grounded in the text you pasted. No guessing.</p></div><span className="grounded-label"><span/> TEXT-ONLY</span></div><div className="suggested-questions">{(analysis.clauses.some(c=>c.category==='Money')?['Can I get a refund?','How do I cancel?']:['What are my payment terms?']).concat(analysis.clauses.some(c=>c.category==='Privacy')?['Can they sell my data?']:[]).slice(0,3).map(q=><button key={q} onClick={()=>sendQuestion(q)}>{q}<ArrowRight size={13}/></button>)}</div>{chat.length>0&&<div className="chat-messages">{chat.map((item,i)=><div className={`chat-message ${item.role}`} key={i}><span className="message-role">{item.role==='user'?'YOU':'GUARDIAN'}</span><p>{item.content}</p>{item.clauseId&&<button className="citation-link" onClick={()=>scrollToClause(item.clauseId)}>View cited clause <ArrowRight size={12}/></button>}</div>)}</div>}{offline&&<div className="offline-note">OFFLINE MODE <span>Using rule-based answers from the text you provided.</span></div>}<form className="chat-form" onSubmit={e=>{e.preventDefault();sendQuestion()}}><label htmlFor="ask" className="sr-only">Ask Guardian a question</label><input id="ask" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about refunds, data, cancellation…"/><button type="submit" disabled={busy||!question.trim()}>{busy?'Thinking…':<>Ask <ArrowRight size={15}/></>}</button></form><p className="disclaimer">T&C Guardian explains language, not legal advice. For decisions with legal consequences, consult a qualified professional.</p></section>
        </section>}
        <footer className="page-footer"><span>© 2026 T&C GUARDIAN</span><span>YOUR DATA STAYS YOURS <span className="tiny-dot">·</span> NOT LEGAL ADVICE</span></footer>
      </div>{toast&&<div className="toast" role="status"><Check size={15}/>{toast}</div>}
    </main>
  )
}
