// Quotatore dell'usato: listino attuale + optional + accessori, svalutato per eta, km, marca e stato.
function avvia(D){
const F=D.fit, ROWS=D.rows, MODELS=D.models;
const P={up:F.up,p1:F.s1,p2:F.s2,p3:F.s3,pkm:F.ck,kmA:10000,kmB:7000,band:0.04,dealer:0.125};
const CAL=new Set(['Pössl','Roadcar','Panama','Knaus','Weinsberg','Adria','Hymer','Malibu']);
const BF=D.bf||{};
const $=id=>document.getElementById(id);
const eur=v=>'€ '+Math.round(v).toLocaleString('it-IT');
const pct=v=>(v*100).toFixed(1).replace('.',',')+'%';
const MESI=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const now=new Date();
function ageOf(y,m){return Math.max(0,(now.getFullYear()+now.getMonth()/12)-(y+(m-0.5)/12))}
function ageFactor(a){return Math.pow(1+P.p1,Math.min(a,1))*Math.pow(1+P.p2,Math.min(Math.max(a-1,0),5))*Math.pow(1+P.p3,Math.max(a-6,0))}
function kmExp(a){return a<=6?P.kmA*a:P.kmA*6+P.kmB*(a-6)}
let stato=0, optTouched=false;
const brands=[...new Set(MODELS.map(m=>m[0]))];
brands.forEach(b=>$('marca').add(new Option(b,b)));

const ALIAS=[[/\bglobe ?scout\b/g,'2win'],[/\b2 win\b/g,'2win'],[/\bbox ?star\b/g,'boxlife'],[/\bvan ?tourer\b/g,'boxlife'],[/\bfreeway\b/g,'boxlife 630 me'],
 [/\bcara ?tour\b/g,'carabus'],[/\bcara ?bus\b/g,'carabus'],[/\bbox ?life\b/g,'boxlife'],[/\bbox ?time\b/g,'boxtime'],[/\bfree\b/g,'redwood'],[/\b(sydney|hymercar)\b/g,'ayers rock'],
 [/\bcharming\b/g,'comfort'],[/\bsp\b/g,'spb'],[/\bspt\b/g,'spb'],[/\bsl\b/g,'slb'],[/\bjumper\b/g,'citroen'],[/\bducato\b/g,'fiat'],[/\bcitroën\b/g,'citroen'],[/\bpössl\b|\bpossl\b/g,''],[/\bp (\d+)\b/g,'p$1'],[/\br (\d{3})\b/g,'r$1']];
const EXPL=new Set(['relax','supreme','sports','diversity','first','family','kids','aventuro','4x4','ibex','active','ibrido','limited','sport','fire','tour','celebration','spirit','gx']);
function norm(t){t=' '+t.toLowerCase().replace(/[^a-z0-9àèéìòùöü ]/g,' ').replace(/([a-z])(\d{3})\b/g,'$1 $2').replace(/\b(\d{3})([a-z]{1,3})\b/g,'$1 $2')+' ';
  ALIAS.forEach(([r,v])=>t=t.replace(r,v));
  return t.split(/\s+/).filter(w=>w&&!/^(19|20)\d\d$/.test(w)&&!/^(van|edition|ps|cv|hp|at|aut|automatik|kastenwagen|camper)$/.test(w));}
const isLen=w=>/^\d{3}$/.test(w)&&+w>=500&&+w<=699;
function score(q,c){let sc=0;const cl=c.filter(isLen);
  q.forEach(w=>{if(isLen(w)){if(!cl.length)return;const d=Math.min(...cl.map(x=>Math.abs(+x-w)));sc+=d===0?4:d<=40?2:-2;return}
    if(/^\d+$/.test(w))return;
    if(c.includes(w))sc+=w.length>=3?3:1;else if(w.length>=4&&c.some(x=>x.length>=4&&(x.startsWith(w)||w.startsWith(x))))sc+=2;});
  c.forEach(x=>{if(EXPL.has(x)&&!q.includes(x))sc-=3});
  return sc}
const CANDS=[];
MODELS.forEach((m,i)=>CANDS.push({b:m[0],i,t:norm(m[1]+' '+m[3])}));
(()=>{const rep={};MODELS.forEach((m,i)=>{const k=m[0]+'|'+m[3];if(rep[k]==null||m[2]<MODELS[rep[k]][2])rep[k]=i});
  ROWS.forEach(r=>{const b=r[1]==='Globecar'?'Pössl':r[1];const i=rep[b+'|'+r[0]];if(r[0]&&i!=null)CANDS.push({b,i,t:norm(r[2]),old:1})})})();
function bestModel(brand,txt){const q=norm(txt);let best=null;
  CANDS.forEach(c=>{if(c.b!==brand)return;const sc=score(q,c.t)-(c.old?0.5:0);const p=MODELS[c.i][2];
    if(!best||sc>best.sc||(sc===best.sc&&p<MODELS[best.i][2]))best={i:c.i,sc}});
  return best}
function fillModels(sel){
  const ms=$('modello'); ms.innerHTML='';
  const byT={};MODELS.forEach((m,i)=>{if(m[0]===$('marca').value)(byT[m[4]]=byT[m[4]]||[]).push([m,i])});
  Object.entries(byT).forEach(([t,list])=>{const og=document.createElement('optgroup');og.label=t;list.forEach(([m,i])=>og.appendChild(new Option(m[1],i)));ms.appendChild(og)});
  if(sel!=null)ms.value=sel; setBase();
  $('mlist').innerHTML=[...new Set(MODELS.filter(m=>m[0]===$('marca').value).map(m=>m[1]))].map(n=>`<option value="${n}">`).join('');
}
let refTouched=false;
function autoRef(){const t=$('modtxt').value.trim();if(!t){$('mref').textContent='Scrivi il modello: sceglierò il più simile tra quelli attuali.';return}
  if(refTouched)return;const b=bestModel($('marca').value,t);
  if(b&&b.sc>0){$('modello').value=b.i;$('mref').textContent='Scelto in automatico dal modello che hai scritto. Puoi cambiarlo.'}
  else{const first=MODELS.findIndex(m=>m[0]===$('marca').value);$('modello').value=first;$('mref').textContent='Modello non riconosciuto: scegli tu il più simile, o controlla il listino.'}
  setBase()}
function setBase(){const m=MODELS[+$('modello').value];$('listino').value=m[2];if(!optTouched)$('opt').value=Math.round(m[2]*P.up/100)*100;
  $('lsrc').textContent=m[4].startsWith('listino 2026')?'Listino 2026 da camperonline.it. Puoi correggerlo.':m[4]==='stimato dagli annunci'?'Modello fuori listino: prezzo base stimato dagli annunci.':'Dai configuratori nordaffari 2027'+(/Plus|Premium/.test(m[1])?' (pack incluso)':'')+'. Puoi correggerlo.';}
MESI.forEach((m,i)=>$('mese').add(new Option(m,i+1)));
for(let y=now.getFullYear();y>=2007;y--)$('anno').add(new Option(y,y));
// esempio
$('marca').value='Pössl';fillModels();$('modtxt').value='2Win Plus';autoRef();$('mese').value=5;$('anno').value=2019;$('km').value=67000;$('acc').value=3000;
try{const s=JSON.parse(localStorage.getItem('qv2-form')||'null');if(s&&MODELS[s.modello]){$('marca').value=MODELS[s.modello][0];fillModels(s.modello);$('modtxt').value=s.modtxt||'';refTouched=!!s.refTouched;for(const k of ['listino','opt','mese','anno','km','acc'])if(s[k]!=null)$(k).value=s[k];stato=s.stato||0;optTouched=!!s.optTouched}}catch(e){}
document.querySelectorAll('#stato button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.v===stato)));
$('marca').addEventListener('change',()=>{optTouched=false;refTouched=false;fillModels();autoRef();calc()});
$('modtxt').addEventListener('input',()=>{optTouched=false;refTouched=false;autoRef();calc()});
$('modello').addEventListener('change',()=>{optTouched=false;refTouched=true;$('mref').textContent='Scelto da te.';setBase();calc()});
$('opt').addEventListener('input',()=>{optTouched=true;calc()});
['listino','mese','anno','km','acc'].forEach(id=>$(id).addEventListener('input',calc));
$('stato').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;stato=+b.dataset.v;document.querySelectorAll('#stato button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));calc()});
function calc(){
  const mi=+$('modello').value, M=MODELS[mi];
  const L=+$('listino').value||0, opt=+$('opt').value||0, acc=+$('acc').value||0, y=+$('anno').value, m=+$('mese').value, km=+$('km').value||0;
  const a=ageOf(y,m), fa=ageFactor(a), ke=kmExp(a), dk=km-ke, fk=Math.pow(1+P.pkm,dk/1000);
  const bfac=BF[M[0]]||1, base=L+opt+acc, val=Math.round(base*bfac*fa*fk*(1+stato)/100)*100;
  const lo=Math.round(val*(1-P.band)/100)*100, hi=Math.round(val*(1+P.band)/100)*100;
  const warn=[];if(km>150000)warn.push('Oltre 150.000 km la stima è fuori dal campione e meno affidabile.');
  if(M[0]==='Hymer')warn.push('Per Hymer la correzione di marca si basa su circa 30 annunci: stima indicativa.');
  if(!CAL.has(M[0]))warn.push(M[0]+': curva di svalutazione presa da Pössl/Globecar, ancora da verificare sugli annunci di questa marca.');
  $('warn').hidden=!warn.length;$('warn').textContent=warn.join(' ');
  $('range').innerHTML=L?`${eur(lo)} <span>–</span> ${eur(hi)}`:'–';
  const mt=$('modtxt').value.trim();$('meta').innerHTML=`<span>${M[0]} ${mt||M[1]}${mt&&mt.toLowerCase()!==M[1].toLowerCase()?' (listino di riferimento: '+M[1]+')':''}</span><span>${a.toFixed(1).replace('.',',')} anni</span><span>${km.toLocaleString('it-IT')} km (attesi ${(Math.round(ke/500)*500).toLocaleString('it-IT')})</span>`;
  try{localStorage.setItem('qv2-form',JSON.stringify({modtxt:$('modtxt').value,refTouched,modello:mi,listino:L,opt,mese:m,anno:y,km,acc,stato,optTouched}))}catch(e){}
  $('v-val').textContent=eur(val);$('v-deal').textContent=eur(Math.round(val*(1-P.dealer)/100)*100);$('v-res').textContent=Math.round(val/(L+opt)*100)+'%';
  const kp=Math.abs(dk)/1000*Math.abs(P.pkm)*100, kn=Math.round(Math.abs(dk)/1000);
  $('steps').innerHTML=[`Listino ${eur(L)} + optional ${eur(opt)} + accessori ${eur(acc)} = ${eur(base)}`,
   `Età ${a.toFixed(1).replace('.',',')} anni: ${pct(P.p1)} il primo anno, ${pct(P.p2)} l'anno fino al sesto, poi ${pct(P.p3)} → resta il ${Math.round(fa*100)}%`,
   bfac!==1?`Correzione ${M[0]}: ${bfac>1?'+':'−'}${Math.abs(Math.round((bfac-1)*100))}% (rapporto tra listino italiano e prezzi reali dell'usato in Europa)`:'Correzione marca: nessuna (riferimento Pössl)',
   `Km: ${dk>=0?'−':'+'}${kp.toFixed(1).replace('.',',')}% per ${kn}.000 km ${dk>=0?'sopra':'sotto'} la media`,
   stato?`Stato: ${stato>0?'+':'−'}${Math.abs(stato*100)}%`:'Stato buono: nessuna correzione',
   `Ritiro da concessionario: −12,5% (margine di rivendita)`].map(s=>`<li>${s}</li>`).join('');
  drawChart(M,base,a,val); comps(M,y,km);
}
function pool(M){let p=ROWS.filter(r=>r[0]===M[3]);if(p.length<3)p=ROWS.filter(r=>r[1]===M[0]||(M[0]==='Pössl'&&r[1]==='Globecar'));return p}
function comps(M,y,km){
  const list=pool(M).map(r=>{const [mm,yy]=r[3].split('/').map(Number);return{r,d:Math.abs(yy+mm/12-y)+Math.abs(r[4]-km)/40000}}).sort((a,b)=>a.d-b.d).slice(0,6);
  $('comps').innerHTML=list.length?list.map(({r})=>`<tr><td>${r[1]} ${r[2]}</td><td>${r[3]}</td><td class="num">${r[4].toLocaleString('it-IT')}</td><td class="num">${eur(r[5])}</td><td>${r[6]==='m'?'mobile.de':'AutoScout24'} · ${r[7]}</td></tr>`).join(''):'<tr><td colspan="5">Ancora nessun annuncio raccolto per questa marca.</td></tr>';
}
function drawChart(M,base,age,val){
  const W=560,H=260,ml=52,mr=14,mt=12,mb=34,x0=0,x1=12;
  const pts=pool(M).map(r=>{const [mm,yy]=r[3].split('/').map(Number);return[ageOf(yy,mm),r[5]]});
  const ymax=Math.ceil(Math.max(base,...pts.map(p=>p[1]))/10000)*10000, ymin=Math.max(0,Math.floor(Math.min(base*ageFactor(12)*0.85,...pts.map(p=>p[1]))/10000)*10000);
  const X=v=>ml+(v-x0)/(x1-x0)*(W-ml-mr), Y=v=>mt+(1-(v-ymin)/(ymax-ymin))*(H-mt-mb);
  let g='';
  for(let v=ymin;v<=ymax;v+=10000)g+=`<line x1="${ml}" x2="${W-mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${ml-6}" y="${Y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${v/1000}k</text>`;
  for(let v=0;v<=12;v+=2)g+=`<text x="${X(v)}" y="${H-12}" text-anchor="middle" font-size="11" fill="var(--muted)">${v}</text>`;
  g+=`<text x="${W-mr}" y="${H-1}" text-anchor="end" font-size="11" fill="var(--muted)">anni</text>`;
  let d='';for(let t=0;t<=12;t+=0.25){d+=(t?'L':'M')+X(t).toFixed(1)+','+Y(base*ageFactor(t)).toFixed(1)}
  pts.forEach(p=>{if(p[0]<=12)g+=`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.5" fill="var(--muted)" fill-opacity=".45"/>`});
  g+=`<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`;
  const ax=Math.min(age,12);
  g+=`<circle cx="${X(ax)}" cy="${Y(val)}" r="6" fill="var(--amber)" stroke="var(--surface)" stroke-width="2"/>`;
  const right=X(ax)>W-130;
  g+=`<text x="${X(ax)+(right?-10:10)}" y="${Y(val)-10}" text-anchor="${right?'end':'start'}" font-size="12" font-weight="600" fill="var(--ink)">Il tuo: ${eur(val)}</text>`;
  $('chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva di valore per età con annunci reali">${g}</svg><p class="hint">Linea: valore stimato a km medi per il tuo listino. Punti: annunci reali dello stesso modello (o della stessa marca se sono pochi).</p>`;
}
calc();
}

Promise.all(['modelli','annunci','parametri'].map(n=>fetch('data/'+n+'.json').then(r=>r.json()))).then(([m,rows,par])=>{
  avvia({models:m.map(x=>[x.marca,x.nome,x.prezzo,x.serie,x.gruppo]),rows,fit:par.fit,bf:par.bf});
}).catch(()=>{document.getElementById('range').textContent='Dati non disponibili, riprova più tardi.'});
