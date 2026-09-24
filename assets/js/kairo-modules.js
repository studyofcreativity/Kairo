
/* === assets/js/modules/00-module-loader.js === */
(function () {
  'use strict';

  function showApp() {
    const app = document.querySelector('.app');
    const loading = document.getElementById('loadingScreen');

    // Las páginas de los módulos usan la misma clase .app que la portada.
    // La portada ya añade .ready mediante su sistema principal, pero los
    // módulos son páginas independientes y necesitan activarlo aquí.
    if (app) app.classList.add('ready');
    if (loading) loading.classList.add('is-hidden');
  }

  // Mostrar el módulo aunque una fuente externa u otro recurso tarde demasiado.
  let finished = false;
  function finishOnce() {
    if (finished) return;
    finished = true;
    showApp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finishOnce, { once: true });
  } else {
    finishOnce();
  }

  window.addEventListener('load', finishOnce, { once: true });

  // Respaldo para file://, bloqueadores, fuentes externas o recursos lentos.
  window.setTimeout(finishOnce, 2500);
})();


/* === assets/js/modules/01-metadata.js === */
(function(){
  const q=document.getElementById('metadataQuery');
  const t=document.getElementById('metadataType');
  const langEl=document.getElementById('metadataLang');
  const b=document.getElementById('metadataSearch');
  const r=document.getElementById('metadataResult');
  const card=document.getElementById('metadataCard');
  if(!q||!t||!b||!r||!card)return;

  let lastRaw='';
  let lastAlternatives=[];
  let lastResult=null;

  async function polishItem(item){
    if(!item)return null;
    let out={...item};
    if(out.synopsis && window.KairoTranslate){
      try{
        const es=await KairoTranslate.toSpanish(out.synopsis);
        if(es)out.synopsis=es;
      }catch{}
    }
    if(out.genres && window.KairoTranslate){
      out.genres=KairoTranslate.genresToSpanish(out.genres);
    }
    if(out.status && window.KairoUtils){
      out.status=KairoUtils.translateStatus(out.status);
    }
    return out;
  }

  function uniqueTitles(list){
    const seen=new Set();
    const out=[];
    for(const x of list||[]){
      const title=x.title||x;
      const k=KairoUtils.normalizeText(title);
      if(!k||seen.has(k))continue;
      seen.add(k);
      out.push(typeof x==='string'?{title:x}:x);
    }
    return out;
  }

  function renderAlternativesPicker(raw, alternatives, currentTitle){
    const alts=uniqueTitles(alternatives)
      .filter(a=>KairoUtils.normalizeText(a.title)!==KairoUtils.normalizeText(currentTitle||''))
      .slice(0,8);
    if(!alts.length)return '';
    return `<div class="alt-picker square">
      <strong>¿No es este? Elige otro resultado</strong>
      <div class="alt-picker-list">${alts.map(a=>`
        <button type="button" class="square-button alt-pick-btn" data-title="${KairoUtils.esc(a.title)}" data-type="${KairoUtils.esc(a.type||t.value)}">
          ${KairoUtils.esc(a.title)}
          <small>${KairoUtils.esc(a.source||'candidato')}</small>
        </button>`).join('')}
      </div>
    </div>`;
  }

  function render(item,source,raw){
    if(!item){
      r.innerHTML=`<strong>No encontré una ficha para “${KairoUtils.esc(raw)}”.</strong>
        <span>Prueba cambiar el idioma del nombre, el tipo (anime/manga) o una forma distinta del título.</span>`;
      card.innerHTML='<div class="empty-state">No hay datos suficientes para construir una ficha.</div>';
      return;
    }
    lastRaw=raw;
    q.value=item.title;
    KairoCrossModule.saveLastMetadata(item);

    const status=KairoUtils.translateStatus(item.status)||item.status||'—';
    const synopsis=KairoUtils.cleanSynopsis(item.synopsis||'')||'No hay sinopsis disponible.';
    const units=item.type==='Manga'
      ?(item.volumes?`${item.volumes} tomos`:'—')
      :(item.episodes?`${item.episodes} episodios`:'—');
    const credit=item.type==='Manga'?(item.author||'—'):(item.studio||'—');
    const score=item.score?`${Number(item.score).toFixed(1)}/10`:'—';
    const pop=KairoUtils.formatPopularity(item.popularity);
    const year=item.year||'—';
    const sources=(item.sources||[]).join(' · ')||source||'catálogo local';

    const alternatives=[item.matchedAlias,...(item.aliases||[])]
      .filter(Boolean)
      .filter((x,i,a)=>KairoUtils.normalizeText(x)!==KairoUtils.normalizeText(item.title))
      .filter((x,i,a)=>a.findIndex(y=>KairoUtils.normalizeText(y)===KairoUtils.normalizeText(x))===i)
      .slice(0,12);

    const info=[
      ['ESTADO',status],['AÑO',year],['EXTENSIÓN',units],
      ['PUNTUACIÓN',score],['POPULARIDAD',pop],['CRÉDITOS',credit]
    ];

    const picker=renderAlternativesPicker(raw, lastAlternatives, item.title);

    // Opciones de alternativas para el reporte
    const reportAlts=uniqueTitles(lastAlternatives)
      .filter(a=>KairoUtils.normalizeText(a.title)!==KairoUtils.normalizeText(item.title))
      .slice(0,8);

    r.innerHTML=`<strong>Nombre reconocido automáticamente:</strong>
      <span class="recognized-title">${KairoUtils.esc(item.title)}</span>
      <small>Entrada: ${KairoUtils.esc(raw)} · Fuentes: ${KairoUtils.esc(sources)}</small>`;

    card.innerHTML=`<article class="info-card">
      <div class="info-kicker">${KairoUtils.esc(item.type.toUpperCase())}</div>
      <h2>${KairoUtils.esc(item.title)}</h2>
      <p class="meta-line">${KairoUtils.esc(status)}${item.year?` · ${item.year}`:''}</p>
      <div class="tag-row">${KairoUI.metadataTags(item)}</div>
      ${picker}
      <div class="synopsis">
        <strong>¿De qué trata?</strong>
        <p>${KairoUtils.esc(synopsis).replace(/\n/g,'<br>')}</p>
      </div>
      <div class="info-grid">${info.map(([label,val])=>`
        <div class="info-cell">
          <strong>${KairoUtils.esc(String(val))}</strong>
          <span>${label}</span>
        </div>`).join('')}</div>
      <div class="metadata-alternatives">
        <strong>También reconocido como</strong>
        <p>${alternatives.length?alternatives.map(x=>KairoUtils.esc(x)).join(' · '):'Sin alias adicionales.'}</p>
      </div>
      <div class="metadata-alternatives">
        <strong>Fuentes de identificación y Metadata</strong>
        <p>${KairoUtils.esc(sources)}</p>
      </div>
      <div class="metadata-actions">
        <a class="action-button square" href="inventory.html?title=${encodeURIComponent(item.title)}&type=${encodeURIComponent(item.type)}">USAR EN INVENTORY</a>
        <button type="button" class="action-button square secondary" id="reportWrongBtn">REPORTAR ERROR</button>
        <a class="action-button square secondary" href="../index.html">VOLVER A KAIRO</a>
      </div>
      <div id="reportPanel" class="report-panel square" hidden>
        <strong>Reportar coincidencia incorrecta</strong>
        <p class="report-hint">Para evitar abusos debes dar una prueba: elige otra alternativa o escribe el título correcto.</p>
        <div class="report-alts">${reportAlts.length
          ?reportAlts.map(a=>`<button type="button" class="square-button report-alt-btn" data-correct="${KairoUtils.esc(a.title)}">${KairoUtils.esc(a.title)}</button>`).join('')
          :'<p class="report-hint">No hay otras alternativas automáticas. Escribe el título correcto abajo.</p>'}</div>
        <label for="reportCorrectInput">TÍTULO CORRECTO (obligatorio)</label>
        <input id="reportCorrectInput" class="square-input" placeholder="Ej. The Fragrant Flower Blooms With Dignity">
        <label for="reportNoteInput">NOTA / PRUEBA (opcional)</label>
        <input id="reportNoteInput" class="square-input" placeholder="Ej. En España se llama La nobleza de las flores">
        <div class="metadata-actions">
          <button type="button" class="action-button square" id="reportSubmitBtn">ENVIAR REPORTE</button>
          <button type="button" class="action-button square secondary" id="reportCancelBtn">CANCELAR</button>
        </div>
        <p id="reportStatus" class="report-status"></p>
      </div>
    </article>`;

    // Bind alternative picker
    card.querySelectorAll('.alt-pick-btn').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const title=btn.getAttribute('data-title')||'';
        const type=btn.getAttribute('data-type')||t.value;
        if(!title)return;
        KairoUI.buttonLoading(b,'CARGANDO ALTERNATIVA...');
        r.textContent='Cargando la alternativa elegida…';
        try{
          // Reportar implícitamente que el actual no era el deseado
          if(window.KairoReportFeedback && item?.title && lastRaw){
            KairoReportFeedback.reportWrong(lastRaw,item.title,item.type,{correctTitle:title,note:'Elegido desde lista de alternativas'});
          }
          const result=await KairoTitleNormalizer.resolve(title,type,{allowRemote:true,enrich:true,lang:langEl?.value||'auto'});
          lastAlternatives=Array.isArray(result?.alternatives)?result.alternatives:lastAlternatives;
          const polished=await polishItem(result?.item||{title,type});
          render(polished,result?.source||'alternativa',lastRaw);
        }finally{
          KairoUI.buttonRestore(b);
        }
      });
    });

    // Report panel
    const panel=document.getElementById('reportPanel');
    const reportBtn=document.getElementById('reportWrongBtn');
    const submitBtn=document.getElementById('reportSubmitBtn');
    const cancelBtn=document.getElementById('reportCancelBtn');
    const statusEl=document.getElementById('reportStatus');
    const correctInput=document.getElementById('reportCorrectInput');

    reportBtn?.addEventListener('click',()=>{if(panel)panel.hidden=!panel.hidden;});
    cancelBtn?.addEventListener('click',()=>{if(panel)panel.hidden=true;});
    panel?.querySelectorAll('.report-alt-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(correctInput)correctInput.value=btn.getAttribute('data-correct')||btn.textContent||'';
      });
    });
    submitBtn?.addEventListener('click',async()=>{
      if(!window.KairoReportFeedback){
        if(statusEl)statusEl.textContent='Sistema de reportes no disponible.';
        return;
      }
      const correct=(correctInput?.value||'').trim();
      const note=(document.getElementById('reportNoteInput')?.value||'').trim();
      const res=KairoReportFeedback.reportWrong(lastRaw||raw,item.title,item.type,{correctTitle:correct,note});
      if(!res.ok){
        if(statusEl)statusEl.textContent=res.error||'No se pudo reportar.';
        return;
      }
      if(statusEl)statusEl.textContent='Reporte guardado. Buscando de nuevo con tu corrección…';
      q.value=lastRaw||raw;
      await search();
    });
  }

  async function search(){
    const raw=q.value.trim();
    if(!raw)return;
    const lang=langEl?.value||'auto';
    KairoUI.buttonLoading(b,'RECONOCIENDO...');
    r.textContent='Kairo está comparando el nombre con varias fuentes…';
    try{
      const result=await KairoTitleNormalizer.resolve(raw,t.value,{allowRemote:true,enrich:true,lang});
      lastResult=result;
      lastAlternatives=Array.isArray(result?.alternatives)?result.alternatives:[];
      const item=await polishItem(result?.item||null);
      render(item,result?.source||'none',raw);
    }finally{
      KairoUI.buttonRestore(b);
    }
  }

  b.addEventListener('click',search);
  q.addEventListener('keydown',e=>{if(e.key==='Enter')search();});
  const params=new URLSearchParams(location.search);
  const pre=params.get('q');
  const type=params.get('type');
  if(type==='Anime'||type==='Manga')t.value=type;
  if(params.get('lang')&&langEl)langEl.value=params.get('lang');
  if(pre){q.value=pre;search();}
})();


