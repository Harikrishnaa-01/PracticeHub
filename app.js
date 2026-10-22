const $=s=>document.querySelector(s),app=$('#app'),dlg=$('#dlg');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const L=i=>String.fromCharCode(65+i);
const svg=p=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I={
  home:svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h4.5v-6h4v6h4.5V10"/>'),
  list:svg('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
  x:svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  flag:svg('<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>'),
  clock:svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>')
};
let courses=[];try{courses=JSON.parse(localStorage.getItem('qp_courses')||'[]')}catch(e){}
let view='courses',test=null,pv=null;

/* ---------- theme ---------- */
const isDark=()=>{const t=document.documentElement.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches};
function paintTheme(){
  const d=isDark();
  $('#theme').textContent=d?'☀':'☾';
  $('#theme').title=d?'Switch to light theme':'Switch to dark theme';
}
function toggleTheme(){const t=isDark()?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('qp_theme',t)}catch(e){}paintTheme()}
function save(){try{localStorage.setItem('qp_courses',JSON.stringify(courses));return true}catch(e){return false}}

/* ---------- toast + confirm popup (replaces alert/confirm) ---------- */
function toast(m,type='info'){
  const s=$('#snack');
  s.className='snack '+type;
  s.innerHTML=`<span class="ti">${type==='ok'?'✓':type==='err'?'!':'i'}</span><span>${esc(m)}</span>`;
  void s.offsetWidth;s.classList.add('show');
  clearTimeout(toast.t);toast.t=setTimeout(()=>s.classList.remove('show'),3200);
}
function ask(title,msg,ok='OK',danger=false){
  return new Promise(res=>{
    const d=$('#cdlg');
    $('#ctitle').textContent=title;$('#cmsg').textContent=msg;
    const y=$('#cyes');y.textContent=ok;y.classList.toggle('danger',danger);
    d.returnValue='';
    d.addEventListener('close',()=>res(d.returnValue==='yes'),{once:true});
    d.showModal();
  });
}

/* ---------- drawers / sheets (mobile) ---------- */
function openSheet(id){const e=document.getElementById(id);if(!e)return;e.classList.add('is-open');document.body.classList.add('sheet')}
function closeSheets(){document.querySelectorAll('.is-open').forEach(e=>e.classList.remove('is-open'));document.body.classList.remove('sheet')}

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

/* ---------- navigation ---------- */
function go(v){
  stopTimer();$('#timer').hidden=true;$('#quit').hidden=true;closeSheets();closeCtx();
  view=v;test=null;if(v!=='preview')pv=null;
  render();scrollTo(0,0);
}
async function nav(v){
  closeSheets();closeCtx();
  if(test&&!test.done&&!await ask('Leave this test?','Your progress on this test will be lost.','Leave',true))return;
  go(v);
}
function render(){
  app.classList.toggle('wide',test?!test.done:view==='preview');
  if(test)return test.done?renderResult():renderQ();
  if(view==='preview')renderPreview();else renderCourses();
}

/* ---------- course cards ---------- */
function courseCard(c){
  return `<div class="card course" data-cid="${c.id}"><button class="cbody" data-open="${c.id}" aria-haspopup="menu"><b>${esc(c.name)}</b></button></div>`;
}
function renderCourses(){
  app.innerHTML=`<h2>Your courses</h2><p class="sub">Click a course to open it. Right-click (or long-press on a touch screen) for more options.</p>`+
  (courses.length?`<div class="grid">${courses.map(courseCard).join('')}</div><button class="btn filled fab" data-add>+ Add course</button>`
  :`<div class="card empty"><p>No courses yet. Add one to start practising.</p><button class="btn filled" data-add>+ Add course</button></div>`);
}
async function delCourse(id){
  const c=courses.find(x=>x.id===id);if(!c)return;
  if(!await ask('Delete course?',`"${c.name}" and its ${c.questions.length} questions will be removed from this browser.`,'Delete',true))return;
  courses=courses.filter(x=>x.id!==id);
  if(!save())toast('Could not update browser storage','err');else toast('Course deleted','ok');
  render();
}
let renId=null;
function openRename(id){
  const c=courses.find(x=>x.id===id);if(!c)return;
  renId=id;$('#rname').value=c.name;$('#rerr').textContent='';$('#rdlg').showModal();$('#rname').select();
}

