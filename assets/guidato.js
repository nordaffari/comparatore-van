// Configuratore guidato: lunghezza -> letti -> bagno -> cambio -> accessori.
// A ogni passo restano i van compatibili; il cliente puo' togliere un modello quando vuole.
const $=id=>document.getElementById(id);
const eur=v=>(v<0?'- ':'')+'€ '+String(Math.abs(Math.round(v))).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const LEN={minivan:'Minivan',540:'5,40 m',600:'6,00 m',636:'6,36 m',oltre:'Oltre 6,50 m','da verificare':'Da verificare'};
const LEN_SUB={minivan:'meno di 5,4 m, letto nel tetto',540:'circa 5,40 m',600:'da 5,90 a 6,05 m',636:'da 6,36 a 6,40 m',oltre:'7 m, patente C'};
const LETTI={trasversale:'Matrimoniale trasversale',longitudinali:'Letti longitudinali',castello:'Letti a castello o doppio matrimoniale',dinette:'Dinette in coda',soffietto:'Letto nel tetto (minivan)','da verificare':'Da verificare'};
const LETTI_SUB={trasversale:'letto in coda di traverso',longitudinali:'due letti singoli, unibili',castello:'4 posti letto in coda',dinette:'salotto a ferro di cavallo',soffietto:'divano letto e tetto sollevabile'};
const BAGNO={classico:'Bagno classico',vario:'Bagno Vario',separata:'Bagno R centrale',senza:'Senza bagno','con bagno':'Bagno nel minivan','da verificare':'Da verificare'};
const BAGNO_SUB={classico:'con tendina doccia',vario:'con doccia separabile',separata:'bagno centrale con doccia separabile',senza:'solo WC portatile','con bagno':'bagno compatto'};

const STEPS=[
  {id:'len',key:'lunghezza',nome:'Lunghezza',titolo:'Quanto lungo vuoi il van?',hint:'Puoi sceglierne più di una. Nessuna scelta vuol dire tutte.',lab:LEN,sub:LEN_SUB},
  {id:'letti',key:'letti',nome:'Letti',titolo:'Che letti preferisci?',hint:'Puoi sceglierne più di uno.',lab:LETTI,sub:LETTI_SUB},
  {id:'bagno',key:'bagno',nome:'Bagno',titolo:'Che bagno ti serve?',hint:'I van con il bagno ancora da verificare restano sempre in lista, segnalati.',lab:BAGNO,sub:BAGNO_SUB},
  {id:'cambio',nome:'Cambio',titolo:'Cambio manuale o automatico?',hint:'Con l\'automatico il prezzo si aggiorna con il sovrapprezzo di ogni marca (0 se è di serie).'},
  {id:'acc',nome:'Accessori',titolo:'Quali accessori vuoi?',hint:'Su alcuni van sono di serie (costo zero), su altri alzano il prezzo. I van che non li offrono escono dalla lista.'},
  {id:'fine',nome:'Riepilogo',titolo:'Riepilogo'}
];

let D={accessori:[],modelli:[]}, SC={predefinito:0,marche:{}};
let st={step:0,len:new Set(),letti:new Set(),bagno:new Set(),cambio:'',acc:new Set(),out:new Set(),mis:true,sort:'prezzo'};

// ---------- stato nell'indirizzo, per condividere la configurazione ----------
function salva(){
  const p=new URLSearchParams();
  const put=(k,s)=>{if(s.size)p.set(k,[...s].join(','))};
  put('l',st.len);put('t',st.letti);put('b',st.bagno);put('a',st.acc);put('x',st.out);
  if(st.cambio)p.set('c',st.cambio);
  if(!st.mis)p.set('m','0');
  if(st.sort!=='prezzo')p.set('o',st.sort);
  p.set('p',st.step);
  history.replaceState(null,'','#'+p.toString());
}
function carica(){
  const p=new URLSearchParams(location.hash.slice(1));
  const get=k=>new Set((p.get(k)||'').split(',').filter(Boolean));
  st.len=get('l');st.letti=get('t');st.bagno=get('b');st.acc=get('a');
  st.out=new Set([...get('x')].map(Number));
  st.cambio=p.get('c')||'';st.mis=p.get('m')!=='0';st.sort=p.get('o')||'prezzo';
  st.step=Math.min(Math.max(+p.get('p')||0,0),STEPS.length-1);
}