/* === assets/js/modules/inventory-data.js === */
window.KairoInventoryView={
  buckets:{
    watchedAnime:document.getElementById('watchedAnime'),
    watchedManga:document.getElementById('watchedManga'),
    pendingAnime:document.getElementById('pendingAnime'),
    pendingManga:document.getElementById('pendingManga')
  },
  summary:document.getElementById('inventorySummary'),
  notice:document.getElementById('inventoryNotice'),
  recognize:document.getElementById('inventoryRecognizePanel'),
  title:document.getElementById('inventoryTitle'),
  type:document.getElementById('inventoryType'),
  lang:document.getElementById('inventoryLang'),
  units:document.getElementById('inventoryVolumes'),
  status:document.getElementById('inventoryStatus'),
  add:document.getElementById('inventoryAdd'),
  clear:document.getElementById('clearInventory')
};


/* === assets/js/modules/02-inventory-filters.js === */
window.KairoInventoryFilters={matches(item,type){return item.type===type;}};


/* === assets/js/modules/inventory-render.js === */
window.KairoInventoryRender=(function(){
  function unitRows(item,watchMode){const watched=new Set(item.watched||[]);const units=(item.owned||[]).filter(n=>watchMode?watched.has(n):!watched.has(n));if(!units.length)return '<div class="inventory-empty-unit">No hay unidades en esta sección.</div>';return `<div class="unit-list">${units.map(n=>`<div class="unit-row"><span class="unit-name">${KairoUtils.esc(KairoUtils.unitText(item.type,n))}</span><label class="ticket-control" title="${watchMode?'Quitar como visto':'Marcar como visto'}"><span>✓</span><input type="checkbox" ${watchMode?'checked':''} data-action="toggle-unit" data-title="${encodeURIComponent(item.title)}" data-type="${item.type}" data-unit="${n}" aria-label="${watchMode?'Visto':'Marcar visto'} ${KairoUtils.unitText(item.type,n)}"></label><button class="unit-delete" type="button" data-action="delete-unit" data-title="${encodeURIComponent(item.title)}" data-type="${item.type}" data-unit="${n}" aria-label="Borrar ${KairoUtils.unitText(item.type,n)}">×</button></div>`).join('')}</div>`;}
  function card(item,watchMode){const id=KairoInventoryModel.key(item.title,item.type);const expanded=KairoStorage.isExpanded(id);const units=item.owned||[],watched=item.watched||[];const done=watched.length,total=units.length;return `<article class="inventory-card square ${expanded?'is-expanded':''}" data-id="${encodeURIComponent(id)}"><button class="inventory-card-head" type="button" data-action="toggle-card"><span class="card-main"><strong>${KairoUtils.esc(item.title)}</strong><small>${item.type} · ${done}/${total} ${KairoUtils.unitLabel(item.type,false).toLowerCase()} vistas · ${total} guardadas</small></span><span class="card-arrow">${expanded?'−':'+'}</span></button>${expanded?`<div class="inventory-card-body"><div class="card-tools"><span>Marca o quita el ticket para mover ${item.type==='Manga'?'tomos':'temporadas'}.</span><button class="title-delete" type="button" data-action="delete-title" data-title="${encodeURIComponent(item.title)}" data-type="${item.type}">BORRAR ${item.type.toUpperCase()}</button></div>${unitRows(item,watchMode)}</div>`:''}</article>`;}
  function renderBucket(el,type,watchMode,items){const list=items.filter(x=>x.type===type&&((x.watched||[]).length>0?watchMode:true)).filter(x=>{const done=new Set(x.watched||[]);return watchMode?x.owned.some(n=>done.has(n)):x.owned.some(n=>!done.has(n));});el.innerHTML=list.length?list.map(x=>card(x,watchMode)).join(''):'<div class="inventory-empty">No hay títulos en esta zona.</div>';}
  function render(items){const v=KairoInventoryView;renderBucket(v.buckets.watchedAnime,'Anime',true,items);renderBucket(v.buckets.watchedManga,'Manga',true,items);renderBucket(v.buckets.pendingAnime,'Anime',false,items);renderBucket(v.buckets.pendingManga,'Manga',false,items);const manga=items.filter(x=>x.type==='Manga'),anime=items.filter(x=>x.type==='Anime');const mangaUnits=manga.reduce((n,x)=>n+(x.owned||[]).length,0),animeUnits=anime.reduce((n,x)=>n+(x.owned||[]).length,0),watched=manga.reduce((n,x)=>n+(x.watched||[]).length,0)+anime.reduce((n,x)=>n+(x.watched||[]).length,0);v.summary.innerHTML=`<div class="metric"><strong>${items.length}</strong><span>Títulos guardados</span></div><div class="metric"><strong>${anime.length}</strong><span>Anime</span></div><div class="metric"><strong>${manga.length}</strong><span>Manga</span></div><div class="metric"><strong>${mangaUnits+animeUnits}</strong><span>Unidades guardadas</span></div><div class="metric"><strong>${watched}</strong><span>Unidades vistas</span></div>`;}
  return {render};
})();