/* ---------- right-click / long-press menu ---------- */
const ctx=$('#ctx');let ctxId=null,ctxFrom=null;
const CTX=[
  ['view','View MCQs',svg('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>')],
  ['practice','Start practice',svg('<path d="M7 4.5v15l12-7.5z"/>')],
  ['rename','Rename',svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>')],
  ['delete','Delete',svg('<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>'),1]
];
function openCtx(id,x,y,from){
  ctxId=id;ctxFrom=from||null;
  ctx.innerHTML=CTX.map(([k,t,ic,danger],n)=>`${danger?'<div class="ctxsep" role="separator"></div>':''}<button role="menuitem" class="ctxi${danger?' danger':''}" data-cm="${k}">${ic}<span>${t}</span></button>`).join('');
  ctx.hidden=false;
  const w=ctx.offsetWidth,h=ctx.offsetHeight;
  ctx.style.left=Math.max(8,Math.min(x,innerWidth-w-8))+'px';
  ctx.style.top=Math.max(8,Math.min(y,innerHeight-h-8))+'px';
  ctx.querySelector('.ctxi').focus();
}
function closeCtx(){if(ctx.hidden)return;ctx.hidden=true;ctxId=null}
function ctxAct(k){
  const id=ctxId;closeCtx();
  if(k==='view')openPreview(id);else if(k==='practice')openStart(id);
  else if(k==='rename')openRename(id);else if(k==='delete')delCourse(id);
}
document.addEventListener('contextmenu',e=>{
  const c=e.target.closest('.course[data-cid]');
  if(!c||test||view!=='courses')return closeCtx();
  e.preventDefault();
  if(e.button!==2){const r=c.getBoundingClientRect();openCtx(c.dataset.cid,r.left+r.width/2,r.top+r.height/2,c)}
  else openCtx(c.dataset.cid,e.clientX,e.clientY,c);
});
let lp=null,lpSuppress=false;
document.addEventListener('touchstart',e=>{
  const c=e.target.closest('.course[data-cid]');if(!c||e.touches.length!==1)return;
  const t=e.touches[0];
  lp=setTimeout(()=>{lpSuppress=true;openCtx(c.dataset.cid,t.clientX,t.clientY,c);navigator.vibrate&&navigator.vibrate(15)},550);
},{passive:true});
['touchend','touchmove','touchcancel'].forEach(n=>document.addEventListener(n,()=>clearTimeout(lp),{passive:true}));
document.addEventListener('keydown',e=>{
  if(ctx.hidden)return;
  const items=[...ctx.querySelectorAll('.ctxi')],i=items.indexOf(document.activeElement);
  if(e.key==='Escape'){e.preventDefault();const f=ctxFrom;closeCtx();f&&f.querySelector('button').focus()}
  else if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus()}
  else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus()}
  else if(e.key==='Tab')closeCtx();
});
addEventListener('scroll',closeCtx,{passive:true});addEventListener('resize',closeCtx);addEventListener('blur',closeCtx);

/* ---------- week helpers ---------- */
const wkLabel=q=>{const m=String(q.assign).match(/Week\s*0*(\d+)/i);return m?'Week '+m[1]:String(q.assign)};
const wkNum=l=>{const m=l.match(/\d+/);return m?+m[0]:1e9};
function weekGroups(c){
  const m=new Map();
  c.questions.forEach(q=>{const k=wkLabel(q);if(!m.has(k))m.set(k,[]);m.get(k).push(q)});
  return [...m.entries()].sort((a,b)=>wkNum(a[0])-wkNum(b[0])).map(([label,qs])=>({label,qs}));
}
function imgs(q){return (q.images||[]).map(s=>`<img class="qimg" src="${esc(s)}" alt="Question image" loading="lazy">`).join('')}

/* ---------- course preview (questions + answers by week) ---------- */
function openPreview(id){
  const c=courses.find(x=>x.id===id);if(!c)return;
  closeSheets();view='preview';pv={c,wk:null};render();scrollTo(0,0);
}
function selWeek(k){pv.wk=k;closeSheets();render();scrollTo(0,0)}
function qCard(q){
  const tag=q.fill?'<span class="badge">Fill in the blank</span>':q.multi?'<span class="badge multi">Select all that apply</span>':'';
  const body=q.fill
    ?`<div class="fillrv"><div class="frow right"><small>Correct answer</small><b>${q.answers.map(esc).join(' <i>or</i> ')}</b></div></div>`
    :q.options.map((o,j)=>{const r=q.answer.includes(j);return `<div class="opt rv ${r?'right':''}"><span class="l">${L(j)}</span><span class="t">${esc(o)}</span><span class="tag">${r?'✓ Correct':''}</span></div>`}).join('')+
     `<div class="ansline">Answer: <b>${q.answer.map(L).join(', ')||'—'}</b></div>`;
  return `<article class="card qp"><div class="qpt"><span class="badge">Question ${q.qno}</span>${tag}</div>
  <div class="qtext">${esc(q.question)}</div>${imgs(q)}${body}</article>`;
}
function renderPreview(){
  const c=pv.c,gs=weekGroups(c);let g=gs.find(x=>x.label===pv.wk);
  if(!g){g=gs[0];pv.wk=g.label}
  app.innerHTML=`<div class="pvhead">
    <button class="iconbtn home" data-home aria-label="Back to courses" title="Back to courses">${I.home}</button>
    <div class="pvt"><h2>${esc(c.name)}</h2><p class="sub">${c.questions.length} questions · ${gs.length} weeks · answers shown</p></div>
    <button class="btn filled" data-start="${c.id}">Practice</button></div>
  <button class="fabctx" data-sheet="pvside">${I.list}<span>${esc(g.label)}</span><em>Weeks</em></button>
  <div class="pvwrap">
    <aside class="card pvside" id="pvside"><div class="palhead"><b>Weeks</b><button class="iconbtn palx" data-closesheet aria-label="Close">${I.x}</button></div>
      <div class="wklist">${gs.map(x=>`<button class="wkb ${x===g?'active':''}" data-wk="${esc(x.label)}"><span>${esc(x.label)}</span><small>${x.qs.length}</small></button>`).join('')}</div></aside>
    <section class="pvmain"><div class="pvbar"><h3>${esc(g.label)}</h3><span class="badge">${g.qs.length} questions</span></div>
      ${g.qs.map(qCard).join('')}</section></div>`;
}