// ---------- filtri ----------
function passaScelta(m,i){
  const s=STEPS[i];
  if(s.id==='len')return !st.len.size||st.len.has(m.lunghezza);
  if(s.id==='letti')return !st.letti.size||st.letti.has(m.letti);
  if(s.id==='bagno')return !st.bagno.size||m.bagno==='da verificare'||st.bagno.has(m.bagno);
  return true;
}
// van che passano lunghezza/letti/bagno fino al passo "fino" escluso
function base(fino){return D.modelli.filter(m=>{for(let i=0;i<Math.min(fino,3);i++)if(!passaScelta(m,i))return false;return true})}

// motivo per cui un van non e' compatibile con cambio e accessori scelti ('' se lo e')
function manca(m){
  const r=[];
  if(st.cambio==='manuale'&&!m.cambio.manuale)r.push('solo cambio automatico');
  if(st.cambio==='automatico'&&m.cambio.automatico==null)r.push('cambio automatico non disponibile');
  const cop=new Set(m.righe.filter(x=>!(st.acc.has('tetto')&&/non con (il )?tetto/i.test(x[0]))).flatMap(x=>x[2]));
  const no=[...st.acc].filter(a=>!cop.has(a)).map(nomeAcc);
  if(no.length)r.push('senza '+no.join(', ').toLowerCase());
  return r.join('; ');
}
function nomeAcc(id){const a=D.accessori.find(x=>x.id===id);return a?a.nome:id}

// ---------- prezzi ----------
// combinazione di righe di listino piu' economica che copre gli accessori scelti
// (un pacchetto che ne comprende piu' d'uno si conta una volta sola)
function costoAccessori(m,scelti){
  const k=scelti.length;
  if(!k)return{costo:0,righe:[]};
  const full=(1<<k)-1;
  // con il tetto sollevabile non si contano le voci che il listino dichiara incompatibili ("non con tetto a soffietto")
  const conTetto=scelti.includes('tetto');
  const rows=m.righe.filter(x=>!(conTetto&&/non con (il )?tetto/i.test(x[0]))).map(([t,p,c])=>{let mk=0;scelti.forEach((a,i)=>{if(c.includes(a))mk|=1<<i});return{t,p,mk}}).filter(r=>r.mk);
  let dp=new Array(full+1).fill(Infinity), sel=new Array(full+1).fill(null);
  dp[0]=0;sel[0]=[];
  rows.forEach((r,ri)=>{
    const pd=dp.slice(), ps=sel.slice();
    for(let mk=0;mk<=full;mk++){
      if(pd[mk]===Infinity)continue;
      const n=mk|r.mk, c=pd[mk]+r.p;
      if(c<dp[n]){dp[n]=c;sel[n]=ps[mk].concat(ri)}
    }
  });
  if(dp[full]===Infinity)return null;
  return{costo:dp[full],righe:sel[full].map(i=>rows[i]).map(r=>({t:r.t,p:r.p,acc:scelti.filter((a,i)=>r.mk>>i&1)}))};
}
function sconto(marca){const v=SC.marche&&SC.marche[marca];return typeof v==='number'?v:(SC.predefinito||0)}
function prezzo(m){
  const cambio=st.cambio==='automatico'?(m.cambio.automatico||0):0;
  const acc=costoAccessori(m,[...st.acc])||{costo:0,righe:[]};
  const listino=m.prezzo+cambio+acc.costo;
  const sc=sconto(m.marca);
  // sconto: frazione (0.08 = 8%) oppure importo fisso in euro se maggiore di 1
  const scontato=Math.round(sc>1?listino-sc:listino*(1-sc));
  const mis=st.mis?(m.messa_in_strada||0):0;
  return{base:m.prezzo,cambio,acc,listino,sc,scontato,mis,totListino:listino+mis,totScontato:scontato+mis};
}