/* === assets/js/modules/02-inventory.js === */
(function(){
  const v=KairoInventoryView;if(!v.add)return;

  let pending=null; // {raw,type,units,initialWatched,resolved,alternatives}

  function items(){return KairoStorage.getItems();}
  function save(list){KairoStorage.setItems(KairoInventoryModel.normalizeItems(list));}
  function notify(text,tone='normal'){KairoUI.notice(v.notice,text,tone);}

  function hidePanel(){
    if(v.recognize){v.recognize.hidden=true;v.recognize.innerHTML='';}
    pending=null;
  }

  function uniqueTitles(list){
    const seen=new Set();const out=[];
    for(const x of list||[]){
      const title=x.title||x;
      const k=KairoUtils.normalizeText(title);
      if(!k||seen.has(k))continue;
      seen.add(k);
      out.push(typeof x==='string'?{title:x}:x);
    }
    return out;
  }

  function showRecognizePanel(raw,type,units,initialWatched,resolved){
    if(!v.recognize){
      // sin panel: guardar directo
      commitSave(raw,type,units,initialWatched,resolved);
      return;
    }
    pending={raw,type,units,initialWatched,resolved,alternatives:resolved.alternatives||[]};
    const item=resolved.item;
    const alts=uniqueTitles(resolved.alternatives||[])
      .filter(a=>KairoUtils.normalizeText(a.title)!==KairoUtils.normalizeText(item.title))
      .slice(0,8);
    const sources=(resolved.sources||[]).join(', ')||'catálogo local';

    v.recognize.hidden=false;
    v.recognize.innerHTML=`
      <div class="recognize-box">
        <p class="recognize-lead"><strong>Reconocido como:</strong> ${KairoUtils.esc(item.title)}</p>
        <p class="recognize-meta">Entrada: “${KairoUtils.esc(raw)}” · Fuentes: ${KairoUtils.esc(sources)}</p>
        ${alts.length?`
          <p class="recognize-lead"><strong>¿No es este? Elige otro:</strong></p>
          <div class="recognize-alts">${alts.map(a=>`
            <button type="button" class="square-button inv-alt-btn" data-title="${KairoUtils.esc(a.title)}">${KairoUtils.esc(a.title)}</button>
          `).join('')}</div>`:''}
        <div class="recognize-actions">
          <button type="button" class="action-button square" id="invConfirmSave">CONFIRMAR Y GUARDAR</button>
          <button type="button" class="action-button square secondary" id="invReportWrong">REPORTAR ERROR</button>
          <button type="button" class="action-button square secondary" id="invCancelRecognize">CANCELAR</button>
        </div>
        <div id="invReportBox" class="report-panel square" hidden>
          <p class="report-hint">Para reportar debes indicar el título correcto (prueba obligatoria).</p>
          <label for="invReportCorrect">TÍTULO CORRECTO</label>
          <input id="invReportCorrect" class="square-input" placeholder="Ej. The Fragrant Flower Blooms With Dignity">
          <label for="invReportNote">NOTA (opcional)</label>
          <input id="invReportNote" class="square-input" placeholder="Ej. En España se llama La nobleza de las flores">
          <div class="recognize-actions">
            <button type="button" class="action-button square" id="invReportSubmit">ENVIAR REPORTE Y CORREGIR</button>
          </div>
          <p id="invReportStatus" class="report-status"></p>
        </div>
      </div>`;

    document.getElementById('invConfirmSave')?.addEventListener('click',()=>{
      if(!pending)return;
      commitSave(pending.raw,pending.type,pending.units,pending.initialWatched,pending.resolved);
      hidePanel();
    });
    document.getElementById('invCancelRecognize')?.addEventListener('click',()=>{
      hidePanel();
      notify('No se guardó nada.','normal');
    });
    document.getElementById('invReportWrong')?.addEventListener('click',()=>{
      const box=document.getElementById('invReportBox');
      if(box)box.hidden=!box.hidden;
    });
    v.recognize.querySelectorAll('.inv-alt-btn').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const title=btn.getAttribute('data-title')||'';
        if(!title||!pending)return;
        KairoUI.buttonLoading(v.add,'CARGANDO ALTERNATIVA...');
        try{
          if(window.KairoReportFeedback){
            KairoReportFeedback.reportWrong(pending.raw,pending.resolved.item.title,pending.type,{
              correctTitle:title,note:'Elegido desde alternativas en Inventory'
            });
          }
          const lang=v.lang?.value||'auto';
          const result=await KairoTitleNormalizer.resolve(title,pending.type,{allowRemote:true,lang});
          if(result?.item){
            pending.resolved=result;
            pending.alternatives=result.alternatives||[];
            showRecognizePanel(pending.raw,pending.type,pending.units,pending.initialWatched,result);
          }
        }finally{
          KairoUI.buttonRestore(v.add);
        }
      });
    });
    document.getElementById('invReportSubmit')?.addEventListener('click',async()=>{
      if(!pending||!window.KairoReportFeedback)return;
      const correct=(document.getElementById('invReportCorrect')?.value||'').trim();
      const note=(document.getElementById('invReportNote')?.value||'').trim();
      const status=document.getElementById('invReportStatus');
      const res=KairoReportFeedback.reportWrong(pending.raw,pending.resolved.item.title,pending.type,{correctTitle:correct,note});
      if(!res.ok){
        if(status)status.textContent=res.error||'No se pudo reportar.';
        return;
      }
      if(status)status.textContent='Reporte guardado. Reconociendo de nuevo…';
      const lang=v.lang?.value||'auto';
      const result=await KairoTitleNormalizer.resolve(pending.raw,pending.type,{allowRemote:true,lang});
      if(result?.item){
        pending.resolved=result;
        showRecognizePanel(pending.raw,pending.type,pending.units,pending.initialWatched,result);
      }
    });
  }

  function commitSave(raw,type,units,initialWatched,resolved){
    const before=items();
    const result=KairoInventoryModel.upsert(before,resolved.item,type,units,initialWatched);
    save(result.items);
    v.title.value='';
    v.units.value='';
    const added=result.addedUnits.length, skipped=result.skippedUnits.length;
    const recognition=KairoUtils.normalizeText(raw)===KairoUtils.normalizeText(resolved.item.title)
      ?`“${resolved.item.title}”`
      :`“${raw}” → “${resolved.item.title}”`;
    const sources=(resolved.sources||[]).join(', ')||'catálogo local';
    const checked=(resolved.sourcesChecked||[]).join(', ')||'fuentes locales';
    if(!added&&!result.addedTitle){
      notify(`${recognition}. No se agregó nada porque esas ${KairoUtils.unitLabel(type,false).toLowerCase()} ya estaban. Fuentes: ${checked}. Identificado por: ${sources}.`,'normal');
    }else{
      notify(`${recognition}. ${added} ${KairoUtils.unitLabel(type,added===1).toLowerCase()} agregada${added===1?'':'s'}${skipped?` (${skipped} ya existían)`:''}. Estado: ${initialWatched?'VISTO':'PENDIENTE'}.`,'success');
    }
    KairoCrossModule.saveLastMetadata(resolved.item);
    if(window.KairoMetadataEnricher){
      KairoMetadataEnricher.enrich(resolved.item).then(enriched=>{
        const latest=items();
        const saved=KairoInventoryModel.find(latest,resolved.item.title,type);
        if(!saved)return;
        saved.aliases=[...new Set([...(saved.aliases||[]),...(enriched.aliases||[])])];
        saved.metadata=KairoInventoryModel.stripMeta?KairoInventoryModel.stripMeta(enriched):{...saved.metadata,...enriched};
        saved.metadataSources=enriched.sources||[];
        saved.recognitionSourcesChecked=resolved.sourcesChecked||[];
        saved.updatedAt=Date.now();
        save(latest);
        KairoInventoryRender.render(latest);
        KairoCrossModule.saveLastMetadata(enriched);
      }).catch(()=>{});
    }
    KairoInventoryRender.render(items());
  }

  async function add(){
    const raw=v.title.value.trim();
    const type=v.type.value;
    let units=KairoUtils.listFromInput(v.units.value);
    const initialWatched=v.status.value==='watched';
    const lang=v.lang?.value||'auto';

    if(!raw){notify('Escribe el nombre del anime o manga antes de añadirlo.','error');v.title.focus();return;}
    if(type==='Anime'&&!units.length)units=[1];
    if(type==='Manga'&&!units.length){notify('Para un manga indica al menos un tomo, ej. 1 o 1, 2, 3.','error');v.units.focus();return;}

    KairoUI.buttonLoading(v.add,'RECONOCIENDO TÍTULO...');
    try{
      const resolved=await KairoTitleNormalizer.resolve(raw,type,{allowRemote:true,lang});
      if(!resolved?.item){
        notify(`No pude reconocer “${raw}”. No se añadió nada.`,'error');
        return;
      }
      // Siempre pedir confirmación para poder corregir
      showRecognizePanel(raw,type,units,initialWatched,resolved);
    }finally{
      KairoUI.buttonRestore(v.add);
    }
  }

  function removeTitle(title,type){
    if(!confirm(`¿Borrar ${type.toLowerCase()} “${title}” y todas sus unidades?`))return;
    const id=KairoInventoryModel.key(title,type);
    save(items().filter(x=>x.id!==id));
    KairoStorage.removeExpanded(id);
    notify(`Se eliminó “${title}” del inventario.`,'success');
    KairoInventoryRender.render(items());
  }

  function removeUnit(title,type,unit){
    const list=items(),item=KairoInventoryModel.find(list,title,type);
    if(!item)return;
    const empty=KairoInventoryModel.removeUnit(item,Number(unit));
    if(empty){
      save(list.filter(x=>x!==item));
      KairoStorage.removeExpanded(item.id);
      notify(`Se eliminó “${title}” porque ya no tiene unidades.`,'success');
    }else{
      save(list);
      notify(`${KairoUtils.unitText(type,unit)} eliminada de “${title}”.`,'success');
    }
    KairoInventoryRender.render(items());
  }

  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-action]');
    if(!el)return;
    const action=el.dataset.action;
    if(action==='toggle-card'){
      const card=el.closest('.inventory-card');
      const id=decodeURIComponent(card.dataset.id);
      KairoStorage.setExpanded(id,!KairoStorage.isExpanded(id));
      KairoInventoryRender.render(items());
      return;
    }
    if(action==='delete-title'){
      removeTitle(decodeURIComponent(el.dataset.title),el.dataset.type);
      return;
    }
    if(action==='delete-unit'){
      removeUnit(decodeURIComponent(el.dataset.title),el.dataset.type,el.dataset.unit);
      return;
    }
  });

  document.addEventListener('change',e=>{
    const el=e.target.closest('input[data-action="toggle-unit"]');
    if(!el)return;
    const title=decodeURIComponent(el.dataset.title);
    const type=el.dataset.type;
    const unit=Number(el.dataset.unit);
    const list=items();
    const item=KairoInventoryModel.find(list,title,type);
    if(!item)return;
    KairoInventoryModel.toggleUnit(item,unit,el.checked);
    save(list);
    notify(`${KairoUtils.unitText(type,unit)} de “${title}” ${el.checked?'marcado como visto':'devuelto a pendiente'}.`,'success');
    KairoInventoryRender.render(items());
  });

  v.add.addEventListener('click',add);
  v.title.addEventListener('keydown',e=>{if(e.key==='Enter')add();});
  v.units.addEventListener('keydown',e=>{if(e.key==='Enter')add();});
  v.type.addEventListener('change',()=>{
    if(v.type.value==='Anime'&&!v.units.value)v.units.placeholder='Vacío = Temporada 1 · o 1, 2, 3';
    else v.units.placeholder='1, 2, 3, 4 o 1-4';
  });
  v.clear.addEventListener('click',()=>{
    if(!KairoStorage.getItems().length)return notify('El inventario ya está vacío.');
    if(confirm('¿Borrar TODOS los mangas y animes del inventario?')){
      KairoStorage.clear();
      notify('Se borró todo el inventario.','success');
      KairoInventoryRender.render([]);
    }
  });

  const params=new URLSearchParams(location.search);
  if(params.get('title')){
    v.title.value=params.get('title');
    if(params.get('type')==='Anime'||params.get('type')==='Manga')v.type.value=params.get('type');
    notify(`Metadata abrió Inventory con “${v.title.value}”. Indica los ${KairoUtils.unitLabel(v.type.value,false).toLowerCase()} y el estado inicial.`);
  }

  KairoInventoryRender.render(items());
})();