/* ---------- timer ---------- */
const pad=n=>String(n).padStart(2,'0');
function fmt(ms){const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return (h?h+':'+pad(m):pad(m))+':'+pad(s%60)}
const dur=ms=>ms<60000?(ms/1000).toFixed(1)+'s':fmt(ms);
let tick=null,pendingId=null;
function stopTimer(){clearInterval(tick);tick=null;$('#timer').classList.remove('run')}
function runTimer(){
  $('#quit').hidden=false;const el=$('#timer');el.hidden=false;el.classList.add('run');
  const upd=()=>{$('#tval').textContent=fmt(Date.now()-test.t0)};upd();
  tick=setInterval(upd,500);
}

/* ---------- start dialog / build ---------- */
const MODES={full:'Every question from every week is mixed into one random order.',week:'Weeks stay in order (Week 0 to 13). Questions are shuffled inside each week and grouped by week.'};
function openStart(id){
  const c=courses.find(x=>x.id===id);if(!c)return;pendingId=id;
  $('#smsg').textContent=`${c.name}: ${c.questions.length} questions in random order, with options shuffled too. The timer starts as soon as you confirm and stops when you submit.`;
  document.querySelector(`input[name=mode][value=${curMode()}]`).checked=true;paintMode();$('#sdlg').showModal();
}
function curMode(){try{return localStorage.getItem('qp_mode')==='week'?'week':'full'}catch(e){return'full'}}
function paintMode(){const m=document.querySelector('input[name=mode]:checked').value;$('#mdesc').textContent=MODES[m];try{localStorage.setItem('qp_mode',m)}catch(e){}}

/* Option shuffling: options are reordered and the stored answer indexes are remapped so
   the correct answer always follows its option. "All/None of the above" style options stay
   pinned at the end; if an option refers to other options by letter ("A and B") that
   question keeps its original order, otherwise the reference would become wrong. */
