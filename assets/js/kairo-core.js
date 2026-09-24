
/* === assets/js/01-config.js === */
window.KairoConfig = Object.freeze({
  appName: "Kairo",
  loaderDuration: 1200,
  scrollBehavior: "smooth",
  defaultStatus: "ONLINE"
});


/* === assets/js/core/03-utils.js === */
window.KairoUtils={
  esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
  normalizeText(s){return String(s??'').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`´]/g,'').replace(/[‐‑‒–—―]/g,'-').replace(/[-_./:;,!?()[\]{}]+/g,' ').replace(/[^\p{L}\p{N}\s-]+/gu,' ').replace(/\s+/g,' ').trim();},
  compactText(s){return this.normalizeText(s).replace(/[\s-]+/g,'');},
  tokens(s){return this.normalizeText(s).split(/\s+/).filter(Boolean);},
  slug(s){return this.normalizeText(s).replace(/\s+/g,'-');},
  listFromInput(value){const text=String(value||'').replace(/[–—]/g,'-');const out=[];for(const part of text.split(/[,;\s]+/).filter(Boolean)){if(/^\d+\-\d+$/.test(part)){let[a,b]=part.split('-').map(Number);if(a>b)[a,b]=[b,a];for(let n=a;n<=b&&n<=1000;n++)out.push(n);}else{const n=Number.parseInt(part,10);if(Number.isFinite(n)&&n>0)out.push(n);}}return [...new Set(out)].sort((a,b)=>a-b);},
  unique(a){return [...new Set(a)];},
  levenshtein(a,b){a=this.compactText(a);b=this.compactText(b);if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}return prev[b.length];},
  jaroWinkler(a,b){const s1=this.compactText(a),s2=this.compactText(b);if(s1===s2)return 1;if(!s1||!s2)return 0;const d=Math.floor(Math.max(s1.length,s2.length)/2)-1;const m1=new Array(s1.length).fill(false),m2=new Array(s2.length).fill(false);let m=0;for(let i=0;i<s1.length;i++){for(let j=Math.max(0,i-d);j<Math.min(i+d+1,s2.length);j++){if(!m2[j]&&s1[i]===s2[j]){m1[i]=true;m2[j]=true;m++;break;}}}if(!m)return 0;let t=0,k=0;for(let i=0;i<s1.length;i++)if(m1[i]){while(!m2[k])k++;if(s1[i]!==s2[k])t++;k++;}const j=(m/s1.length+m/s2.length+(m-t/2)/m)/3;let p=0;while(p<Math.min(4,s1.length,s2.length)&&s1[p]===s2[p])p++;return j+p*.1*(1-j);},
  tokenSimilarity(a,b){const A=[...new Set(this.tokens(a))],B=[...new Set(this.tokens(b))];if(!A.length||!B.length)return 0;const hit=A.filter(x=>B.includes(x)).length;const overlap=hit/Math.max(A.length,B.length);const partial=A.map(x=>Math.max(...B.map(y=>this.jaroWinkler(x,y)),0)).reduce((s,x)=>s+x,0)/A.length;return overlap*.65+partial*.35;},
  similarity(a,b){const x=this.normalizeText(a),y=this.normalizeText(b);if(x===y)return 1;if(!x||!y)return 0;const char=1-(this.levenshtein(x,y)/Math.max(this.compactText(x).length,this.compactText(y).length,1));const jw=this.jaroWinkler(x,y);const tok=this.tokenSimilarity(x,y);const compact=this.compactText(x)===this.compactText(y)?1:0;return Math.max(compact,char*.42+jw*.33+tok*.25);},
  titleCaseFallback(s){return String(s||'').trim().replace(/\s+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());},
  formatNumber(n){return Number(n||0).toLocaleString('es-CL');},
  unitLabel(type,singular=false){return type==='Manga'?(singular?'Tomo':'Tomos'):(singular?'Temporada':'Temporadas');},
  unitText(type,n){return `${type==='Manga'?'Tomo':'Temporada'} ${n}`;},
  safeJSON(value,fallback){try{return JSON.parse(value);}catch{return fallback;}},
  /** Elige el nombre más “famoso” (prioriza inglés/español legible sobre romaji/japonés). */

  stripHtml(s){
    return String(s??'')
      .replace(/<\s*br\s*\/?>/gi,'\n')
      .replace(/<\/\s*p\s*>/gi,'\n')
      .replace(/<[^>]+>/g,'')
      .replace(/&nbsp;/g,' ')
      .replace(/&amp;/g,'&')
      .replace(/&lt;/g,'<')
      .replace(/&gt;/g,'>')
      .replace(/&quot;/g,'"')
      .replace(/&#39;/g,"'")
      .replace(/\n{3,}/g,'\n\n')
      .replace(/[ \t]+\n/g,'\n')
      .trim();
  },
  cleanSynopsis(s){
    let t=this.stripHtml(s);
    // Quitar notas de fuente / note típicas de MAL y AniList
    t=t.replace(/\(?\s*Source:\s*[\s\S]*$/i,'').trim();
    t=t.replace(/\(?\s*Note:\s*[\s\S]*$/i,'').trim();
    t=t.replace(/\[Written by MAL Rewrite\]/gi,'').trim();
    return t;
  },
  translateStatus(s){
    const v=String(s||'').toUpperCase().replace(/_/g,' ');
    if(!v)return '';
    if(/FINISHED|COMPLETED/.test(v))return 'Finalizado';
    if(/RELEASING|CURRENTLY AIRING|CURRENT|AIRING/.test(v))return 'En emisión';
    if(/PUBLISHING|CURRENTLY PUBLISHING/.test(v))return 'En publicación';
    if(/NOT YET|UPCOMING|TBA|HIATUS/.test(v))return /HIATUS/.test(v)?'En pausa':'Próximamente';
    if(/CANCELLED|CANCELED/.test(v))return 'Cancelado';
    // ya en español
    if(/FINALIZADO|EMISI|PUBLICACI|PRÓXIM|PAUSA|CANCEL/.test(v))return String(s);
    return String(s||'');
  },
  formatPopularity(n){
    const v=Number(n);
    if(!Number.isFinite(v)||v<=0)return '—';
    // Si viene como ranking/conteo grande de AniList, mostrar número legible
    if(v>100)return this.formatNumber(Math.round(v));
    // Si ya es escala 1-100
    return `${Math.round(v)}/100`;
  },
  preferFamousTitle(candidates, fallback=''){
    const list=[...new Set((candidates||[]).filter(Boolean).map(s=>String(s).trim()).filter(Boolean))];
    if(!list.length)return fallback||'';
    const score=(t)=>{
      const s=String(t);
      let pts=0;
      const len=s.length;
      // 1) Script: Latin/Western vs CJK
      const nonLatin=(s.match(/[^\u0000-\u024F\u1E00-\u1EFF\s\-'’:.,!&0-9]/g)||[]).length;
      const latinRatio=1-(nonLatin/Math.max(len,1));
      pts+=latinRatio*40;
      if(nonLatin>len*0.3)pts-=50;
      // 2) Penalize typical Japanese particles (romaji)
      const particles=(s.match(/\b(no|wa|wo|o|ni|ga|de|to|ka|mo|e|yo|ne|na|da|desu|masu|san|chan|kun|sama|shi|tsu|chi|ryu|kyu)\b/gi)||[]).length;
      pts-=particles*12;
      // 3) Boost English function words / articles (famous English titles)
      const eng=(s.match(/\b(the|of|a|an|and|to|in|for|with|on|at|by|from|my|your|this|that|is|are|was|were|have|has|will|can|up|down|into|over|under|beyond|journey|end|man|note|piece|hero|academia|slayer|titan|family|leveling|darling|dress|cosplay|attack|demon|hunter|punch|note|gate|geass|name|voice|lie|april)\b/gi)||[]).length;
      pts+=eng*14;
      // 4) Mild boost for Spanish (still accepted, but English preferred when both exist)
      const spa=(s.match(/\b(el|la|los|las|de|del|un|una|ataque|titanes|cazador|demonios|academia|héroes|heroes|familia|nivel|vestir|muñeca)\b/gi)||[]).length;
      pts+=spa*3;
      // Prefer pure English-looking titles over Spanish when both are candidates
      if(eng>=1&&spa===0&&particles===0)pts+=12;
      // 5) Prefer proper-looking Western titles
      if(/\s/.test(s))pts+=6;
      if(/[A-ZÁÉÍÓÚÑÜ]/.test(s))pts+=5;
      if(len>=6&&len<=60)pts+=8;
      if(len<3)pts-=20;
      // 6) Slight preference against pure lowercase romaji blobs
      if(s===s.toLowerCase()&&particles>=1)pts-=8;
      return pts;
    };
    return list.slice().sort((a,b)=>score(b)-score(a)||b.length-a.length)[0]||fallback||list[0];
  },

};


/* === assets/js/core/01-storage.js === */
window.KairoStorage=(function(){
  const KEY='kairo.unified.inventory.v4';
  const OLD='kairo.unified.inventory.v3';
  const FILTER='kairo.analytics.filter.v2';
  const META='kairo.metadata.cache.v2';
  const EXPAND='kairo.inventory.expanded.v1';
  function migrateItem(x){
    if(!x||!x.title||!x.type)return null;
    const type=x.type==='Anime'?'Anime':'Manga';
    const units=Array.isArray(x.owned)?x.owned.map(v=>v==='ONE'?1:Number(v)).filter(v=>Number.isFinite(v)&&v>0):[];
    const watched=Array.isArray(x.watched)?x.watched.map(v=>v==='ONE'?1:Number(v)).filter(v=>Number.isFinite(v)&&v>0&&units.includes(v)):[];
    const title=String(x.title).trim();
    return {id:x.id||`${type}::${KairoUtils?.slug?.(title)||title.toLowerCase()}`,title,type,owned:[...new Set(units)].sort((a,b)=>a-b),watched:[...new Set(watched)].sort((a,b)=>a-b),aliases:Array.isArray(x.aliases)?x.aliases:[],metadata:x.metadata&&typeof x.metadata==='object'?x.metadata:{},metadataSources:Array.isArray(x.metadataSources)?x.metadataSources:[],recognition:x.recognition&&typeof x.recognition==='object'?x.recognition:{},updatedAt:x.updatedAt||Date.now()};
  }
  function read(){
    try{
      const current=JSON.parse(localStorage.getItem(KEY)||'null');
      if(current&&Array.isArray(current.items))return {items:current.items.map(migrateItem).filter(Boolean)};
      const old=JSON.parse(localStorage.getItem(OLD)||'null');
      if(old&&Array.isArray(old.items)){const migrated={items:old.items.map(migrateItem).filter(Boolean)};localStorage.setItem(KEY,JSON.stringify(migrated));return migrated;}
    }catch{}
    return {items:[]};
  }
  function write(state){localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new CustomEvent('kairo:inventory-changed',{detail:state}));}
  function getItems(){return read().items;}
  function setItems(items){write({items});}
  function clear(){setItems([]);}
  function cacheMeta(item){const cache=getMetaCache();cache[item.cacheKey||`${item.type}::${item.title}`]=item;localStorage.setItem(META,JSON.stringify(cache));window.dispatchEvent(new CustomEvent('kairo:metadata-changed',{detail:item}));}
  function getMetaCache(){try{const c=JSON.parse(localStorage.getItem(META)||'{}');return c&&typeof c==='object'?c:{};}catch{return {};}}
  function getMetadata(){return getMetaCache();}
  function setAnalyticsFilter(v){localStorage.setItem(FILTER,v||'');}
  function getAnalyticsFilter(){return localStorage.getItem(FILTER)||'';}
  function setExpanded(id,open){const c=JSON.parse(localStorage.getItem(EXPAND)||'{}');c[id]=!!open;localStorage.setItem(EXPAND,JSON.stringify(c));}
  function isExpanded(id){try{return !!JSON.parse(localStorage.getItem(EXPAND)||'{}')[id];}catch{return false;}}
  function removeExpanded(id){try{const c=JSON.parse(localStorage.getItem(EXPAND)||'{}');delete c[id];localStorage.setItem(EXPAND,JSON.stringify(c));}catch{}}
  return {read,getItems,setItems,clear,cacheMeta,getMetadata,setAnalyticsFilter,getAnalyticsFilter,setExpanded,isExpanded,removeExpanded};
})();


/* === assets/js/core/02-catalog.js === */
window.KairoCatalogAPI=(function(){
  const staticData=Array.isArray(window.KairoCatalog)?window.KairoCatalog.slice():[];
  function norm(s){return KairoUtils.normalizeText(s);}
  function cached(){return Object.values(KairoStorage?.getMetadata?.()||{}).filter(Boolean);}
  function all(){
    const map=new Map();
    [...staticData,...cached()].forEach(x=>{if(x&&x.title&&x.type)map.set(`${x.type}::${norm(x.title)}`,x);});
    return [...map.values()];
  }
  function find(title,type){
    const q=norm(title);if(!q)return null;
    return all().find(x=>x.type===type&&norm(x.title)===q)||all().find(x=>x.type===type&&(x.aliases||[]).some(a=>norm(a)===q))||all().find(x=>(!type||x.type===type)&&norm(x.title).includes(q))||null;
  }
  function search(query,type){
    const q=norm(query);if(!q)return [];
    return all().filter(x=>(!type||x.type===type)&&(norm(x.title).includes(q)||x.genres.some(g=>norm(g).includes(q))||(x.aliases||[]).some(a=>norm(a).includes(q))));
  }
  function genres(type){const counts={};all().filter(x=>!type||x.type===type).forEach(x=>(x.genres||[]).forEach(g=>counts[g]=(counts[g]||0)+Number(x.popularity||0)));return counts;}
  return {all,find,search,genres};
})();


/* === assets/js/core/04-events.js === */
window.KairoEvents={emit(name,detail){window.dispatchEvent(new CustomEvent(name,{detail}));},on(name,fn){window.addEventListener(name,fn);return()=>window.removeEventListener(name,fn);}};


/* === assets/js/core/05-title-normalizer.js === */
window.KairoTitleNormalizer=(function(){
  function local(raw,type){
    const list=window.KairoSourceResolver?KairoSourceResolver.localCandidates(raw,type):[];
    if(!list.length)return null;
    return list.sort((a,b)=>(b.localScore||0)-(a.localScore||0))[0];
  }
  async function resolve(raw,type,{allowRemote=true,enrich=false,lang='auto'}={}){
    const result=window.KairoSourceResolver
      ?await KairoSourceResolver.resolve(raw,type,{allowRemote,lang})
      :null;
    if(!result?.item)return {item:null,confidence:0,source:'none',sources:[],alternatives:[]};
    let item=result.item;
    if(enrich&&window.KairoMetadataEnricher)item=await KairoMetadataEnricher.enrich(item);
    return {
      item,
      confidence:result.confidence||0,
      source:result.sources?.join(' + ')||item.source||'unknown',
      sources:result.sources||[],
      sourcesChecked:result.sourcesChecked||[],
      alternatives:result.alternatives||[]
    };
  }
  return {resolve,local};
})();


/* === assets/js/core/06-inventory-model.js === */
window.KairoInventoryModel=(function(){
  function key(title,type){return `${type}::${KairoUtils.slug(title)}`;}
  function normalizeItems(items){return items.map(item=>({...item,owned:KairoUtils.unique((item.owned||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b)),watched:KairoUtils.unique((item.watched||[]).map(Number).filter(n=>Number.isFinite(n)&&(item.owned||[]).includes(n))).sort((a,b)=>a-b)}));}
  function find(items,title,type){const k=key(title,type);return items.find(x=>x.id===k)||items.find(x=>x.type===type&&KairoUtils.normalizeText(x.title)===KairoUtils.normalizeText(title))||null;}
  function upsert(items,resolved,type,units,initialWatched){
    const item=find(items,resolved.title,type);
    if(!item){
      const owned=[...new Set(units)].sort((a,b)=>a-b);return {items:[...items,{id:key(resolved.title,type),title:resolved.title,type,owned,watched:initialWatched?owned.slice():[],aliases:resolved.aliases||[],metadata:stripMeta(resolved),metadataSources:resolved.sources||[],recognition:{sources:resolved.sources||[],confidence:resolved.recognitionConfidence||0,matchedAlias:resolved.matchedAlias||resolved.title},updatedAt:Date.now()}],addedTitle:true,addedUnits:owned,skippedUnits:[]};
    }
    const current=new Set(item.owned||[]),added=[],skipped=[];
    for(const n of units){if(current.has(n))skipped.push(n);else{current.add(n);added.push(n);if(initialWatched)(item.watched=item.watched||[]).push(n);}}
    item.owned=[...current].sort((a,b)=>a-b);item.watched=[...new Set(item.watched||[])].filter(n=>item.owned.includes(n)).sort((a,b)=>a-b);item.title=resolved.title;item.aliases=[...new Set([...(item.aliases||[]),...(resolved.aliases||[])])];item.metadata=stripMeta(resolved);item.metadataSources=resolved.sources||item.metadataSources||[];item.recognition={sources:resolved.sources||item.recognition?.sources||[],confidence:resolved.recognitionConfidence||item.recognition?.confidence||0,matchedAlias:resolved.matchedAlias||item.recognition?.matchedAlias||resolved.title};item.updatedAt=Date.now();
    return {items,addedTitle:false,addedUnits:added,skippedUnits:skipped};
  }
  function stripMeta(x){return {genres:x.genres||[],synopsis:x.synopsis||'',status:x.status||'',year:x.year||null,score:x.score||0,popularity:x.popularity||0,episodes:x.episodes||null,seasons:x.seasons||null,volumes:x.volumes||null,chapters:x.chapters||null,studio:x.studio||'',author:x.author||'',source:x.source||'',sources:x.sources||[]};}
  function toggleUnit(item,unit,watched){const s=new Set(item.watched||[]);watched?s.add(unit):s.delete(unit);item.watched=[...s].sort((a,b)=>a-b);item.updatedAt=Date.now();}
  function removeUnit(item,unit){item.owned=(item.owned||[]).filter(n=>n!==unit);item.watched=(item.watched||[]).filter(n=>n!==unit);item.updatedAt=Date.now();return item.owned.length===0;}
  return {key,normalizeItems,find,upsert,toggleUnit,removeUnit,stripMeta};
})();


/* === assets/js/core/07-analytics-engine.js === */
window.KairoAnalyticsEngine=(function(){
  function items(){return KairoStorage.getItems();}
  function metadata(item){return KairoCatalogAPI.find(item.title,item.type)||item.metadata||{};}
  function watchedUnits(item){return (item.watched||[]).length;}
  function titleInInventory(title,type){return items().some(i=>i.type===type&&KairoUtils.normalizeText(i.title)===KairoUtils.normalizeText(title));}
  function genreStats(){const out={};for(const x of KairoCatalogAPI.all()){for(const g of x.genres||[]){if(!out[g])out[g]={genre:g,anime:0,manga:0,catalogPopularity:0,titles:0};out[g].titles++;out[g].catalogPopularity+=Number(x.popularity||0);if(x.type==='Anime')out[g].anime++;else out[g].manga++;}}return Object.values(out).map(x=>({...x,score:x.catalogPopularity+(x.anime+x.manga)*4})).sort((a,b)=>b.score-a.score);}
  function inventoryGenres(){const out={};for(const item of items()){for(const g of metadata(item).genres||[]){if(!out[g])out[g]={genre:g,units:0,titles:0};out[g].units+=Math.max(1,watchedUnits(item));out[g].titles++;}}return Object.values(out).sort((a,b)=>b.units-a.units||b.titles-a.titles);}
  function topByGenre(type,genre){const pool=KairoCatalogAPI.all().filter(x=>x.type===type&&(!genre||(x.genres||[]).includes(genre)));return pool.map(x=>{const inv=items().find(i=>i.type===type&&KairoUtils.normalizeText(i.title)===KairoUtils.normalizeText(x.title));const watched=inv?watchedUnits(inv):0;return {item:x,watched,popularity:Number(x.popularity||0),score:watched*30+Number(x.popularity||0)};}).sort((a,b)=>b.score-a.score).slice(0,12);}
  return {items,metadata,watchedUnits,titleInInventory,genreStats,inventoryGenres,topByGenre};
})();


/* === assets/js/core/08-recommendation-engine.js === */
window.KairoRecommendationEngine=(function(){
  function getItems(){return KairoStorage.getItems();}
  function preferences(){const out={};for(const item of getItems()){const meta=KairoAnalyticsEngine.metadata(item);for(const g of meta.genres||[])out[g]=(out[g]||0)+Math.max(1,(item.watched||[]).length);}return out;}
  function excluded(){return new Set(getItems().map(i=>`${i.type}::${KairoUtils.normalizeText(i.title)}`));}
  function recommend(type){const prefs=preferences(),blocked=excluded();const list=KairoCatalogAPI.all().filter(x=>x.type===type&&!blocked.has(`${type}::${KairoUtils.normalizeText(x.title)}`));return list.map(item=>{const affinity=(item.genres||[]).reduce((n,g)=>n+(prefs[g]||0),0);const popularity=Number(item.popularity||0),quality=Number(item.score||0)*2;const diversity=(item.genres||[]).length*1.5;const value=popularity+quality+affinity*12+diversity;return {item,affinity,value};}).sort((a,b)=>b.value-a.value).slice(0,10);}
  function reason(r){if(r.affinity>0)return `Comparte ${r.affinity} coincidencia${r.affinity===1?'':'s'} de género con tu inventario y además tiene una popularidad alta en el catálogo.`;return 'Todavía no hay afinidad suficiente en tu inventario; aparece por su combinación de popularidad, valoración y variedad de géneros.';}
  return {recommend,preferences,excluded,reason};
})();


/* === assets/js/core/09-ui.js === */
window.KairoUI={
  notice(el,text,tone='normal'){if(!el)return;el.textContent=text;el.dataset.tone=tone;},
  buttonLoading(btn,label='CARGANDO...'){if(!btn)return;btn.disabled=true;btn.dataset.original=btn.textContent;btn.textContent=label;},
  buttonRestore(btn){if(!btn)return;btn.disabled=false;if(btn.dataset.original)btn.textContent=btn.dataset.original;},
  metadataTags(item){return (item.genres||[]).map(g=>`<span class="tag">${KairoUtils.esc(g)}</span>`).join('')},
  unitInputLabel(type){return type==='Manga'?'TOMOS / TEMPORADAS':'TEMPORADAS / UNIDADES';}
};


/* === assets/js/core/10-cross-module.js === */
(function(){
  window.KairoCrossModule={
    saveLastMetadata(item){try{localStorage.setItem('kairo.last.metadata',JSON.stringify(item));}catch{}},
    getLastMetadata(){try{return JSON.parse(localStorage.getItem('kairo.last.metadata')||'null');}catch{return null;}},
    buildInventoryLink(item){return `inventory.html?title=${encodeURIComponent(item.title)}&type=${encodeURIComponent(item.type)}`;}
  };
})();