/* === assets/js/modules/analytics-render.js === */
window.KairoAnalyticsRender=(function(){
  function genreButtons(list,selected){return list.slice(0,18).map(x=>`<button class="genre-button ${selected===x.genre?'active':''}" type="button" data-genre="${encodeURIComponent(x.genre)}"><strong>${KairoUtils.esc(x.genre)}</strong><span>${x.anime} anime · ${x.manga} manga</span><small>${KairoUtils.formatNumber(x.catalogPopularity)} popularidad agregada</small></button>`).join('')||'<div class="empty-state">No hay géneros disponibles.</div>';}
  function ranks(list){if(!list.length)return '<div class="empty-state">No hay títulos disponibles para este filtro.</div>';return list.map((o,i)=>`<button class="rank-item rank-button" type="button" data-title="${encodeURIComponent(o.item.title)}" data-type="${o.item.type}"><span class="rank-number">${i+1}</span><span class="rank-copy"><strong>${KairoUtils.esc(o.item.title)}</strong><small>${KairoUtils.esc((o.item.genres||[]).slice(0,3).join(' · '))}</small></span><span class="rank-score"><b>${o.watched}</b><small>vistas</small></span></button>`).join('');}
  function affinity(list){return list.slice(0,10).map((x,i)=>`<div class="rank-item"><span class="rank-number">${i+1}</span><span class="rank-copy"><strong>${KairoUtils.esc(x.genre)}</strong><small>${x.titles} título${x.titles===1?'':'s'} relacionados</small></span><span class="rank-score"><b>${x.units}</b><small>unidades</small></span></div>`).join('')||'<div class="empty-state">Añade elementos a Inventory para detectar afinidades.</div>';}
  return {genreButtons,ranks,affinity};
})();