const PIN=/\b(all|none|both|neither|any)\s+of\s+(the\s+)?(above|these|those|them|options?)\b|\b(all|none)\s+(the\s+)?above\b/i;
const REF=/\b(?:[Oo]ptions?|[Cc]hoices?|[Aa]nswers?|[Ss]tatements?)\s+\(?[A-E]\b|\b[A-E]\s*(?:and|&|,|or)\s*[A-E]\b/;
function shuffleOpts(q){
  const o=q.options;
  if(q.fill||o.length<2||o.some(t=>REF.test(String(t))))return q;
  const pin=[],mv=[];o.forEach((t,i)=>(PIN.test(String(t))?pin:mv).push(i));
  const idx=[...shuffle(mv),...pin];
  const pos=new Map(idx.map((oldI,newI)=>[oldI,newI]));
  return {...q,options:idx.map(i=>o[i]),answer:q.answer.map(a=>pos.get(a)).filter(a=>a!==undefined).sort((x,y)=>x-y)};
}
function build(c,mode){
  if(mode!=='week')return {qs:shuffle(c.questions.slice()).map(shuffleOpts),groups:null};
  const qs=[],groups=[];
  weekGroups(c).forEach(g=>{const a=shuffle(g.qs.slice()).map(shuffleOpts);groups.push({label:g.label,start:qs.length,n:a.length});qs.push(...a)});
  return {qs,groups};
}
function start(id,mode){
  const c=courses.find(x=>x.id===id);if(!c)return;
  const {qs,groups}=build(c,mode);
  stopTimer();closeSheets();
  const now=Date.now();
  test={c,qs,groups,mode,ans:qs.map(()=>[]),qt:qs.map(()=>0),i:0,done:false,seen:new Set(),flags:new Set(),t0:now,last:now,elapsed:0,rtab:'wrong',gmode:'all'};
  render();runTimer();scrollTo(0,0);
}
function lap(){if(!test||test.done)return;const n=Date.now();test.qt[test.i]+=n-test.last;test.last=n}
function setQ(k){lap();test.i=k;render();scrollTo(0,0)}
function finish(){
  lap();test.elapsed=Date.now()-test.t0;test.done=true;stopTimer();
  $('#timer').hidden=true;$('#quit').hidden=true;
}

/* ---------- test screen ---------- */
const chipCls=k=>k===test.i?'cur':test.ans[k].length?'done':test.seen.has(k)?'skip':'';
function paintPal(){
  document.querySelectorAll('.chip[data-jump]').forEach(c=>c.className='chip '+chipCls(+c.dataset.jump)+(test.flags.has(+c.dataset.jump)?' flag':''));
  const n=test.ans.filter(a=>a.length).length,e=$('#cnt'),f=$('#fcnt');
  if(e)e.textContent=n+' of '+test.qs.length+' answered';
  if(f)f.textContent=n+'/'+test.qs.length;
  const cl=$('.clr');if(cl)cl.disabled=!test.ans[test.i].length;
}
const chipBtn=k=>`<button class="chip ${chipCls(k)}${test.flags.has(k)?' flag':''}" data-jump="${k}" aria-label="Question ${k+1}">${k+1}</button>`;
function palette(){
  const {qs,groups}=test;
  if(!groups)return `<div class="chips">${qs.map((_,k)=>chipBtn(k)).join('')}</div>`;
  return `<div class="chips weeks">${groups.map(g=>`<div class="wkh"><span>${esc(g.label)}</span><small>Q${g.start+1}-${g.start+g.n}</small></div><div class="wkgrid">${Array.from({length:g.n},(_,j)=>chipBtn(g.start+j)).join('')}</div>`).join('')}</div>`;
}
function wkBadge(i){
  const g=test.groups&&test.groups.find(g=>i>=g.start&&i<g.start+g.n);
  return g?`<span class="badge wk">${esc(g.label)} · ${i-g.start+1} of ${g.n}</span>`:'';
}
function renderQ(){
  const old=document.querySelector('.pal .chips'),prev=old?old.scrollTop:0;
  drawQ();
  const box=document.querySelector('.pal .chips'),cur=box&&box.querySelector('.chip.cur');
  if(!cur)return;
  box.scrollTop=prev;
  const top=Math.max(0,cur.offsetTop-box.clientHeight/2+cur.offsetHeight/2);
  box.scrollTo({top,behavior:prev||top?'smooth':'auto'});
}
function drawQ(){
  const {qs,ans,i}=test,q=qs[i],n=qs.length,multi=q.multi;test.seen.add(i);
  const tag=q.fill?'<span class="badge">Fill in the blank</span>':multi?'<span class="badge multi">Select all that apply</span>':'';
  const body=q.fill
    ?`<label class="fillbox"><span>Your answer</span><input id="fill" class="fillin" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="${i<n-1?'next':'done'}" placeholder="Type your answer here" value="${esc(ans[i][0]||'')}"></label>`
    :`<div role="${multi?'group':'radiogroup'}">${q.options.map((o,k)=>`<label class="opt">
    <input type="${multi?'checkbox':'radio'}" name="opt" value="${k}" ${ans[i].includes(k)?'checked':''}>
    <span class="l">${L(k)}</span><span class="t">${esc(o)}</span></label>`).join('')}</div>`;
  app.innerHTML=`<button class="fabctx" data-sheet="pal">${I.list}<span>Questions</span><em id="fcnt"></em></button>
  <div class="testwrap"><div class="card main">
  <div class="qhead"><span class="qnum">Question ${i+1} of ${n}</span>${wkBadge(i)}</div>
  <div class="bar"><i style="width:${(i+1)/n*100}%"></i></div>
  ${tag?`<div class="qpt">${tag}</div>`:''}
  <div class="qtext">${esc(q.question)}</div>${imgs(q)}
  ${body}
  <div class="clrrow"><button class="btn text flg ${test.flags.has(i)?'on':''}" data-flag aria-pressed="${test.flags.has(i)}">${I.flag}<span>${test.flags.has(i)?'Flagged for review':'Flag for review'}</span></button><button class="btn text clr" data-clear ${ans[i].length?'':'disabled'}>${I.x}<span>Clear ${q.fill?'answer':'selection'}</span></button></div>
  <div class="nav"><button class="btn tonal" data-prev ${i?'':'disabled'}>Previous</button>
  ${i<n-1?`<button class="btn filled" data-next>Next</button>`:`<button class="btn filled" data-submit>Submit test</button>`}</div></div>
  <aside class="card pal" id="pal"><div class="palhead"><b>Jump to question</b><button class="iconbtn palx" data-closesheet aria-label="Close">${I.x}</button></div>
  <div class="sub" id="cnt" style="margin:2px 0 10px"></div>
  ${palette()}
  <div class="key"><span><i class="k-cur"></i>Current</span><span><i class="k-done"></i>Answered</span><span><i class="k-skip"></i>Skipped</span><span><i></i>Not visited</span><span><i class="k-flag"></i>Flagged</span></div>
  <div class="palbtns"><button class="btn filled" data-submit>Submit test</button></div></aside></div>`;
  paintPal();
  if(q.fill&&matchMedia('(pointer:fine)').matches){const f=$('#fill');f.focus();f.setSelectionRange(f.value.length,f.value.length)}
}

/* ---------- answer checking ---------- */
/* Fill-in answers are compared after normalising both sides: Unicode form, case, curly quotes,
   repeated spaces, and surrounding quotes / trailing punctuation are ignored. Numbers are
   compared by value ("5", "5.0" and "5,000" = "5000"). Several accepted answers can be given
   as a list or separated by "|" in the answers file. */
const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/[\u2018\u2019`\u00b4]/g,"'").replace(/[\u201c\u201d]/g,'"')
  .replace(/\s+/g,' ').trim().replace(/^["']+/,'').replace(/["'.,;:!?]+$/,'').trim();
const NUM=/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/;
function same(exp,got){
  const a=norm(exp),b=norm(got);if(!a||!b)return false;
  if(a===b)return true;
  const x=a.replace(/,/g,''),y=b.replace(/,/g,'');
  return NUM.test(x)&&NUM.test(y)&&Number(x)===Number(y);
}
function isRight(q,a){
  if(q.fill)return a.length>0&&q.answers.some(x=>same(x,a[0]));
  return a.length===q.answer.length&&q.answer.every(x=>a.includes(x));
}

/* ---------- result ---------- */
const STL={ok:'Correct',bad:'Wrong',na:'Not answered'};
function reviewCard(k){
  const q=test.qs[k],a=test.ans[k],s=test.st[k];
  const top=`<div class="rtop"><span class="badge">Q${k+1}</span><span class="badge">${esc(wkLabel(q))} · Question ${q.qno}</span>${q.multi?'<span class="badge multi">Select all that apply</span>':''}${q.fill?'<span class="badge">Fill in the blank</span>':''}${test.flags.has(k)?`<span class="badge flagb">${I.flag}Flagged</span>`:''}<span class="st ${s}">${STL[s]}</span><span class="rtime">${dur(test.qt[k])}</span></div>`;
  let body;
  if(q.fill){
    const mine=a[0]||'';
    body=`<div class="fillrv"><div class="frow ${s==='ok'?'right':s==='bad'?'wrong':'none'}"><small>Your answer</small><b>${mine?esc(mine):'Not answered'}</b></div>
    ${s==='ok'?'':`<div class="frow right"><small>Correct answer</small><b>${q.answers.map(esc).join(' <i>or</i> ')}</b></div>`}</div>`;
  }else{
    body=q.options.map((o,j)=>{const r=q.answer.includes(j),p=a.includes(j),w=p&&!r;
      return `<div class="opt rv ${r?'right':w?'wrong':''}"><input type="${q.multi?'checkbox':'radio'}" disabled ${p?'checked':''} aria-label="Your selection">
      <span class="l">${L(j)}</span><span class="t">${esc(o)}</span><span class="tag">${r?(p?'Correct · yours':'Correct'):w?'Your answer':''}</span></div>`}).join('')+
      `<div class="ansline">Correct answer${q.answer.length>1?'s':''}: <b>${q.answer.map(L).join(', ')}</b> · Your selection: <b class="mine ${s}">${a.length?a.map(L).join(', '):'none'}</b></div>`;
  }
  return `<article class="card rcard">${top}<div class="qtext">${esc(q.question)}</div>${imgs(q)}${body}</article>`;
}
function wrongHTML(){
  const list=test.qs.map((_,k)=>k).filter(k=>test.st[k]!=='ok');
  return list.length?`<p class="sub">${list.length} question${list.length===1?'':'s'} to revisit. Options appear in the order you saw them.</p>`+list.map(reviewCard).join('')
    :`<div class="card empty"><p>Perfect score. Nothing was answered wrong.</p></div>`;
}
function flaggedHTML(){
  const list=[...test.flags].sort((a,b)=>a-b);
  return list.length?`<p class="sub">${list.length} question${list.length===1?'':'s'} you flagged for review, with the correct answers shown where you were wrong.</p>`+list.map(reviewCard).join('')
    :`<div class="card empty"><p>No questions were flagged. Use "Flag for review" during practice to mark questions you want to revisit.</p></div>`;
}
function gridHTML(){
  const {qs,st,qt}=test,wk=test.gmode==='week';
  const chip=k=>`<button class="chip m-${st[k]}${test.flags.has(k)?' flag':''}" data-rvq="${k}" aria-label="Question ${k+1}: ${STL[st[k]].toLowerCase()}${test.flags.has(k)?', flagged':''}" title="Q${k+1} · ${STL[st[k]]}${test.flags.has(k)?' · Flagged':''} · ${dur(qt[k])}">${k+1}</button>`;
  let inner;
  if(!wk)inner=`<div class="cmap">${qs.map((_,k)=>chip(k)).join('')}</div>`;
  else{
    const m=new Map();qs.forEach((q,k)=>{const w=wkLabel(q);if(!m.has(w))m.set(w,[]);m.get(w).push(k)});
    inner=[...m].sort((a,b)=>wkNum(a[0])-wkNum(b[0])).map(([w,ks])=>`<div class="wkh"><span>${esc(w)}</span><small>${ks.filter(k=>st[k]==='ok').length} of ${ks.length} correct</small></div><div class="cmap wkmap">${ks.map(chip).join('')}</div>`).join('');
  }
  return `<div class="card"><div class="gridbar"><div class="fseg" role="group" aria-label="Grid grouping"><button class="${wk?'':'on'}" data-gmode="all">All questions</button><button class="${wk?'on':''}" data-gmode="week">Split by week</button></div>
  <div class="legend sm"><span><i class="d-ok"></i>Correct</span><span><i class="d-bad"></i>Wrong</span><span><i class="d-na"></i>Not answered</span><span><i class="d-flag"></i>Flagged</span></div></div>
  <p class="sub" style="margin:0 0 12px">Click a question number to see its options and your selection.</p>${inner}</div>`;
}
function paintPanel(){
  document.querySelectorAll('[data-rtab]').forEach(b=>{const on=b.dataset.rtab===test.rtab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
  $('#rpanel').innerHTML=test.rtab==='grid'?gridHTML():test.rtab==='flagged'?flaggedHTML():wrongHTML();
}
function renderQPreview(k){
  const back=`<button class="btn tonal" data-back>← Back to results</button>`;
  app.innerHTML=`<div class="res"><div class="pvhead">${back}<div class="pvt"><h2>Question ${k+1}</h2><p class="sub">${esc(test.c.name)}</p></div></div>${reviewCard(k)}<div class="actions">${back}</div></div>`;
  scrollTo(0,0);
}
function renderResult(){
  const {qs,ans,qt}=test,n=qs.length;
  const st=qs.map((q,k)=>!ans[k].length?'na':isRight(q,ans[k])?'ok':'bad');test.st=st;
  const c={ok:0,bad:0,na:0};st.forEach(s=>c[s]++);
  const pct=Math.round(c.ok/n*100),att=n-c.na,acc=att?Math.round(c.ok/att*100)+'%':'—';
  const slow=qt.reduce((b,t,k)=>t>qt[b]?k:b,0);
  const msg=pct>=90?'Outstanding':pct>=75?'Great work':pct>=50?'Good effort':'Keep practising';
  const R=54,C=2*Math.PI*R;let off=0;
  const arc=(v,k)=>{if(!v)return'';const len=v/n*C,s=`<circle class="arc a-${k}" cx="70" cy="70" r="${R}" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;off+=len;return s};
  const wm=new Map();
  qs.forEach((q,k)=>{const w=wkLabel(q),o=wm.get(w)||wm.set(w,{ok:0,bad:0,na:0,n:0}).get(w);o[st[k]]++;o.n++});
  const rows=[...wm].sort((a,b)=>wkNum(a[0])-wkNum(b[0]));
  const secs=Math.floor(test.elapsed/1000),unit=secs>=3600?'hours : minutes : seconds':'minutes : seconds';
  test.nBad=c.bad+c.na;
  app.innerHTML=`<div class="res">
  <section class="card rhero">
    <h2>Test complete · ${msg}</h2>
    <div class="sub">${esc(test.c.name)} · ${test.mode==='week'?'Week-wise shuffle':'Full random'}</div>
    <div class="rmain">
      <svg class="donut" viewBox="0 0 140 140" role="img" aria-label="${c.ok} correct, ${c.bad} wrong, ${c.na} not answered out of ${n}">
        <circle class="track" cx="70" cy="70" r="${R}"/>${arc(c.ok,'ok')}${arc(c.bad,'bad')}${arc(c.na,'na')}
        <text x="70" y="70" class="dpct">${pct}%</text><text x="70" y="90" class="dsub">${c.ok} of ${n} correct</text></svg>
      <div class="rside">
        <div class="clock" role="timer" aria-label="Total time ${fmt(test.elapsed)}"><div class="clbl">${I.clock}<span>Total time</span></div>
          <div class="digits">${fmt(test.elapsed)}</div><div class="cunit">${unit}</div></div>
        <div class="stats">
          <div><small>Answered</small><b>${att} / ${n}</b></div>
          <div><small>Accuracy of answered</small><b>${acc}</b></div>
          <div><small>Avg per question</small><b>${dur(test.elapsed/n)}</b></div>
          <div><small>Slowest · Q${slow+1}</small><b>${dur(qt[slow])}</b></div></div>
      </div>
    </div>
    <div class="kpis"><div class="kpi ok"><b>${c.ok}</b><small>Correct</small></div><div class="kpi bad"><b>${c.bad}</b><small>Wrong</small></div><div class="kpi na"><b>${c.na}</b><small>Not answered</small></div><div class="kpi fl"><b>${test.flags.size}</b><small>Flagged</small></div></div>
  </section>
  ${rows.length>1?`<section class="card"><h3>By week</h3>${rows.map(([w,o])=>`<div class="wrow"><span>${esc(w)}</span>
    <div class="stack" title="${o.ok} correct, ${o.bad} wrong, ${o.na} unanswered"><i class="d-ok" style="width:${o.ok/o.n*100}%"></i><i class="d-bad" style="width:${o.bad/o.n*100}%"></i><i class="d-na" style="width:${o.na/o.n*100}%"></i></div>
    <span>${o.ok}/${o.n}</span></div>`).join('')}</section>`:''}
  <div class="rtabs" role="tablist"><button role="tab" class="${test.rtab==='wrong'?'on':''}" data-rtab="wrong">Wrong answers <span class="cnt">${test.nBad}</span></button><button role="tab" class="${test.rtab==='flagged'?'on':''}" data-rtab="flagged">Flagged <span class="cnt">${test.flags.size}</span></button><button role="tab" class="${test.rtab==='grid'?'on':''}" data-rtab="grid">Answer grid</button></div>
  <div id="rpanel"></div>
  <div class="actions center"><button class="btn filled" data-again="${test.c.id}">Practice again</button><button class="btn tonal" data-go2="courses">Back to home</button></div></div>`;
  paintPanel();
}

