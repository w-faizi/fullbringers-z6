'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, Bell, Check, Clipboard, Copy, FileText, HelpCircle, LockKeyhole, RotateCcw, ScanLine, Shield, ShieldAlert, Timer, X } from 'lucide-react'
import { getCopy, getSuggestedQuestions, languages, type Language } from '@/lib/language'

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

function getLocalizedInsights(analysis: Analysis, t: ReturnType<typeof getCopy>) {
  return [
    analysis.trialDays ? t.insightTrial.replace('{days}', String(analysis.trialDays)) : analysis.clauses.some(c => c.category === 'Money') ? t.insightMoney : t.insightNoMoney,
    analysis.clauses.some(c => c.category === 'Privacy') ? t.insightPrivacy : t.insightNoPrivacy,
    analysis.clauses.some(c => c.category === 'Legal rights') ? t.insightLegal : t.insightNoLegal,
  ]
}

function getLocalizedWhy(clause: Clause, t: ReturnType<typeof getCopy>) {
  if (clause.why.startsWith('Your subscription keeps')) return t.whyRenew
  if (clause.why.startsWith('Getting your money back')) return t.whyRefund
  if (clause.why.startsWith('Your information can be shared')) return t.whyPrivacy
  if (clause.why.startsWith('You may lose the ability')) return t.whyArbitration
  if (clause.why.startsWith('The company can change')) return t.whyChanges
  if (clause.why.startsWith('The free period')) return t.whyTrial
  return t.whySafe
}

function getLocalizedCategory(category: string, t: ReturnType<typeof getCopy>) {
  if (category === 'Money') return t.categoryMoney
  if (category === 'Privacy') return t.categoryPrivacy
  if (category === 'Legal rights') return t.categoryLegal
  return t.categoryControl
}