/* === assets/js/modules/03-analytics-filters.js === */
window.KairoAnalyticsFilters={sameGenre(item,genre){return !genre||(item.genres||[]).includes(genre);}};


/* === assets/js/modules/03-analytics.js === */
(function(){
  const top=document.getElementById('analyticsTop'),genres=document.getElementById('genreGrid'),aff=document.getElementById('affinityList'),ar=document.getElementById('animeRanking'),mr=document.getElementById('mangaRanking'),filterBox=document.getElementById('selectedFilter'),filterTitle=document.getElementById('analyticsFilterTitle');if(!top)return;
  let selected=KairoStorage.getAnalyticsFilter();
  function render(){
    const items=KairoAnalyticsEngine.items(),allUnits=items.reduce((n,x)=>n+(x.owned||[]).length,0),seen=items.reduce((n,x)=>n+(x.watched||[]).length,0),anime=items.filter(x=>x.type==='Anime').length,manga=items.filter(x=>x.type==='Manga').length;
    top.innerHTML=`<div class="analytics-metric"><strong>${items.length}</strong><span>Títulos detectados</span></div><div class="analytics-metric"><strong>${anime}</strong><span>Anime</span></div><div class="analytics-metric"><strong>${manga}</strong><span>Manga</span></div><div class="analytics-metric"><strong>${allUnits}</strong><span>Unidades guardadas</span></div><div class="analytics-metric"><strong>${seen}</strong><span>Unidades vistas</span></div>`;
    const gs=KairoAnalyticsEngine.genreStats();genres.innerHTML=KairoAnalyticsRender.genreButtons(gs,selected);aff.innerHTML=KairoAnalyticsRender.affinity(KairoAnalyticsEngine.inventoryGenres());
    ar.innerHTML=KairoAnalyticsRender.ranks(KairoAnalyticsEngine.topByGenre('Anime',selected));mr.innerHTML=KairoAnalyticsRender.ranks(KairoAnalyticsEngine.topByGenre('Manga',selected));
    filterBox.hidden=!selected;if(selected){filterTitle.textContent=`Filtro activo: ${selected}`;}
  }
  genres.addEventListener('click',e=>{const b=e.target.closest('[data-genre]');if(!b)return;selected=decodeURIComponent(b.dataset.genre);KairoStorage.setAnalyticsFilter(selected);render();});
  filterBox.addEventListener('click',e=>{if(e.target.closest('#clearAnalyticsFilter')){selected='';KairoStorage.setAnalyticsFilter('');render();}});
  window.addEventListener('kairo:inventory-changed',render);window.addEventListener('kairo:metadata-changed',render);render();
})();