/* ---------- course import ---------- */
function parseCourse(name,A,B){
  const cache=A.weeks?A:B, corr=A.weeks?B:A;
  if(!Array.isArray(cache.weeks)||typeof corr!=='object')throw Error('Could not find the questions file (needs a "weeks" list) and the answers file.');
  const questions=[];
  cache.weeks.forEach(w=>(w.questions||[]).forEach((q,i)=>{
    let a=(corr[w.key]||{})[i];
    if(a==null)a=q.answer??q.answers??q.correct??q.correct_answer;   // answer may live in the questions file
    if(a==null)return;
    if(a&&typeof a==='object'&&!Array.isArray(a))a=a.answer??a.answers??a.text??a.value;
    if(a==null)return;
    const typ=String(q.type||''),assign=w.title||w.key;
    const opts=(q.options||[]).filter(o=>String(o??'').trim()!=='');
    const toks=(Array.isArray(a)?a:String(a).split(/[,\s]+/)).map(s=>String(s).trim()).filter(Boolean);
    // multiple choice only when every answer is a letter that points at a real option
    const letters=opts.length>0&&toks.length>0&&toks.every(s=>/^[A-Za-z]$/.test(s)&&s.toUpperCase().charCodeAt(0)-65<opts.length);
    const fillType=/fill|blank|cloze|gap|short|numeric|free.?text|text.?(entry|input)|written/i.test(typ);
    if(fillType||!letters){
      const answers=(Array.isArray(a)?a:String(a).split('|')).map(s=>String(s).trim()).filter(Boolean);
      if(!answers.length)return;
      questions.push({assign,qno:i+1,question:q.question,options:[],images:q.images||[],answer:[],answers,fill:true,multi:false});
      return;
    }
    const ans=toks.map(s=>s.toUpperCase().charCodeAt(0)-65);
    questions.push({assign,qno:i+1,question:q.question,options:opts,images:q.images||[],answer:ans,
      multi:/multi/i.test(typ)||ans.length>1});
  }));
  if(!questions.length)throw Error('No questions matched between the two files.');
  return {id:'c'+Date.now(),name,weeks:cache.weeks.length,questions};
}
const readJ=f=>f.text().then(JSON.parse).catch(()=>{throw Error(`"${f.name}" is not valid JSON.`)});

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const cm=e.target.closest('#ctx .ctxi');
  if(cm){ctxAct(cm.dataset.cm);return}
  if(!e.target.closest('#ctx'))closeCtx();
  if(lpSuppress){lpSuppress=false;if(e.target.closest('.course'))return}
  const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if('themeToggle' in d)toggleTheme();
  else if('sheet' in d)openSheet(d.sheet);
  else if('closesheet' in d)closeSheets();
  else if(d.go)nav(d.go);
  else if(d.go2)nav(d.go2);
  else if('home' in d)nav('courses');
  else if(d.open)openPreview(d.open);
  else if(d.wk)selWeek(d.wk);
  else if('add' in d){$('#addForm').reset();$('#err').textContent='';dlg.showModal()}
  else if(d.start)openStart(d.start);
  else if(d.again)openStart(d.again);
  else if('sstart' in d){const m=document.querySelector('input[name=mode]:checked').value;$('#sdlg').close();start(pendingId,m)}
  else if('scancel' in d)$('#sdlg').close();
  else if('next' in d)setQ(test.i+1);
  else if('prev' in d)setQ(test.i-1);
  else if('flag' in d){
    const s=test.flags,k=test.i;s.has(k)?s.delete(k):s.add(k);const on=s.has(k);
    t.classList.toggle('on',on);t.setAttribute('aria-pressed',on);t.querySelector('span').textContent=on?'Flagged for review':'Flag for review';paintPal();
  }
  else if('clear' in d){test.ans[test.i]=[];renderQ()}
  else if(d.jump!==undefined){closeSheets();setQ(+d.jump)}
  else if('quit' in d)nav('courses');
  else if('submit' in d){
    closeSheets();
    const left=test.ans.filter(a=>!a.length).length,fl=test.flags.size;
    const msg=[left?`${left} question${left===1?' is':'s are'} still unanswered.`:'You have answered every question.',fl?`${fl} question${fl===1?' is':'s are'} flagged for review.`:''].filter(Boolean).join(' ')+(left||fl?' Submit anyway?':'');
    ask('Submit test?',msg,'Submit').then(ok=>{
      if(ok&&test&&!test.done){finish();render();scrollTo(0,0);toast('Test submitted','ok')}
    });
  }
  else if(d.rtab){test.rtab=d.rtab;paintPanel()}
  else if(d.gmode){test.gmode=d.gmode;paintPanel()}
  else if(d.rvq!==undefined){test.scrollY=scrollY;renderQPreview(+d.rvq)}
  else if('back' in d){renderResult();scrollTo(0,test.scrollY||0)}
});
app.addEventListener('change',e=>{
  if(!test||e.target.name!=='opt')return;
  test.ans[test.i]=[...app.querySelectorAll('input[name=opt]:checked')].map(x=>+x.value);paintPal();
});
app.addEventListener('input',e=>{
  if(!test||e.target.id!=='fill')return;
  test.ans[test.i]=e.target.value.trim()?[e.target.value]:[];paintPal();
});
app.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.id==='fill'){e.preventDefault();const b=app.querySelector('[data-next]');if(b)b.click()}
});
document.addEventListener('change',e=>{if(e.target.name==='mode')paintMode()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets()});
$('#scrim').addEventListener('click',closeSheets);
matchMedia('(min-width:861px)').addEventListener('change',closeSheets);
$('#cancel').onclick=()=>dlg.close();
$('#rcancel').onclick=()=>$('#rdlg').close();
$('#renForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=$('#rname').value.trim(),c=courses.find(x=>x.id===renId);
  if(!name){$('#rerr').textContent='Please enter a name.';return}
  if(c){const old=c.name;c.name=name;if(!save()){c.name=old;$('#rerr').textContent='Could not update browser storage.';return}toast('Course renamed','ok')}
  $('#rdlg').close();render();
});
$('#addForm').addEventListener('submit',async e=>{
  e.preventDefault();const err=$('#err');err.textContent='';
  try{
    const c=parseCourse($('#cname').value.trim(),await readJ($('#f1').files[0]),await readJ($('#f2').files[0]));
    courses.push(c);
    if(!save()){courses.pop();throw Error('Browser storage is full. Delete a course and try again.')}
    dlg.close();toast(`Added "${c.name}" with ${c.questions.length} questions`,'ok');
    render();
  }catch(x){err.textContent=x.message||'Invalid file.'}
});
const stale=courses.filter(c=>c.questions.some(q=>!q.fill&&!(q.options&&q.options.length)));
if(stale.length)setTimeout(()=>toast(`"${stale[0].name}" was saved before typed answers were supported. Delete it and add it again to enable fill-ups.`,'err'),600);
paintTheme();matchMedia('(prefers-color-scheme:dark)').addEventListener('change',paintTheme);
render();