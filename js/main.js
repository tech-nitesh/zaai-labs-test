/* =========================================================
   ZAAI LABS — UI, GSAP animations, interactions
   ========================================================= */
import { createScene } from './scene.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ---------------- Preloader ---------------- */
const loader = $('#loader');
const loaderBar = $('#loader-progress');
let fake = 0;
const loaderTimer = setInterval(() => { fake = Math.min(fake + Math.random() * 18, 90); loaderBar.style.width = fake + '%'; }, 120);

/* ---------------- 3D Scene ---------------- */
let scene3d = null;
try {
  scene3d = createScene($('#webgl'));
} catch (err) {
  console.warn('WebGL unavailable, using static background.', err);
  $('#webgl').style.background = 'radial-gradient(ellipse at 70% 30%, rgba(0,240,255,.15), transparent 60%), #07090E';
}

function finishLoading() {
  clearInterval(loaderTimer);
  loaderBar.style.width = '100%';
  setTimeout(() => { loader.classList.add('done'); heroIntro(); }, 250);
}
if (document.readyState === 'complete') finishLoading();
else { window.addEventListener('load', finishLoading, { once: true }); setTimeout(() => !loader.classList.contains('done') && finishLoading(), 3500); }

/* ---------------- Hero intro ---------------- */
let introPlayed = false;
function heroIntro() {
  if (introPlayed) return; introPlayed = true;
  if (!gsap || reduced) return;
  gsap.from('.reveal-hero', { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 });
  gsap.from('#navbar nav', { y: -30, opacity: 0, duration: 1, ease: 'expo.out' });
}

/* ---------------- Mode switcher ---------------- */
const hudState = $('#hud-state');
function setMode(mode) {
  const ind = mode === 'industrial';
  document.body.classList.toggle('mode-industrial', ind);
  $$('.mode-opt').forEach((b) => { const on = b.dataset.mode === mode; b.classList.toggle('active', on); b.setAttribute('aria-checked', on); });
  hudState.textContent = ind ? 'OT/IT · GEAR SYNC' : 'NEURAL / SYNTH';
  $('#hud-nodes').textContent = ind ? '128 PLC TAGS' : '4,096';
  scene3d?.setMode(mode);
}
$$('.mode-opt').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('.mode-track').addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
    const next = document.body.classList.contains('mode-industrial') ? 'creative' : 'industrial';
    setMode(next); $(`[data-mode="${next}"]`).focus();
  }
});
// Fun HUD ticker
setInterval(() => { $('#hud-num').textContent = (96 + Math.random() * 3.8).toFixed(1); }, 1600);

/* ---------------- Navbar ---------------- */
const navbar = $('#navbar');
const onScrollNav = () => navbar.classList.toggle('scrolled', window.scrollY > 30);
window.addEventListener('scroll', onScrollNav, { passive: true }); onScrollNav();

const menuBtn = $('#menu-toggle'), mobileMenu = $('#mobile-menu');
menuBtn.addEventListener('click', () => {
  const open = menuBtn.getAttribute('aria-expanded') === 'true';
  menuBtn.setAttribute('aria-expanded', !open);
  mobileMenu.hidden = open;
});
$$('a', mobileMenu).forEach((a) => a.addEventListener('click', () => { mobileMenu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }));

const navLinks = $$('.nav-link');
const spy = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) navLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
['verticals', 'industrial', 'packages', 'process', 'portfolio', 'founders', 'contact'].forEach((id) => spy.observe(document.getElementById(id)));

/* ---------------- Scroll → 3D camera ---------------- */
if (scene3d) {
  if (ScrollTrigger) {
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => scene3d.setScroll(self.progress) });
    ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom top', onUpdate: (self) => scene3d.setHero(self.progress) });
  } else {
    window.addEventListener('scroll', () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      scene3d.setScroll(scrollY / max); scene3d.setHero(Math.min(scrollY / innerHeight, 1));
    }, { passive: true });
  }
  // Auto-tint the 3D world amber while the Industrial section is in view
  let userMode = 'creative';
  $$('.mode-opt').forEach((b) => b.addEventListener('click', () => (userMode = b.dataset.mode)));
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting) scene3d.setMode('industrial');
    else scene3d.setMode(userMode);
  }, { rootMargin: '-35% 0px -35% 0px' }).observe($('#industrial'));
}