/* === assets/js/modules/recommendation-render.js === */
window.KairoRecommendationRender={
  list(list,type){if(!list.length)return '<div class="recommendation-empty">No hay suficientes títulos fuera de tu inventario para llenar esta lista.</div>';return list.map((o,i)=>`<article class="recommendation-card" style="animation-delay:${i*0.05}s"><div class="rec-number">${String(i+1).padStart(2,'0')}</div><h3>${KairoUtils.esc(o.item.title)}</h3><div class="recommendation-meta">${KairoUtils.esc(o.item.status||'')} ${o.item.year?`· ${o.item.year}`:''} · ${o.item.score?`${Number(o.item.score).toFixed(1)}/10`:''}</div><div class="recommendation-tags">${(o.item.genres||[]).map(g=>`<span>${KairoUtils.esc(g)}</span>`).join('')}</div><div class="rec-facts"><span><b>${KairoUtils.formatNumber(o.item.popularity||0)}</b>&nbsp;popularidad</span><span><b>${o.item.type==='Manga'?(o.item.volumes||'—'):(o.item.episodes||'—')}</b>&nbsp;${o.item.type==='Manga'?'tomos':'episodios'}</span></div><p><strong>¿De qué trata?</strong> ${KairoUtils.esc(o.item.synopsis||'No hay sinopsis disponible.')}</p><div class="reason">${KairoUtils.esc(KairoRecommendationEngine.reason(o))}</div></article>`).join('');},prefs(p){return p.length?p.map(([g,n])=>`${g} (${n})`).join(' · '):'todavía no hay suficientes datos'}
};


