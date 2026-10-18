// Comparatore del nuovo: filtri, matrice lunghezza x disposizione, confronto fino a 4 modelli.
const $=id=>document.getElementById(id);
const eur=v=>'€ '+Math.round(v).toLocaleString('it-IT');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LEN=['5,40 m','6,00 m','6,36 m','minivan','4x4 e Sprinter','da verificare'];
const DISP=['letto trasversale','letti longitudinali','letti a castello','living o servizi posteriori','minivan (letto a soffietto)','da verificare'];
const MAX_CMP=4;
// Dotazioni senza le quali il van non e' utilizzabile come camper: se non sono di serie lo segnaliamo
const ESSENZIALI=['riscaldamento','acqua_calda','frigorifero','wc'];
const BREVE={riscaldamento:'riscaldamento',acqua_calda:'acqua calda',frigorifero:'frigo',wc:'WC'};

let M=[], DOT={}, VOCI={}, st={len:new Set(),disp:new Set(),marche:new Set(),telaio:'',max:0,q:''}, cmp=[];

function chip(label,on,fn){const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=label;b.setAttribute('aria-pressed',String(on));b.onclick=fn;return b}
function toggle(set,v){set.has(v)?set.delete(v):set.add(v)}

function pass(m,skip){
  if(skip!=='len'&&st.len.size&&!st.len.has(m.lunghezza))return false;
  if(skip!=='disp'&&st.disp.size&&!st.disp.has(m.disposizione))return false;
  if(!st.marche.has(m.marca))return false;
  if(st.telaio&&m.telaio!==st.telaio)return false;
  if(m.prezzo>st.max)return false;
  if(st.q&&!(m.marca+' '+m.nome).toLowerCase().includes(st.q))return false;
  return true;
}

function drawFilters(){
  const fl=$('f-len');fl.innerHTML='';
  LEN.filter(l=>M.some(m=>m.lunghezza===l)).forEach(l=>fl.appendChild(chip(l,st.len.has(l),()=>{toggle(st.len,l);render()})));
  const fd=$('f-disp');fd.innerHTML='';
  DISP.filter(d=>M.some(m=>m.disposizione===d)).forEach(d=>fd.appendChild(chip(d,st.disp.has(d),()=>{toggle(st.disp,d);render()})));
  const fm=$('f-marca');fm.innerHTML='';
  [...new Set(M.map(m=>m.marca))].forEach(b=>fm.appendChild(chip(b,st.marche.has(b),()=>{toggle(st.marche,b);if(!st.marche.size)M.forEach(m=>st.marche.add(m.marca));render()})));
  $('f-max-v').textContent=eur(st.max);
}

function drawMatrix(){
  const lens=LEN.filter(l=>M.some(m=>m.lunghezza===l)), disps=DISP.filter(d=>M.some(m=>m.disposizione===d));
  $('mx-h').innerHTML='<tr><th>Lunghezza</th>'+disps.map(d=>`<th>${esc(d)}</th>`).join('')+'</tr>';
  $('mx-b').innerHTML='';
  lens.forEach(l=>{
    const tr=document.createElement('tr');tr.innerHTML=`<td><b>${esc(l)}</b></td>`;
    disps.forEach(d=>{
      const list=M.filter(m=>m.lunghezza===l&&m.disposizione===d&&pass(m,'len')&&pass(m,'disp'));
      const td=document.createElement('td'), b=document.createElement('button');b.type='button';b.className='cell';
      const on=st.len.size===1&&st.len.has(l)&&st.disp.size===1&&st.disp.has(d);
      b.setAttribute('aria-pressed',String(on));
      if(list.length){const ps=list.map(m=>m.prezzo);b.innerHTML=`<b>${list.length} modelli</b><span>da ${eur(Math.min(...ps))}</span><span>${new Set(list.map(m=>m.marca)).size} marchi</span>`}
      else{b.innerHTML='<span>nessun modello</span>';b.disabled=true}
      b.onclick=()=>{if(on){st.len.clear();st.disp.clear()}else{st.len=new Set([l]);st.disp=new Set([d])}render()};
      td.appendChild(b);tr.appendChild(td)});
    $('mx-b').appendChild(tr)});
}