// ---------- disegno ----------
const sc=n=>n===1?'1 scelto':n+' scelti';
function drawSteps(){
  const nav=$('steps');nav.innerHTML='';
  STEPS.forEach((s,i)=>{
    const b=document.createElement('button');b.type='button';
    let sel='';
    if(s.id==='len'&&st.len.size)sel=[...st.len].map(v=>LEN[v]).join(', ');
    if(s.id==='letti'&&st.letti.size)sel=sc(st.letti.size);
    if(s.id==='bagno'&&st.bagno.size)sel=sc(st.bagno.size);
    if(s.id==='cambio'&&st.cambio)sel=st.cambio;
    if(s.id==='acc'&&st.acc.size)sel=sc(st.acc.size);
    b.innerHTML=esc(s.nome)+(sel?` <small>${esc(sel)}</small>`:'');
    if(i===st.step)b.setAttribute('aria-current','step');
    else if(sel)b.className='fatto';
    b.onclick=()=>{st.step=i;render()};
    nav.appendChild(b);
  });
}

function opzione(label,sub,on,dis,fn){
  const b=document.createElement('button');b.type='button';b.className='opt';
  b.innerHTML=`<b>${esc(label)}</b>`+sub.map(x=>`<span>${esc(x)}</span>`).join('');
  b.setAttribute('aria-pressed',String(on));b.disabled=dis;b.onclick=fn;return b;
}