/* === assets/js/modules/04-recommendation-filters.js === */
window.KairoRecommendationFilters={outsideInventory(item,blocked){return !blocked.has(`${item.type}::${KairoUtils.normalizeText(item.title)}`);}};


/* === assets/js/modules/04-recommendations.js === */
(function(){
  const ar=document.getElementById('animeRecommendations'),mr=document.getElementById('mangaRecommendations'),ex=document.getElementById('recommendationExplain'),count=document.getElementById('recommendationCount');if(!ar)return;
  function render(){const prefs=Object.entries(KairoRecommendationEngine.preferences()).sort((a,b)=>b[1]-a[1]);const items=KairoStorage.getItems();const a=KairoRecommendationEngine.recommend('Anime'),m=KairoRecommendationEngine.recommend('Manga');ar.innerHTML=KairoRecommendationRender.list(a,'Anime');mr.innerHTML=KairoRecommendationRender.list(m,'Manga');ex.innerHTML=`<strong>Cómo se conectan los módulos:</strong> Inventory aporta todo lo que ya tienes (visto o pendiente) y por eso ningún título de tu inventario vuelve a aparecer. Analytics aporta tus géneros con más afinidad. Metadata aporta sinopsis, géneros, estado, extensión y otros datos del catálogo. ${prefs.length?`Afinidades actuales: ${KairoRecommendationRender.prefs(prefs.slice(0,5))}.`:'Todavía no hay afinidades suficientes; Kairo usa popularidad, valoración y variedad.'} <span class="rec-count">Inventario analizado: ${items.length} títulos.</span>`;if(count)count.textContent=`${Math.min(10,a.length)} animes · ${Math.min(10,m.length)} mangas`;
  }
  window.addEventListener('kairo:inventory-changed',render);window.addEventListener('kairo:metadata-changed',render);render();
})();