function dot(m){return DOT[m.marca+'|'+m.nome]||DOT[m.marca+'|'+m.serie]||null}
function mancanti(m){const d=dot(m);if(!d)return[];return ESSENZIALI.filter(k=>d.voci[k]&&d.voci[k].stato!=='serie')}
function notaMancanti(m){const x=mancanti(m);return x.length?`<span class="pill warn">${x.map(k=>BREVE[k]).join(', ')} non di serie</span>`:''}
function statoPill(v){if(!v)return'<span class="pill muted">n.d.</span>';
  const t=v.testo?`<span class="vtxt">${esc(v.testo)}</span>`:'';
  if(v.stato==='serie')return`<span class="pill">di serie</span>${t}`;
  if(v.stato==='optional')return`<span class="pill warn">optional${v.prezzo?' + '+eur(v.prezzo):''}</span>${t}`;
  return`<span class="pill bad">non disponibile</span>${t}`}

function dispPill(m){return m.disposizione==='da verificare'?'<span class="pill warn">da verificare</span>':esc(m.disposizione)}

function drawList(){
  const list=M.filter(m=>pass(m)).sort((a,b)=>a.prezzo-b.prezzo);
  const min=list.length?list[0].prezzo:0;
  $('res-n').textContent=list.length+' modelli';
  $('lista').innerHTML=list.length?list.map(m=>{const on=cmp.includes(m.id);
    return `<tr class="${on?'sel':''}"><td>${esc(m.marca)}</td><td class="nome">${esc(m.nome)}${mancanti(m).length?'<br>'+notaMancanti(m):''}</td><td>${esc(m.lunghezza)}</td><td>${dispPill(m)}</td><td>${esc(m.telaio)}</td><td class="num">${eur(m.prezzo)}</td><td class="num delta">${m.prezzo===min?'il più economico':'+ '+eur(m.prezzo-min)}</td><td><button type="button" class="cmpbtn" data-id="${m.id}" aria-pressed="${on}">${on?'In confronto':'Confronta'}</button></td></tr>`}).join('')
    :'<tr><td colspan="8">Nessun modello con questi filtri.</td></tr>';
}

function drawCmp(){
  const sel=cmp.map(id=>M.find(m=>m.id===id));
  if(!sel.length){$('cmp').innerHTML='<p class="empty">Premi "Confronta" su 2, 3 o 4 modelli della lista per vederli fianco a fianco.</p>';return}
  const min=Math.min(...sel.map(m=>m.prezzo));
  $('cmp').innerHTML='<div class="cmp">'+sel.map(m=>{const d=m.prezzo-min;
    return `<article class="cmpcard"><p class="eyebrow">${esc(m.marca)}</p><h3>${esc(m.nome)}</h3>
    <div class="price">${eur(m.prezzo)}</div>
    <div class="diff ${d?'up':'down'}">${d?'+ '+eur(d)+' rispetto al più economico':'Il più economico del confronto'}</div>
    <dl><dt>Lunghezza</dt><dd>${esc(m.lunghezza)}${m.lunghezza_cm?' ('+(m.lunghezza_cm/100).toFixed(2).replace('.',',')+' m)':''}</dd>
    <dt>Disposizione</dt><dd>${dispPill(m)}</dd>${mancanti(m).length?'<dt>Attenzione</dt><dd>'+notaMancanti(m)+'</dd>':''}<dt>Telaio</dt><dd>${esc(m.telaio)}</dd><dt>Serie</dt><dd>${esc(m.gruppo)}</dd><dt>Fonte</dt><dd>${esc(m.fonte)}</dd></dl>
    <button type="button" class="cmpbtn" data-id="${m.id}" aria-pressed="true">Togli dal confronto</button></article>`}).join('')+'</div>'+
    (sel.length===1?'<p class="hint" style="margin-top:10px">Aggiungi almeno un altro modello per il confronto.</p>':'')+tabDotazioni(sel);
}