/* ---------------- Scroll reveals ---------------- */
if (gsap && ScrollTrigger && !reduced) {
  gsap.set('.reveal', { opacity: 0, y: 50 });
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.09, overwrite: 'auto' }),
  });

  gsap.fromTo('.showcase-frame img', { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: '.showcase-frame', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.showcase-chip', { scale: 0.6, opacity: 0, stagger: 0.15, duration: 0.9, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.showcase-frame', start: 'top 70%' } });

  // Timeline progress line + nodes
  gsap.to('#tl-progress', { height: '100%', ease: 'none', scrollTrigger: { trigger: '#timeline', start: 'top 65%', end: 'bottom 55%', scrub: 0.6 } });
  $$('.tl-step').forEach((step, i) => {
    gsap.from($('.tl-card', step), {
      opacity: 0, x: window.innerWidth < 768 ? 40 : (i % 2 ? -80 : 80), rotationY: i % 2 ? 18 : -18, transformPerspective: 900, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: step, start: 'top 80%' },
    });
    gsap.from($('.tl-node', step), { scale: 0, duration: 0.8, ease: 'back.out(2)', scrollTrigger: { trigger: step, start: 'top 75%' } });
  });

  // Section titles: subtle depth on scroll
  $$('.section-title').forEach((t) => gsap.fromTo(t, { rotationX: 25, transformPerspective: 800 }, { rotationX: 0, ease: 'none', scrollTrigger: { trigger: t, start: 'top bottom', end: 'top 55%', scrub: true } }));
}

/* ---------------- Counters ---------------- */
const counterObs = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target; const end = +el.dataset.count; const suf = el.dataset.suffix || '';
    if (gsap && !reduced) {
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v) + suf) });
    } else el.textContent = end + suf;
    counterObs.unobserve(el);
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => counterObs.observe(el));