function formatDays(days: number, language: Language) {
  const dayNames: Record<Language, string> = { en: 'days', hi: 'दिन', bn: 'দিন', mr: 'दिवस', ta: 'நாட்கள்', te: 'రోజులు', kn: 'ದಿನಗಳು', gu: 'દિવસ', pa: 'ਦਿਨ' }
  return `${days} ${dayNames[language]}`
}

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
  const [language, setLanguage] = useState<Language>('en')
  const t = getCopy(language)
  const suggestedQuestions = getSuggestedQuestions(language)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('guardian-language') as Language | null
      if (stored && languages.some(item => item.code === stored)) setLanguage(stored)
      setReminders(JSON.parse(localStorage.getItem('guardian-reminders') || '[]'))
      setSaved(localStorage.getItem('guardian-reminders-enabled') === 'true')
    } catch {}
  }, [])
  useEffect(() => { document.documentElement.lang = language }, [language])
  const totalYear = useMemo(() => analysis?.price && analysis.trialDays ? analysis.price * 12 : 0, [analysis])
  const loadSample = () => { setText(sample); setAnalysis(null); setChat([]) }
  const clear = () => { setText(''); setAnalysis(null); setChat([]) }
  const runAnalysis = () => { if (!text.trim()) return; setAnalysis(analyze(text)); setChat([]); setTab('clauses') }
  const updateReminders = (items: typeof reminders) => { setReminders(items); localStorage.setItem('guardian-reminders', JSON.stringify(items)) }
  const addReminder = async (days: number, label: string) => {
    const date = deadlineDate(days)
    const item = { label, date: date.toISOString(), days }
    const next = [...reminders.filter(r => r.label !== label), item]
    updateReminders(next); setToast(t.reminderSaved)
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
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); setToast(t.copied); window.setTimeout(() => setToast(''), 2400) }
  const sendQuestion = async (prompt = question) => {
    if (!prompt.trim() || !analysis) return
    const nextChat: ChatItem[] = [...chat, { role: 'user', content: prompt }]
    setChat(nextChat); setQuestion(''); setBusy(true); setOffline(false)
    try {
      const response = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, question: prompt, clauses: analysis.clauses, language }) })
      if (!response.ok) throw new Error('Assistant unavailable')
      const payload = await response.json()
      setChat([...nextChat, { role: 'assistant', content: payload.answer, clauseId: payload.clauseId }])
    } catch {
      setOffline(true)
      const q = prompt.toLowerCase()
      const matches = analysis.clauses.filter(c => (q.includes('refund') && c.category === 'Money' && /refund|non-refundable|prorated/i.test(c.text)) || ((q.includes('data') || q.includes('sell') || q.includes('privacy')) && c.category === 'Privacy') || (q.includes('cancel') && c.category === 'Money' && /cancel|renew|trial/i.test(c.text)) || (q.includes('arbitrat') && c.category === 'Legal rights') || c.text.toLowerCase().split(/\W+/).some(w => w.length > 4 && q.includes(w)))
      const cited = matches[0] || analysis.clauses[0]
      const answer = cited ? `“${cited.text}”\n\n${getLocalizedWhy(cited,t)}` : t.noAnswer
      setChat([...nextChat, { role: 'assistant', content: answer, clauseId: cited?.id }])
    } finally { setBusy(false) }
  }
  const draftAction = (kind: 'cancel' | 'delete' | 'optout') => {
    const subject = kind === 'cancel' ? t.emailCancelSubject : kind === 'delete' ? t.emailDeleteSubject : t.emailOptOutSubject
    const request = kind === 'cancel' ? t.emailCancelBody : kind === 'delete' ? t.emailDeleteBody : t.emailOptOutBody
    const body = `${t.emailHello}\n\n${request}\n\n${t.accountEmail}\n\n${t.thankYou}`
    const contact = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
    return `${kind === 'optout' && contact ? `To: ${contact}\n` : ''}Subject: ${subject}\n\n${body}`
  }
  const scrollToClause = (id?: string) => { if (id) { setTab('clauses'); window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80) } }
  return (
    <main className="app-shell">
      <header className="topbar"><a className="brand" href="#top" aria-label="T&C Guardian home"><span className="brand-mark"><Shield size={18} strokeWidth={2.4} /></span><span>T&C <b>Guardian</b></span></a><div className="top-meta"><span className="status-dot" /> <span>{t.privacy}</span><span className="top-divider" /><label className="language-control"><span className="sr-only">{t.language}</span><select aria-label={t.language} value={language} onChange={event => { const next = event.target.value as Language; setLanguage(next); localStorage.setItem('guardian-language', next) }}>{languages.map(item => <option key={item.code} value={item.code}>{item.native}</option>)}</select></label><button className="icon-button" title={t.staysHere} aria-label={t.privacy}><LockKeyhole size={16} /></button></div></header>
      <div className="main-wrap" id="top">
        <section className="hero"><div className="eyebrow"><span className="eyebrow-line" /> {t.eyebrow}</div><h1>{t.titleLineOne}<br className="desktop-break" /> <em>{t.titleLineTwo}</em></h1><p className="hero-copy">{t.heroCopy}</p>
          <div className="trust-row"><span><ScanLine size={14} /> {t.trustRule}</span><span><LockKeyhole size={14} /> {t.trustDevice}</span><span><Timer size={14} /> {t.trustSpeed}</span></div>
        </section>
        <section className="workspace-grid" aria-label="Terms analyzer">
          <div className="input-card"><div className="card-heading"><div><span className="step-label">{t.stepInput}</span><h2>{t.inputTitle}</h2></div><FileText size={19} className="subtle-icon" /></div><label className="sr-only" htmlFor="terms">{t.inputTitle}</label><textarea id="terms" value={text} onChange={e => setText(e.target.value)} placeholder={t.inputPlaceholder} spellCheck={false} /><div className="editor-footer"><span>{text.length.toLocaleString()} {t.characters} <span className="tiny-dot">·</span> {t.staysHere}</span><div className="editor-actions"><button className="text-button" onClick={loadSample}><FileText size={14} /> {t.sample}</button><button className="text-button" onClick={clear} disabled={!text}><RotateCcw size={14} /> {t.clear}</button><button className="analyze-button" onClick={runAnalysis} disabled={!text.trim()}><ScanLine size={16} /> {t.analyze} <ArrowRight size={15} /></button></div></div></div>
          <aside className="promise-card"><div className="promise-stamp"><Shield size={23} /></div><span className="step-label">{t.asideLabel}</span><p>{t.asideLineOne}<br />{t.asideLineTwo}</p><div className="promise-foot"><span>{t.asideFoot}</span><ArrowDown size={14} /></div></aside>
        </section>
        {!analysis ? <section className="preview-strip"><span className="preview-icon"><ScanLine size={17} /></span><div><strong>{t.scanAtGlance}</strong><p>{t.scanTeaser}</p></div><span className="preview-arrow"><ArrowDown size={16} /></span></section> : <section className="results" aria-live="polite">
          <div className="result-top"><div><span className="step-label">{t.stepReadout}</span><h2>{t.resultHeading}</h2></div><div className="result-actions"><button className="outline-button" onClick={() => copy(`T&C Guardian report\n${t.riskScore}: ${analysis.score}/100\n\n${getLocalizedInsights(analysis,t).map((v,i)=>`${i+1}. ${v}`).join('\n')}\n\n${t.disclaimer}`)}><Copy size={14} /> {t.shareReport}</button><button className="close-button" onClick={() => setAnalysis(null)} aria-label={t.clear}><X size={17} /></button></div></div>
          <div className="summary-grid"><div className="score-card"><div className="score-head"><span className="step-label">{t.riskScore}</span><span className="score-status"><span className="risk-dot" /> {analysis.score >= 60 ? t.highAttention : analysis.score >= 30 ? t.closerLook : t.lowerRisk}</span></div><div className="score-main"><div className="score-number">{analysis.score}<span>/100</span></div><div className="score-gauge" style={{'--score':`${analysis.score}%`} as React.CSSProperties}><ShieldAlert size={23} /></div></div><div className="score-meter"><i style={{width:`${analysis.score}%`}} /></div><div className="breakdown">{Object.entries(analysis.breakdown).map(([name, score]) => <div key={name}><span>{getLocalizedCategory(name,t)}</span><span className="break-meter"><i style={{width:`${score}%`}} /></span><b>{score}</b></div>)}</div></div>
            <div className="tldr-card"><div className="tldr-title"><span className="number-tag">3</span><span className="step-label">{t.mustKnow}</span><span className="tldr-mark">{t.readFirst}</span></div><ol>{getLocalizedInsights(analysis,t).map((insight,i)=><li key={i}><span>0{i+1}</span><p>{insight}</p></li>)}</ol></div></div>
          {analysis.price && analysis.trialDays && <div className="money-card"><div className="money-intro"><span className="money-icon"><ArrowDown size={18} /></span><div><span className="step-label">{t.moneyTrap}</span><h3>{t.moneyTitle}</h3><p>{t.afterTrial.replace('{days}', String(analysis.trialDays))}</p></div></div><div className="money-math"><div><span>{t.monthly}</span><strong>{money(analysis.price)}</strong></div><span className="multiply">× 12</span><div><span>{t.yearOne}</span><strong className="annual">{money(totalYear)}<small>{t.perYear}</small></strong></div></div></div>}
          {analysis.deadlines.length > 0 && <div className="deadline-card"><div className="deadline-head"><div className="deadline-icon"><Bell size={17} /></div><div><span className="step-label">{t.deadlineEyebrow}</span><h3>{t.deadlineTitle}</h3></div></div><div className="deadline-list">{analysis.deadlines.map((d,i)=>{ const date=deadlineDate(d.days); const label=d.label.startsWith('Arbitration')?t.arbitrationDeadline:t.cancelDeadline; return <div className="deadline-row" key={i}><div className="deadline-date"><strong>{date.toLocaleDateString(language==='en'?'en-US':`${language}-IN`,{month:'short',day:'numeric'})}</strong><span>{formatDays(d.days,language)}</span></div><div className="deadline-desc"><strong>{label}</strong><span>{date.toLocaleDateString(language==='en'?'en-US':`${language}-IN`,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span></div><button className="deadline-button" onClick={()=>addReminder(d.days,label)}><Bell size={14} /> {t.remindMe}</button><button className="calendar-button" onClick={()=>exportCalendar(d.days,label)} aria-label={t.calendarExport}><ArrowDown size={15} /></button></div> })}</div><p className="deadline-note">{t.reminderNote}</p></div>}
          <section className="details-section"><div className="details-heading"><div><span className="step-label">{t.stepDetails}</span><h3>{t.clauseTitle}</h3></div><div className="detail-tabs"><button className={tab==='clauses'?'active':''} onClick={()=>setTab('clauses')}>{t.clauses} <span>{analysis.clauses.length}</span></button><button className={tab==='actions'?'active':''} onClick={()=>setTab('actions')}>{t.takeAction}</button></div></div>
            {tab==='clauses' ? <div className="clause-list">{analysis.clauses.map(c=><article className={`clause-item ${c.risk}`} id={c.id} key={c.id}><div className="clause-marker">{c.risk==='safe'?<Check size={14}/>:<span />}</div><div className="clause-body"><div className="clause-meta"><span className={`risk-label ${c.risk}`}>{c.risk==='safe'?t.goodToKnow:c.risk==='high'?t.watchOut:t.worthNoting}</span><span className="clause-category">{getLocalizedCategory(c.category,t)}</span></div><blockquote>“{c.text}”</blockquote><p className="clause-explain"><strong>{t.plainEnglish}</strong> {getLocalizedWhy(c,t)}</p></div><button className="clause-info" aria-label={`${t.plainEnglish}: ${getLocalizedCategory(c.category,t)}`} title={getLocalizedWhy(c,t)}><HelpCircle size={17}/></button></article>)}</div> : <div className="actions-grid">{[{key:'cancel' as const,title:t.cancelAction,desc:t.cancelDescription,icon:<X size={17}/>},{key:'delete' as const,title:t.deleteAction,desc:t.deleteDescription,icon:<LockKeyhole size={17}/>},{key:'optout' as const,title:t.optOutAction,desc:t.optOutDescription,icon:<Shield size={17}/> }].map(a=><div className="action-tile" key={a.key}><div className="action-icon">{a.icon}</div><div><strong>{a.title}</strong><p>{a.desc}</p></div><button onClick={()=>copy(draftAction(a.key))}><Clipboard size={14}/> {t.copyDraft}</button></div>)}</div>}</section>
          <section className="guardian-chat"><div className="chat-header"><div className="guardian-avatar"><Shield size={19}/></div><div><span className="step-label">{t.stepAsk}</span><h3>{t.chatTitle}</h3><p>{t.chatSub}</p></div><span className="grounded-label"><span/> {t.textOnly}</span></div><div className="suggested-questions">{(analysis.clauses.some(c=>c.category==='Money')?[suggestedQuestions.refund,suggestedQuestions.cancel]:[suggestedQuestions.payment]).concat(analysis.clauses.some(c=>c.category==='Privacy')?[suggestedQuestions.privacy]:[]).slice(0,3).map(q=><button key={q} onClick={()=>sendQuestion(q)}>{q}<ArrowRight size={13}/></button>)}</div>{chat.length>0&&<div className="chat-messages">{chat.map((item,i)=><div className={`chat-message ${item.role}`} key={i}><span className="message-role">{item.role==='user'?t.ask.toUpperCase():'GUARDIAN'}</span><p>{item.content}</p>{item.clauseId&&<button className="citation-link" onClick={()=>scrollToClause(item.clauseId)}>{t.viewClause} <ArrowRight size={12}/></button>}</div>)}</div>}{offline&&<div className="offline-note">{t.offlineMode} <span>{t.offlineHelp}</span></div>}<form className="chat-form" onSubmit={e=>{e.preventDefault();sendQuestion()}}><label htmlFor="ask" className="sr-only">{t.chatTitle}</label><input id="ask" value={question} onChange={e=>setQuestion(e.target.value)} placeholder={t.askPlaceholder}/><button type="submit" disabled={busy||!question.trim()}>{busy?'…':<>{t.ask} <ArrowRight size={15}/></>}</button></form><p className="disclaimer">{t.disclaimer}</p></section>
        </section>}
        <footer className="page-footer"><span>{t.footerBrand}</span><span>{t.footerNote}</span></footer>
      </div>{toast&&<div className="toast" role="status"><Check size={15}/>{toast==='Copied to clipboard'?t.copied:toast==='Reminder saved to this browser'?t.reminderSaved:toast}</div>}
    </main>
  )
}