function tabDotazioni(sel){
  const keys=Object.keys(VOCI);if(!keys.length||!sel.some(dot))return'<p class="hint" style="margin-top:12px">Dotazioni chiave non ancora disponibili per questi modelli.</p>';
  return `<div class="tbl" style="margin-top:16px"><table class="dottab"><thead><tr><th>Dotazioni chiave</th>${sel.map(m=>`<th>${esc(m.marca)} ${esc(m.nome)}</th>`).join('')}</tr></thead><tbody>`+
    keys.map(k=>`<tr><td><b>${esc(VOCI[k])}</b></td>${sel.map(m=>{const d=dot(m);return`<td>${d?statoPill(d.voci[k]):'<span class="pill muted">n.d.</span>'}</td>`}).join('')}</tr>`).join('')+
    `<tr><td><b>Fonti</b></td>${sel.map(m=>{const d=dot(m);return`<td>${d?d.fonti.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener">${i+1}</a>`).join(' '):''}</td>`}).join('')}</tr></tbody></table></div>
    <p class="hint" style="margin-top:6px">n.d. = non ancora verificato. Le dotazioni dei marchi trattati da Nordaffari arriveranno dai listini ufficiali.</p>`;
}

function render(){drawFilters();drawMatrix();drawList();drawCmp();save()}

function save(){try{localStorage.setItem('cmp-v1',JSON.stringify({len:[...st.len],disp:[...st.disp],telaio:st.telaio,max:st.max,cmp}))}catch(e){}}

document.addEventListener('click',e=>{const b=e.target.closest('.cmpbtn');if(!b)return;const id=+b.dataset.id;
  if(cmp.includes(id))cmp=cmp.filter(x=>x!==id);else{if(cmp.length>=MAX_CMP)cmp.shift();cmp.push(id)}
  render();if(b.closest('#lista')&&cmp.includes(id)&&cmp.length>=2)$('cmp-sec').scrollIntoView({behavior:'smooth',block:'start'})});

function reset(){st.len.clear();st.disp.clear();st.marche=new Set(M.map(m=>m.marca));st.telaio='';st.max=+$('f-max').max;st.q='';
  $('f-telaio').value='';$('f-max').value=st.max;$('f-q').value=''}

Promise.all([fetch('data/modelli.json').then(r=>r.json()),fetch('data/dotazioni.json').then(r=>r.json()).catch(()=>({}))]).then(([data,dt])=>{
  M=data.filter(m=>!m.fuori_listino);
  VOCI=dt._voci||{};delete dt._voci;DOT=dt;
  const top=Math.ceil(Math.max(...M.map(m=>m.prezzo))/1000)*1000;$('f-max').max=top;
  [...new Set(M.map(m=>m.telaio))].filter(t=>t!=='n.d.').sort().forEach(t=>$('f-telaio').add(new Option(t,t)));
  reset();
  try{const s=JSON.parse(localStorage.getItem('cmp-v1')||'null');if(s){st.len=new Set(s.len);st.disp=new Set(s.disp);st.telaio=s.telaio||'';st.max=s.max||top;cmp=(s.cmp||[]).filter(id=>M.some(m=>m.id===id));$('f-telaio').value=st.telaio;$('f-max').value=st.max}}catch(e){}
  $('tag-tot').textContent=M.length+' modelli · '+new Set(M.map(m=>m.marca)).size+' marchi';
  $('f-telaio').onchange=e=>{st.telaio=e.target.value;render()};
  $('f-max').oninput=e=>{st.max=+e.target.value;render()};
  $('f-q').oninput=e=>{st.q=e.target.value.trim().toLowerCase();render()};
  $('reset').onclick=()=>{reset();render()};
  render();
}).catch(()=>{$('lista').innerHTML='<tr><td colspan="8">Dati non disponibili, riprova più tardi.</td></tr>'});