/* ---------------- 3D Tilt ---------------- */
function bindTilt(el) {
  const max = +(el.dataset.tiltMax || 10);
  if (!finePointer || reduced || !gsap) {
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`); });
    return;
  }
  gsap.set(el, { transformPerspective: 1000 });
  const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
  const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
  const sc = gsap.quickTo(el, 'scale', { duration: 0.6, ease: 'power3.out' });
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    rx((0.5 - y) * max * 2); ry((x - 0.5) * max * 2); sc(1.015);
    el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
  });
  el.addEventListener('pointerleave', () => { rx(0); ry(0); sc(1); });
}
$$('[data-tilt]').forEach(bindTilt);

/* ---------------- Verticals filter ---------------- */
const tabs = $$('.tab');
const cards = $$('#bento .card');
let currentGroup = 'p1';
function showGroup(group) {
  if (group === currentGroup) return;
  const out = cards.filter((c) => c.dataset.group === currentGroup);
  const inn = cards.filter((c) => c.dataset.group === group);
  currentGroup = group;
  tabs.forEach((t) => { const on = t.dataset.filter === group; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
  const swapIn = () => {
    out.forEach((c) => (c.hidden = true));
    inn.forEach((c) => (c.hidden = false));
    if (gsap && !reduced) {
      gsap.fromTo(inn, { opacity: 0, y: 40, rotationX: -20, transformPerspective: 1000 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07, clearProps: 'opacity,y' });
    }
    ScrollTrigger?.refresh();
  };
  if (gsap && !reduced) gsap.to(out, { opacity: 0, y: -20, scale: 0.97, duration: 0.25, stagger: 0.03, ease: 'power2.in', onComplete: () => { gsap.set(out, { clearProps: 'opacity,y,scale' }); swapIn(); } });
  else swapIn();
}
tabs.forEach((t) => t.addEventListener('click', () => showGroup(t.dataset.filter)));
$('#nav-industrial').addEventListener('click', () => showGroup('p3'));

/* ---------------- Live OEE demo panel ---------------- */
const bars = $('#oee-bars');
for (let i = 0; i < 28; i++) bars.appendChild(document.createElement('i'));
const barEls = $$('i', bars);
function updateOEE() {
  barEls.forEach((b) => { const v = 35 + Math.random() * 65; b.style.height = v + '%'; b.classList.toggle('down', v < 42); });
  const a = 0.88 + Math.random() * 0.06, p = 0.84 + Math.random() * 0.07, q = 0.96 + Math.random() * 0.03;
  [[a, 'avail'], [p, 'perf'], [q, 'qual']].forEach(([v, k]) => { const g = $(`.gauge[data-key="${k}"]`); g.style.setProperty('--v', v); $('b', g).textContent = Math.round(v * 100) + '%'; });
  $('#oee-total').textContent = (a * p * q * 100).toFixed(1) + '%';
}
let oeeTimer = null;
new IntersectionObserver(([en]) => {
  if (en.isIntersecting && !oeeTimer) { updateOEE(); oeeTimer = setInterval(updateOEE, 1800); }
  else if (!en.isIntersecting && oeeTimer) { clearInterval(oeeTimer); oeeTimer = null; }
}).observe($('.oee-panel'));
setInterval(() => { $('#oee-clock').textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dubai' }) + ' GST'; }, 1000);

/* ---------------- Package configurators ---------------- */
function bindSeg(card, attr, fn) {
  const opts = $$(`.seg-opt[data-${attr}]`, card);
  opts.forEach((o) => o.addEventListener('click', () => {
    opts.forEach((x) => { x.classList.toggle('active', x === o); x.setAttribute('aria-checked', x === o); });
    fn(o.dataset[attr]);
  }));
}
function bump(el, val) {
  el.textContent = val;
  if (gsap && !reduced) gsap.fromTo(el, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
}
bindSeg($('#pkg-reels'), 'videos', (v) => { bump($('#m-assets'), v * 4); bump($('#m-hooks'), v * 3); });
const siteData = { landing: ['1–2', '2–3'], business: ['5–8', '4–6'], '3d': ['8–12', '6–10'] };
bindSeg($('#pkg-web'), 'site', (v) => { bump($('#m-pages'), siteData[v][0]); bump($('#m-weeks'), siteData[v][1]); });
$('#care-toggle').addEventListener('change', (e) => $$('[data-care]').forEach((li) => li.classList.toggle('off', !e.target.checked)));
const discData = {
  ai: { maps: '6+', out: '1', list: ['Process mapping workshops', 'Automation opportunity scoring', 'KPI architecture', 'Prototype & fixed-scope roadmap'] },
  erp: { maps: '10+', out: '3', list: ['Current-state ERP & workflow audit', 'Vendor shortlist & fit-gap analysis', 'Work order / inventory / purchasing design', 'Implementation roadmap & budget'] },
  mes: { maps: '1 line', out: 'OEE', list: ['Plant site survey & machine inventory', 'OT/IT security review', 'OEE & downtime KPI architecture', 'Live dashboard prototype roadmap'] },
};
bindSeg($('#pkg-discovery'), 'disc', (v) => {
  const d = discData[v]; bump($('#m-maps'), d.maps); bump($('#m-out'), d.out);
  $('#disc-list').innerHTML = d.list.map((t) => `<li>${t}</li>`).join('');
  if (gsap && !reduced) gsap.from('#disc-list li', { x: -12, opacity: 0, stagger: 0.06, duration: 0.4 });
});

/* ---------------- Portfolio dialog ---------------- */
const cases = [
  { img: 'digital_twin', tag: 'INDUSTRIAL TECHNICAL MEDIA', title: 'AI Industrial Machine Demo & HSE Training Video', desc: 'A digital-twin style machine walkthrough with telemetry overlays and HSE safety callouts — produced as a multilingual training asset for operators and a sales demo for distributors.', pts: [['FORMAT', '3D explainer + HSE module'], ['LANGUAGES', 'EN · AR · HI'], ['USE', 'Training · Sales · Trade shows']] },
  { img: 'industrial_mes', tag: 'MES · SHOP-FLOOR', title: 'Real-Time Factory OEE & MES Shop-Floor Dashboard', desc: 'Machine signals bridged from the shop floor into a live OEE dashboard with downtime reason codes, shift reports and quality traceability — after an OT/IT security review.', pts: [['KPIs', 'OEE · Downtime · Scrap'], ['DATA', 'PLC / IoT → MES → BI'], ['USERS', 'Operators to owners']] },
  { img: 'ai_video_reels', tag: 'REELS · YOUTUBE', title: 'Viral B2B Founder Reels & YouTube Growth System', desc: 'A monthly founder-led content engine: scripting, hook testing, AI-assisted editing and repurposing across Reels, Shorts, TikTok and LinkedIn — plus a YouTube channel built for B2B trust.', pts: [['CADENCE', '12 videos / month'], ['PLATFORMS', 'IG · YT · TikTok · LI'], ['SYSTEM', 'Hooks → Edit → Analyse']] },
  { img: 'ai_automation', tag: 'AGENTIC AI', title: 'Automated Lead-to-CRM AI Agent Workflow', desc: 'An AI agent that captures leads from web, WhatsApp and email, qualifies them, enriches records and books meetings in the CRM — with human-in-the-loop approval on every outbound message.', pts: [['CHANNELS', 'Web · WhatsApp · Email'], ['SAFETY', 'Human approval gates'], ['OUTPUT', 'CRM + sales dashboard']] },
  { img: 'hero_showcase', tag: '3D WEB', title: '3D Interactive Corporate Website for UAE Contractor', desc: 'A WebGL-powered corporate website showcasing projects, capabilities and certifications — tuned for mobile speed, local UAE SEO and lead capture, with a monthly care plan.', pts: [['STACK', 'Three.js · GSAP · CMS'], ['SEO', 'UAE / GCC local'], ['CARE', 'Uptime · Security · Updates']] },
  { img: 'podcast_studio', tag: 'PODCAST', title: 'Executive B2B Podcast & Content Repurposing Engine', desc: 'A studio-grade executive podcast where every episode becomes 20–30 assets: clips, quote cards, blogs, newsletters and show notes — distributed on a fixed monthly calendar.', pts: [['PER EPISODE', '20–30 assets'], ['OUTPUT', 'Clips · Blogs · Notes'], ['GOAL', 'Authority + pipeline']] },
];
const dialog = $('#case-dialog');
$$('.pf-card').forEach((card) => card.addEventListener('click', () => {
  const c = cases[+card.dataset.case];
  $('#case-img').src = `assets/img/${c.img}.jpg`;
  $('#case-img').alt = c.title;
  $('#case-tag').textContent = c.tag;
  $('#case-title').textContent = c.title;
  $('#case-desc').textContent = c.desc;
  $('#case-pts').innerHTML = c.pts.map(([k, v]) => `<div class="case-pt"><small>${k}</small><span>${v}</span></div>`).join('');
  dialog.showModal();
}));
$('#case-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
$('#case-cta').addEventListener('click', () => dialog.close());

/* ---------------- Scope form ---------------- */
const form = $('#scope-form');
const steps = $$('.step', form);
let step = 1;
const errEl = $('#form-error');
function renderStep() {
  steps.forEach((s) => s.classList.toggle('active', +s.dataset.step === step));
  $('#step-num').textContent = step;
  $('#scope-bar').style.width = step * 25 + '%';
  $('#step-back').disabled = step === 1;
  $('#step-next').textContent = step === 4 ? 'Send my brief →' : 'Continue';
  errEl.textContent = '';
}
function validate() {
  const fd = new FormData(form);
  if (step === 1 && !fd.get('industry')) return 'Please choose your business type.';
  if (step === 2 && !fd.getAll('solution').length) return 'Select at least one solution.';
  if (step === 3 && !fd.get('timeline')) return 'Please pick a timeline.';
  if (step === 4) {
    if (!fd.get('name')?.trim()) return 'Please enter your name.';
    if (!$('#f-email').checkValidity() || !fd.get('email')) return 'Please enter a valid email.';
  }
  return '';
}
$('#step-next').addEventListener('click', () => {
  const err = validate();
  if (err) { errEl.textContent = err; if (gsap) gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }); return; }
  if (step < 4) { step++; renderStep(); return; }
  submitForm();
});
$('#step-back').addEventListener('click', () => { if (step > 1) { step--; renderStep(); } });
// auto-advance on single-choice steps
$$('input[type="radio"]', form).forEach((r) => r.addEventListener('change', () => setTimeout(() => { if (step < 3 || step === 3) { if (!validate()) { step++; renderStep(); } } }, 280)));

function submitForm() {
  const fd = new FormData(form);
  const data = { industry: fd.get('industry'), solutions: fd.getAll('solution'), timeline: fd.get('timeline'), name: fd.get('name'), company: fd.get('company'), email: fd.get('email'), phone: fd.get('phone'), message: fd.get('message'), at: new Date().toISOString() };
  // TODO: connect to your CRM / email endpoint. Stored locally for now.
  const leads = JSON.parse(localStorage.getItem('zaai_leads') || '[]'); leads.push(data); localStorage.setItem('zaai_leads', JSON.stringify(leads));
  steps.forEach((s) => s.classList.remove('active'));
  $('#scope-nav').hidden = true; $('.scope-steps-label').hidden = true;
  $('#scope-bar').style.width = '100%';
  $('#scope-summary').innerHTML = [data.industry, ...data.solutions, data.timeline].map((t) => `<span>${t}</span>`).join('');
  $('#scope-success').hidden = false;
}
// Package CTAs preselect a solution
$$('[data-preselect]').forEach((a) => a.addEventListener('click', () => {
  const box = $(`input[name="solution"][value="${a.dataset.preselect}"]`);
  if (box) box.checked = true;
}));

/* ---------------- ZAAI AI Assistant ---------------- */
const fab = $('#assistant-fab'), panel = $('#assistant-panel'), chat = $('#chat'), chipsEl = $('#chat-chips');
const KB = [
  { k: ['service', 'offer', 'what do you do', 'help', 'capabilit'], a: 'ZAAI LABS runs on two engines:\n\n🎬 Creative & Digital — AI video, reels & shorts, 3D websites, YouTube, podcasts, SEO.\n🤖 Automation — agentic AI apps, CRM & sales enablement, AI training.\n🏭 Industrial — MES / shop-floor digitalisation, ERP consulting, live dashboards and technical/HSE media.' },
  { k: ['package', 'launch', 'offer', 'bundle', 'start'], a: 'Our 3 signature launch offers:\n\n1. Growth Reels & AI Video Retainer — 8 / 12 / 20 videos per month + repurposing.\n2. Next-Gen Business Website + Care Plan — custom 3D/modern site, SEO, analytics, uptime & security care.\n3. Paid AI Workflow & Industrial (ERP/MES) Discovery — process mapping, OT/IT security review, KPI architecture & roadmap.' },
  { k: ['price', 'cost', 'pricing', 'budget', 'quote', 'aed', 'how much'], a: 'Every project is scoped and quoted after a free 15-minute discovery call, so you only pay for what you need. Retainers are monthly; industrial work starts with a paid discovery so the implementation can be fixed-scope. <a href="#contact">Scope your project →</a>' },
  { k: ['reel', 'short', 'video', 'tiktok', 'instagram', 'explainer'], a: 'Our Reels & AI Video engine covers scripting, hooks, captions, AI-assisted editing and multi-platform cuts. Monthly bundles come in 8, 12 or 20 videos, and we also produce explainers, product demos, training videos and multi-language localisation (EN · AR · HI and more).' },
  { k: ['website', 'web', 'site', 'landing', '3d', 'seo'], a: 'We build conversion-first business sites, landing pages and 3D flagship websites — with technical SEO, GA4/conversion tracking and an optional monthly Website Care Plan (security, uptime, backups, updates).' },
  { k: ['erp', 'mes', 'oee', 'factory', 'plant', 'manufactur', 'shop', 'industrial', 'downtime', 'ot/it', 'plc'], a: 'For manufacturers we deliver MES / shop-floor digitalisation (production tracking, downtime & OEE, quality traceability, OT/IT integration), ERP selection & configuration (work orders, inventory, purchasing, maintenance) and live industrial dashboards. We always begin with a paid discovery & site survey.' },
  { k: ['automation', 'agent', 'agentic', 'crm', 'chatbot', 'workflow', 'lead'], a: 'We build AI automations and agentic apps — lead intake, FAQ assistants, document workflows and CRM follow-ups — always with human-in-the-loop safety. We also set up pipelines, forms and sales dashboards.' },
  { k: ['process', 'how', 'timeline', 'step', 'long', 'quality', 'qa'], a: 'Every project passes 4 quality gates:\n1. Discovery & Scope (signed brief / site survey)\n2. Prototype & First Cut\n3. QA, Security & Human Review\n4. Launch & Recurring Scale\n\nA landing page can launch in ~2–3 weeks; larger builds are timed during discovery.' },
  { k: ['founder', 'who', 'team', 'abhishek', 'nitesh', 'owner'], a: 'ZAAI LABS is founded and led by Abhishek Kumar and Nitesh Kumar. Every engagement has a founding partner involved — from strategy to technical/industrial oversight and final QA.' },
  { k: ['where', 'location', 'uae', 'dubai', 'gcc', 'saudi', 'asia', 'based'], a: 'We are UAE-focused (Dubai) and serve clients across the GCC and Asia — SMEs, B2B firms, manufacturers, creators and service businesses.' },
  { k: ['book', 'call', 'contact', 'meet', 'talk', 'discovery', 'email', 'whatsapp'], a: 'Happy to set that up! Fill in the 60-second Scope Your Project form and a founding partner will reply within one business day with a 15-minute discovery slot. <a href="#contact">Open the form →</a>' },
  { k: ['training', 'workshop', 'course', 'prompt'], a: 'Our AI Training & Workshops teach teams practical prompt workflows and safe AI adoption — tailored for corporate, SME and industrial teams.' },
  { k: ['podcast', 'youtube', 'repurpos', 'webinar'], a: 'We launch and manage YouTube channels end-to-end and turn podcasts/webinars into clips, quote cards, blogs and show notes — typically 20–30 assets per episode.' },
  { k: ['arabic', 'language', 'hindi', 'locali'], a: 'Yes — we localise videos and content into multiple languages including English, Arabic and Hindi.' },
];
const CHIPS = ['What services do you offer?', 'Launch packages', 'ERP / MES for factories', 'Pricing', 'Book a discovery call'];
function addMsg(html, who = 'bot') { const m = document.createElement('div'); m.className = `msg ${who}`; m.innerHTML = html; chat.appendChild(m); chat.scrollTop = chat.scrollHeight; return m; }
function answer(q) {
  const t = q.toLowerCase(); let best = null, score = 0;
  KB.forEach((e) => { const s = e.k.reduce((n, k) => n + (t.includes(k) ? k.length : 0), 0); if (s > score) { score = s; best = e; } });
  return best ? best.a : 'Great question! I can help with our services, launch packages, industrial ERP/MES work, process, pricing approach or booking a call. For anything specific, a founding partner can answer directly — <a href="#contact">book a 15-min discovery call</a>.';
}
function ask(q) {
  const clean = q.replace(/[<>]/g, '');
  addMsg(clean, 'user');
  const typing = addMsg('<span class="typing"><i></i><i></i><i></i></span>');
  setTimeout(() => { typing.innerHTML = answer(clean); chat.scrollTop = chat.scrollHeight; }, 650 + Math.random() * 400);
}
CHIPS.forEach((c) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c; b.addEventListener('click', () => ask(c)); chipsEl.appendChild(b); });
let greeted = false;
function togglePanel(open) {
  panel.hidden = !open; fab.setAttribute('aria-expanded', open);
  if (open && !greeted) { greeted = true; addMsg('👋 Hi! I\'m the ZAAI AI Assistant. Ask me about AI videos, 3D websites, automation, or ERP/MES for your plant.'); }
  if (open) $('#chat-text').focus();
}
fab.addEventListener('click', () => togglePanel(panel.hidden));
$('#assistant-close').addEventListener('click', () => togglePanel(false));
$('#chat-form').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#chat-text').value.trim(); if (!v) return; $('#chat-text').value = ''; ask(v); });
chat.addEventListener('click', (e) => { if (e.target.matches('a[href^="#"]')) togglePanel(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) togglePanel(false); });

/* ---------------- Misc ---------------- */
$('#year').textContent = new Date().getFullYear();
window.addEventListener('load', () => ScrollTrigger?.refresh());