function drawDomanda(){
  const s=STEPS[st.step], box=$('domanda');
  box.innerHTML=`<h2>${esc(s.titolo)}</h2>`+(s.hint?`<p class="hint">${esc(s.hint)}</p>`:'');
  const cand=base(st.step).filter(m=>!st.out.has(m.id));
  if(s.key){
    const sel=st[s.id], wrap=document.createElement('div');wrap.className='opts';
    const vals=Object.keys(s.lab).filter(v=>D.modelli.some(m=>m[s.key]===v));
    vals.forEach(v=>{
      const lst=cand.filter(m=>m[s.key]===v);
      const sub=[];if(s.sub[v])sub.push(s.sub[v]);
      sub.push(lst.length?`${lst.length} van, da ${eur(Math.min(...lst.map(m=>m.prezzo)))}`:'nessun van con le scelte fatte');
      if(lst.length)sub.push([...new Set(lst.map(m=>m.marca))].join(', '));
      wrap.appendChild(opzione(s.lab[v],sub,sel.has(v),!lst.length&&!sel.has(v),()=>{sel.has(v)?sel.delete(v):sel.add(v);render()}));
    });
    box.appendChild(wrap);
  }else if(s.id==='cambio'){
    const wrap=document.createElement('div');wrap.className='opts';
    const man=cand.filter(m=>m.cambio.manuale), aut=cand.filter(m=>m.cambio.automatico!=null);
    const serie=aut.filter(m=>m.cambio.automatico===0).length;
    const extra=aut.filter(m=>m.cambio.automatico>0).map(m=>m.cambio.automatico);
    wrap.appendChild(opzione('Indifferente',['prezzi con il motore di serie',`${cand.length} van`],!st.cambio,false,()=>{st.cambio='';render()}));
    wrap.appendChild(opzione('Manuale',[`${man.length} van`],st.cambio==='manuale',!man.length,()=>{st.cambio=st.cambio==='manuale'?'':'manuale';render()}));
    wrap.appendChild(opzione('Automatico',[`${aut.length} van`+(serie?`, di serie su ${serie}`:''),extra.length?`sovrapprezzo da ${eur(Math.min(...extra))} a ${eur(Math.max(...extra))}`:''].filter(Boolean),st.cambio==='automatico',!aut.length,()=>{st.cambio=st.cambio==='automatico'?'':'automatico';render()}));
    box.appendChild(wrap);
  }else if(s.id==='acc'){
    const pool=cand.filter(m=>!(st.cambio==='manuale'&&!m.cambio.manuale)&&!(st.cambio==='automatico'&&m.cambio.automatico==null));
    const wrap=document.createElement('div');wrap.className='acc';
    D.accessori.forEach(a=>{
      let serie=0,pag=0,no=0;const pr=[];
      pool.forEach(m=>{const r=m.righe.filter(x=>x[2].includes(a.id));if(!r.length)no++;else{const p=Math.min(...r.map(x=>x[1]));p===0?serie++:(pag++,pr.push(p))}});
      const info=[serie?`di serie su ${serie}`:'',pag?`a pagamento su ${pag} (da ${eur(Math.min(...pr))})`:'',no?`non disponibile su ${no}`:''].filter(Boolean).join(' · ');
      const l=document.createElement('label');
      l.innerHTML=`<input type="checkbox" ${st.acc.has(a.id)?'checked':''}><span>${esc(a.nome)}<small>${esc(info||'nessun van')}</small></span>`;
      l.querySelector('input').onchange=e=>{e.target.checked?st.acc.add(a.id):st.acc.delete(a.id);render()};
      wrap.appendChild(l);
    });
    box.appendChild(wrap);
  }else{
    const r=[];
    r.push(['Lunghezza',st.len.size?[...st.len].map(v=>LEN[v]).join(', '):'tutte']);
    r.push(['Letti',st.letti.size?[...st.letti].map(v=>LETTI[v]).join(', '):'tutti']);
    r.push(['Bagno',st.bagno.size?[...st.bagno].map(v=>BAGNO[v]).join(', '):'tutti']);
    r.push(['Cambio',st.cambio||'indifferente']);
    r.push(['Accessori',st.acc.size?[...st.acc].map(nomeAcc).join(', '):'nessuno']);
    const t=document.createElement('div');t.className='tbl';
    t.innerHTML='<table><tbody>'+r.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')+'</tbody></table>';
    box.appendChild(t);
  }
  const nb=document.createElement('div');nb.className='navbtn';
  const sx=document.createElement('div'),dx=document.createElement('div');
  if(st.step>0){const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent='Indietro';b.onclick=()=>{st.step--;render()};sx.appendChild(b)}
  const az=document.createElement('button');az.type='button';az.className='btn ghost';az.textContent='Ricomincia';az.style.marginLeft='8px';
  az.onclick=()=>{st={step:0,len:new Set(),letti:new Set(),bagno:new Set(),cambio:'',acc:new Set(),out:new Set(),mis:st.mis,sort:st.sort};render()};sx.appendChild(az);
  if(st.step<STEPS.length-1){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Avanti: '+STEPS[st.step+1].nome;b.onclick=()=>{st.step++;render();window.scrollTo({top:0,behavior:'smooth'})};dx.appendChild(b)}
  else{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Stampa';b.onclick=()=>window.print();dx.appendChild(b)}
  nb.append(sx,dx);box.appendChild(nb);
}

function pill(t,cls){return`<span class="pill${cls?' '+cls:''}">${esc(t)}</span>`}

function cardVan(m,p,stato,motivo){
  const d=document.createElement('div');d.className='van'+(stato==='in'?'':' fuori');
  const cb=document.createElement('input');cb.type='checkbox';cb.checked=stato==='in';cb.disabled=stato==='non';
  cb.title=stato==='in'?'Togli questo van dalla scelta':'Rimetti questo van nella scelta';
  cb.setAttribute('aria-label',cb.title+': '+m.marca+' '+m.nome);
  cb.onchange=()=>{cb.checked?st.out.delete(m.id):st.out.add(m.id);render()};
  const lung=m.lunghezza_cm?(m.lunghezza_cm/100).toFixed(2).replace('.',',')+' m':LEN[m.lunghezza];
  const meta=[pill(m.telaio,'muted'),pill(lung,'muted'),pill(LETTI[m.letti]||m.letti,m.letti==='da verificare'?'warn':''),
    pill(m.bagno==='da verificare'?'bagno da verificare':(BAGNO[m.bagno]||m.bagno),m.bagno==='da verificare'?'warn':'')];
  const mid=document.createElement('div');
  mid.innerHTML=`<h3><small>${esc(m.marca)}</small> ${esc(m.nome)}</h3><div class="meta">${meta.join('')}</div>`+(motivo?`<div class="mancano">${esc(motivo)}</div>`:'');
  const pr=document.createElement('div');pr.className='prezzi';
  const extra=p.cambio+p.acc.costo;
  pr.innerHTML=`<span class="da">da ${eur(p.base)}${extra?' + optional '+eur(extra):''}</span>`+(p.sc>0?`<s>${eur(p.totListino)}</s>`:'')+`<b>${eur(p.totScontato)}</b>`;
  const det=document.createElement('details');
  const righe=[[`Prezzo base: ${m.motore}`,p.base]];
  if(st.cambio==='automatico')righe.push([m.cambio.automatico===0?'Cambio automatico (di serie)':'Cambio automatico: '+(m.cambio.riga||''),p.cambio]);
  p.acc.righe.forEach(r=>righe.push([`${r.acc.map(nomeAcc).join(', ')}: ${r.t}`,r.p]));
  let html='<table><tbody>'+righe.map(([t,v])=>`<tr><td>${esc(t)}</td><td>${v===0?'<span class="serie">di serie</span>':eur(v)}</td></tr>`).join('');
  html+=`<tr><td><b>Totale listino</b></td><td><b>${eur(p.listino)}</b></td></tr>`;
  if(p.sc>0)html+=`<tr><td>Sconto ${p.sc>1?'':Math.round(p.sc*1000)/10+'%'}</td><td>- ${eur(p.listino-p.scontato)}</td></tr>`;
  if(p.mis)html+=`<tr><td>Messa in strada</td><td>${eur(p.mis)}</td></tr>`;
  html+=`<tr><td><b>Prezzo finale</b></td><td><b>${eur(p.totScontato)}</b></td></tr></tbody></table>`;
  if(m.descrizione)html+=`<p class="hint" style="margin-top:6px">${esc(m.descrizione)}</p>`;
  det.innerHTML='<summary>Dettaglio prezzo</summary>'+html;
  d.append(cb,mid,pr,det);
  return d;
}

function ordina(a,b){
  if(st.sort==='marca')return a.m.marca.localeCompare(b.m.marca)||a.p.totScontato-b.p.totScontato;
  return a.p.totScontato-b.p.totScontato;
}

function drawLista(){
  const tutti=base(3).map(m=>({m,p:prezzo(m),mot:manca(m)}));
  const dentro=tutti.filter(x=>!x.mot&&!st.out.has(x.m.id)).sort(ordina);
  const esclusi=tutti.filter(x=>!x.mot&&st.out.has(x.m.id)).sort(ordina);
  const non=tutti.filter(x=>x.mot).sort(ordina);
  const L=$('lista');L.innerHTML='';
  if(!dentro.length)L.innerHTML='<p class="empty">Nessun van con queste scelte. Torna indietro o rimetti qualche modello.</p>';
  dentro.forEach(x=>L.appendChild(cardVan(x.m,x.p,'in')));
  const ge=$('g-esclusi'),E=$('esclusi');E.innerHTML='';
  ge.hidden=!esclusi.length;
  ge.querySelector('summary').textContent=`Tolti da te (${esclusi.length})`;
  esclusi.forEach(x=>E.appendChild(cardVan(x.m,x.p,'out')));
  const gn=$('g-non'),N=$('non');N.innerHTML='';
  gn.hidden=!non.length;
  gn.querySelector('summary').textContent=`Non compatibili con cambio o accessori scelti (${non.length})`;
  non.forEach(x=>N.appendChild(cardVan(x.m,x.p,'non',x.mot)));
  const marche=new Set(dentro.map(x=>x.m.marca)).size;
  $('h-res').textContent=`${dentro.length} van corrispondenti`;
  $('tag-tot').textContent=`${dentro.length} van · ${marche} marchi`;
}

function render(){
  drawSteps();drawDomanda();drawLista();
  $('o-mis').checked=st.mis;$('o-sort').value=st.sort;
  salva();
}

$('o-mis').onchange=e=>{st.mis=e.target.checked;render()};
$('o-sort').onchange=e=>{st.sort=e.target.value;render()};

Promise.all([
  fetch('data/guidato.json').then(r=>r.json()),
  fetch('data/sconti.json').then(r=>r.ok?r.json():{}).catch(()=>({}))
]).then(([d,s])=>{
  D=d;SC=Object.assign({predefinito:0,marche:{}},s);
  if(SC.nota_sito)$('nota').textContent+=' '+SC.nota_sito;
  carica();render();
}).catch(()=>{$('lista').innerHTML='<p class="empty">Dati non disponibili.</p>'});
