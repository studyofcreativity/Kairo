
/* === assets/js/services/00-remote-utils.js === */
window.KairoRemote=(function(){
  const DEFAULT_TIMEOUT=8000;
  async function json(url,options={},timeout=DEFAULT_TIMEOUT){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const headers={
        Accept:'application/json',
        ...(options.headers||{})
      };
      const response=await fetch(url,{
        ...options,
        signal:controller.signal,
        headers,
        cache:'no-store'
      });
      if(!response.ok)return {ok:false,status:response.status,data:null};
      const data=await response.json();
      return {ok:true,status:response.status,data};
    }catch(error){
      return {ok:false,status:0,data:null,error};
    }finally{
      clearTimeout(timer);
    }
  }
  return {json};
})();


/* === assets/js/services/01-jikan-client.js === */
window.KairoJikanClient=(function(){
  const BASE='https://api.jikan.moe/v4/';
  const TIMEOUT=5000;
  let queue=Promise.resolve();
  let lastAt=0;
  // Si Jikan falla (504/429), no insistir durante unos minutos
  let cooldownUntil=0;
  let failStreak=0;

  function throttle(){
    queue=queue.then(async()=>{
      const wait=Math.max(0,500-(Date.now()-lastAt));
      if(wait)await new Promise(r=>setTimeout(r,wait));
      lastAt=Date.now();
    });
    return queue;
  }
  function translateStatus(value){
    const s=String(value||'');
    if(/finished/i.test(s))return 'Finalizado';
    if(/currently airing/i.test(s))return 'En emisión';
    if(/currently publishing/i.test(s))return 'En publicación';
    if(/not yet aired|not yet published/i.test(s))return 'Próximamente';
    return s||'';
  }
  function map(item,type,raw){
    const aliases=[item.title_english,item.title,item.title_japanese,...(item.title_synonyms||[])].filter(Boolean);
    const aired=item.aired?.from||item.published?.from||'';
    const year=Number(String(aired).slice(0,4))||null;
    const preferred=window.KairoUtils
      ?KairoUtils.preferFamousTitle([item.title_english,item.title,item.title_japanese],raw)
      :(item.title_english||item.title||item.title_japanese||raw);
    const popularity=Number(item.popularity||0);
    const popularity100=popularity?Math.max(1,Math.min(100,100-Math.round(Math.min(99,popularity)/1.5))):Math.max(1,Math.round(Number(item.score||0)*10));
    return {
      source:'Jikan / MyAnimeList',
      sourceId:item.mal_id,
      title:preferred,
      type,
      aliases:[...new Set(aliases)],
      genres:(item.genres||[]).map(x=>x.name).filter(Boolean),
      synopsis:(window.KairoUtils?KairoUtils.cleanSynopsis(item.synopsis||''):(item.synopsis||'')),
      status:(window.KairoUtils?KairoUtils.translateStatus(item.status):translateStatus(item.status)),
      year,
      score:Number(item.score||0),
      popularity:popularity100,
      rank:item.rank||null,
      members:item.members||0,
      favorites:item.favorites||0,
      episodes:type==='Anime'?(item.episodes||null):null,
      seasons:type==='Anime'?(item.seasons||null):null,
      volumes:type==='Manga'?(item.volumes||null):null,
      chapters:type==='Manga'?(item.chapters||null):null,
      studio:type==='Anime'?(item.studios||[]).map(x=>x.name).join(' / '):'',
      author:type==='Manga'?(item.authors||[]).map(x=>x.name).join(' / '):'',
      searchedAs:raw
    };
  }
  async function search(raw,type){
    if(!raw||!String(raw).trim())return [];
    if(Date.now()<cooldownUntil)return []; // en cooldown tras fallos
    await throttle();
    const endpoint=type==='Anime'?'anime':'manga';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT);
    try{
      const response=await fetch(`${BASE}${endpoint}?q=${encodeURIComponent(String(raw).trim())}&limit=6&sfw=true`,{
        headers:{Accept:'application/json'},
        signal:controller.signal,
        cache:'no-store'
      });
      if(!response.ok){
        // 429 / 504 / 5xx → pausar Jikan un rato
        if(response.status===429||response.status>=500){
          failStreak++;
          cooldownUntil=Date.now()+Math.min(10*60*1000, 60*1000*failStreak);
        }
        return [];
      }
      failStreak=0;
      const json=await response.json();
      return (json?.data||[]).map(x=>map(x,type,raw)).filter(Boolean);
    }catch{
      failStreak++;
      cooldownUntil=Date.now()+Math.min(10*60*1000, 45*1000*failStreak);
      return [];
    }finally{
      clearTimeout(timer);
    }
  }
  return {search};
})();


/* === assets/js/services/03-anilist-client.js === */
window.KairoAniListClient=(function(){
  const URL='https://graphql.anilist.co';
  // AniList usa "description" (no synopsis) y no tiene "authors" en Media.
  const QUERY=`query($search:String!,$type:MediaType!){
    Page(page:1,perPage:8){
      media(search:$search,type:$type,isAdult:false){
        id
        type
        title{romaji english native userPreferred}
        synonyms
        genres
        description(asHtml:false)
        status
        startDate{year}
        averageScore
        popularity
        episodes
        chapters
        volumes
        studios{nodes{name}}
      }
    }
  }`;
  function typeOf(type){return type==='Anime'?'ANIME':'MANGA';}
  function map(item,raw){
    if(!item)return null;
    const title=item.title||{};
    const aliases=[title.english,title.romaji,title.native,title.userPreferred,...(item.synonyms||[])].filter(Boolean);
    const mediaType=item.type==='ANIME'?'Anime':'Manga';
    const year=item.startDate?.year||null;
    const preferred=window.KairoUtils
      ?KairoUtils.preferFamousTitle([title.english,title.romaji,title.native,title.userPreferred],raw)
      :(title.english||title.romaji||title.native||title.userPreferred||raw);
    return {
      source:'AniList',
      sourceId:item.id,
      title:preferred,
      type:mediaType,
      aliases:[...new Set(aliases)],
      genres:Array.isArray(item.genres)?item.genres:[],
      synopsis:(window.KairoUtils?KairoUtils.cleanSynopsis(item.description||''):(item.description||'')),
      status:(window.KairoUtils?KairoUtils.translateStatus(item.status):item.status)||'',
      year,
      score:item.averageScore?Number(item.averageScore)/10:0,
      popularity:Number(item.popularity||0),
      episodes:mediaType==='Anime'?(item.episodes||null):null,
      volumes:mediaType==='Manga'?(item.volumes||null):null,
      chapters:mediaType==='Manga'?(item.chapters||null):null,
      studio:(item.studios?.nodes||[]).map(x=>x.name).join(' / '),
      author:'',
      searchedAs:raw
    };
  }
  async function search(raw,type){
    if(!raw||!String(raw).trim())return [];
    const body=JSON.stringify({
      query:QUERY.replace(/\s+/g,' ').trim(),
      variables:{search:String(raw).trim(),type:typeOf(type)}
    });
    const result=await KairoRemote.json(URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body
    },8000);
    if(!result.ok)return [];
    return (result.data?.data?.Page?.media||[]).map(x=>map(x,raw)).filter(Boolean);
  }
  return {search};
})();


/* === assets/js/services/04-kitsu-client.js === */
window.KairoKitsuClient=(function(){
  const BASE='https://kitsu.io/api/edge/';
  function endpoint(type){return type==='Anime'?'anime':'manga';}
  function map(row,type,raw){
    const a=row?.attributes||{}; if(!a)return null;
    const titles=a.titles||{};
    const aliases=[a.canonicalTitle,titles.en,titles.en_jp,titles.ja_jp,a.slug,...Object.values(titles)].filter(Boolean);
    const year=Number(String(a.startDate||'').slice(0,4))||null;
    const score=Number(a.averageRating||0);
    const preferred=window.KairoUtils
      ?KairoUtils.preferFamousTitle([titles.en,a.canonicalTitle,titles.en_jp,titles.ja_jp],raw)
      :(a.canonicalTitle||titles.en||titles.en_jp||titles.ja_jp||a.slug||raw);
    return {
      source:'Kitsu',
      sourceId:row.id,
      title:preferred,
      type,
      aliases:[...new Set(aliases)],
      genres:[],
      synopsis:(window.KairoUtils?KairoUtils.cleanSynopsis(a.synopsis||''):(a.synopsis||'')),
      status:(window.KairoUtils?KairoUtils.translateStatus(a.status):a.status)||'',
      year,
      score:score>10?score/10:score,
      popularity:a.popularityRank?Math.max(1,101-Math.min(100,Number(a.popularityRank)/20)):0,
      episodes:type==='Anime'?(a.episodeCount||null):null,
      volumes:type==='Manga'?(a.volumeCount||null):null,
      chapters:type==='Manga'?(a.chapterCount||null):null,
      studio:'',
      author:'',
      searchedAs:raw
    };
  }
  async function search(raw,type){
    if(!raw||!String(raw).trim())return [];
    const params=new URLSearchParams();
    params.set('filter[text]',String(raw).trim());
    params.set('page[limit]','8');
    // Kitsu exige Accept: application/vnd.api+json (sin esto responde 406)
    const result=await KairoRemote.json(`${BASE}${endpoint(type)}?${params.toString()}`,{
      headers:{
        'Accept':'application/vnd.api+json',
        'Content-Type':'application/vnd.api+json'
      }
    },7000);
    if(!result.ok)return [];
    return (result.data?.data||[]).map(x=>map(x,type,raw)).filter(Boolean);
  }
  return {search};
})();


/* === assets/js/services/05-mangadex-client.js === */
window.KairoMangaDexClient=(function(){
  const BASE='https://api.mangadex.org/manga';
  function map(row,raw){
    const a=row?.attributes||{};const titleObj=a.title||{};
    const main=(window.KairoUtils?KairoUtils.preferFamousTitle([titleObj.en,titleObj['en-us'],...Object.values(titleObj||{})],raw):(titleObj.en||titleObj['en-us']||Object.values(titleObj)[0]||raw));
    const aliases=[main,...Object.values(titleObj),...(a.altTitles||[]).flatMap(x=>Object.values(x||{}))].filter(Boolean);
    return {source:'MangaDex',sourceId:row.id,title:main,type:'Manga',aliases:[...new Set(aliases)],genres:[],synopsis:a.description?.en||'',status:a.status||'',
      year:a.year||null,score:0,popularity:0,episodes:null,seasons:null,volumes:a.lastVolume?Number(a.lastVolume)||null:null,chapters:a.lastChapter?Number(a.lastChapter)||null:null,
      studio:'',author:'',searchedAs:raw};
  }
  async function search(raw,type){
    if(type!=='Manga')return [];
    const params=new URLSearchParams();params.set('title',String(raw||''));params.set('limit','8');
    params.set('contentRating[]','safe');params.set('contentRating[]','suggestive');
    const result=await KairoRemote.json(`${BASE}?${params.toString()}`);
    if(!result.ok)return [];
    return (result.data?.data||[]).map(x=>map(x,raw)).filter(Boolean);
  }
  return {search};
})();


/* === assets/js/services/02-title-cache.js === */
window.KairoTitleCache={get(type,title){const key=`${type}::${KairoUtils.normalizeText(title)}`;return KairoStorage.getMetadata()[key]||null},put(item){KairoStorage.cacheMeta(item);return item}};


/* === assets/js/services/09-deep-research.js === */
window.KairoDeepResearch=(function(){
  const CACHE='kairo.deep.aliases.v3';
  const SOURCES=['Catálogo local','AniList','Kitsu','Jikan / MyAnimeList'];

  function load(){try{return JSON.parse(localStorage.getItem(CACHE)||'{}')}catch{return {}}}
  function save(x){try{localStorage.setItem(CACHE,JSON.stringify(x))}catch{}}

  function remember(items){
    const db=load();
    for(const x of items){
      if(!x?.title||!x?.type)continue;
      const key=`${x.type}::${KairoUtils.normalizeText(x.title)}`;
      const e=db[key]||{type:x.type,canonical:x.title,aliases:[]};
      e.aliases=[...new Set([...(e.aliases||[]),x.title,...(x.aliases||[])])].slice(0,500);
      e.sources=[...new Set([...(e.sources||[]),x.source].filter(Boolean))];
      e.updatedAt=Date.now();
      db[key]=e;
    }
    save(db);
  }

  function localLearned(raw,type){
    const q=KairoUtils.normalizeText(raw),db=load(),out=[];
    for(const e of Object.values(db)){
      if(e.type!==type)continue;
      const names=[e.canonical,...(e.aliases||[])];
      const best=Math.max(...names.map(n=>KairoUtils.similarity(q,n)),0);
      if(best>=0.58){
        out.push({
          source:'Índice aprendido',sourceId:null,title:e.canonical,type,
          aliases:e.aliases||[],genres:[],synopsis:'',status:'',year:null,score:0,popularity:0,
          searchedAs:raw,localScore:best
        });
      }
    }
    return out;
  }

  /** Pocas variantes para remoto (evita 429 / spam). Más variantes solo para matching local. */
  function remoteQueries(raw){
    const base=String(raw||'').trim();
    const n=KairoUtils.normalizeText(base);
    const out=new Set([base]);
    if(n&&n!==base.toLowerCase())out.add(n);
    // Una variante sin puntuación / guiones
    const compact=n.replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
    if(compact)out.add(compact);
    // Quitar "season / temporada / vol"
    const stripped=n.replace(/\b(season|temporada|part|parte|vol|volume|tom|tomo)\s*\d+\b/gi,'').replace(/\s+/g,' ').trim();
    if(stripped&&stripped!==n)out.add(stripped);
    return [...out].filter(Boolean).slice(0,3);
  }

  function typoVariants(raw){
    const n=KairoUtils.normalizeText(raw);
    const out=new Set([raw,n,KairoUtils.compactText(raw)]);
    const words=n.split(' ');
    const swaps=new Map([['ph','f'],['ck','k'],['qu','k'],['oo','u'],['ee','i'],['ou','u'],['y','i']]);
    for(const [a,b] of swaps)out.add(n.replaceAll(a,b));
    for(let i=0;i<words.length;i++){
      const w=words[i];
      if(w.length>=4){
        for(let j=0;j<w.length;j++)out.add([...words.slice(0,i),w.slice(0,j)+w.slice(j+1),...words.slice(i+1)].join(' '));
        for(let j=0;j<w.length-1;j++)out.add([...words.slice(0,i),w.slice(0,j)+w[j+1]+w[j]+w.slice(j+2),...words.slice(i+1)].join(' '));
      }
    }
    return [...out].filter(Boolean).slice(0,12);
  }

  function variants(raw){
    const base=String(raw||'').trim();
    const n=KairoUtils.normalizeText(base);
    const out=new Set([base,n,...typoVariants(base)]);
    const stripped=n.replace(/\b(season|temporada|part|parte|vol|volume|tom|tomo)\s*\d+\b/gi,'').replace(/\s+/g,' ').trim();
    if(stripped)out.add(stripped);
    for(const e of Object.values(load())){
      if(e.type&&[...(e.aliases||[])].some(a=>KairoUtils.similarity(n,a)>=0.78))out.add(e.canonical);
    }
    return [...out].filter(Boolean).slice(0,20);
  }

  async function searchRemote(raw,type){
    const clients=[window.KairoAniListClient,window.KairoKitsuClient,window.KairoJikanClient].filter(Boolean);
    if(type==='Manga'&&window.KairoMangaDexClient)clients.push(window.KairoMangaDexClient);
    const queries=remoteQueries(raw);
    // Máximo: 3 queries × clientes, en paralelo por fuente pero pocas queries
    const jobs=[];
    for(const c of clients){
      // Solo la query principal por cliente + como mucho una variante
      jobs.push(c.search(queries[0],type).catch(()=>[]));
      if(queries[1]&&queries[1]!==queries[0]){
        jobs.push(c.search(queries[1],type).catch(()=>[]));
      }
    }
    const all=(await Promise.all(jobs)).flat().filter(x=>x&&x.type===type);
    remember(all);
    return all;
  }

  async function search(raw,type){
    const local=[
      ...(window.KairoSourceResolver?.localCandidates(raw,type)||[]),
      ...localLearned(raw,type)
    ];
    // Si ya hay coincidencia local fuerte, no saturar APIs
    const strongLocal=local.some(x=>(x.localScore||0)>=0.90);
    let remote=[];
    if(!strongLocal){
      remote=await searchRemote(raw,type);
    }
    const map=new Map();
    for(const x of [...local,...remote]){
      const id=x.sourceId?`${x.type}::${x.source}::${x.sourceId}`:`${x.type}::${KairoUtils.normalizeText(x.title)}`;
      const prev=map.get(id);
      if(!prev){
        map.set(id,{...x,sourceSet:new Set([x.source]),matchedQueries:[x.searchedAs]});
      }else{
        prev.aliases=[...new Set([...(prev.aliases||[]),...(x.aliases||[])])];
        prev.sourceSet.add(x.source);
        prev.matchedQueries=[...new Set([...(prev.matchedQueries||[]),x.searchedAs])];
        if(!prev.synopsis&&x.synopsis)prev.synopsis=x.synopsis;
        if(!prev.year&&x.year)prev.year=x.year;
      }
    }
    return [...map.values()];
  }

  function score(raw,c){
    const names=[c.title,...(c.aliases||[])].filter(Boolean);
    const sims=names.map(n=>KairoUtils.similarity(raw,n));
    const best=Math.max(...sims,0,c.localScore||0);
    const exact=names.some(n=>KairoUtils.normalizeText(raw)===KairoUtils.normalizeText(n));
    const compact=names.some(n=>KairoUtils.compactText(raw)===KairoUtils.compactText(n));
    const token=Math.max(...names.map(n=>KairoUtils.tokenSimilarity(raw,n)),0);
    const sources=c.sourceSet?c.sourceSet.size:(c.sources?.length||1);
    const evidence=Math.min(1,sources/3);
    const strongAlias=best>=0.92?1:0;
    let confidence=best*0.52+token*0.16+evidence*0.20+strongAlias*0.12;
    if(exact)confidence=0.995;
    if(compact)confidence=Math.max(confidence,0.96);
    return {...c,matchScore:best,tokenScore:token,sourceAgreement:sources,confidence:Math.min(1,confidence)};
  }

  async function investigate(raw,type){
    const input=String(raw||'').trim();
    if(!input)return {found:false,results:[]};
    const candidates=await search(input,type);
    const groups=new Map();
    for(const c of candidates){
      const key=`${type}::${KairoUtils.normalizeText(c.title)}`;
      const old=groups.get(key);
      if(!old){
        groups.set(key,{...c,sourceSet:new Set(c.sourceSet||[c.source]),aliases:[...(c.aliases||[])]});
      }else{
        old.sourceSet=new Set([...(old.sourceSet||[]),...(c.sourceSet||[]),c.source].filter(Boolean));
        old.aliases=[...new Set([...(old.aliases||[]),...(c.aliases||[]),c.title])];
        if(!old.synopsis&&c.synopsis)old.synopsis=c.synopsis;
        if(!old.year&&c.year)old.year=c.year;
      }
    }
    const scored=[...groups.values()].map(c=>score(input,c)).sort((a,b)=>b.confidence-a.confidence);
    const best=scored[0];
    const accepted=!!best&&(best.confidence>=0.67||(best.matchScore>=0.90&&best.sourceAgreement>=1));
    return {
      input,type,
      found:accepted,
      best:accepted?{...best,sources:[...(best.sourceSet||[])]}:null,
      results:scored.slice(0,20).map(x=>({...x,sources:[...(x.sourceSet||[])]})),
      sourcesChecked:[...SOURCES,...(type==='Manga'?['MangaDex']:[]),'Índice aprendido']
    };
  }

  return {variants,search,investigate,remember,remoteQueries};
})();


/* === assets/js/services/10-translate.js === */
window.KairoTranslate=(function(){
  const CACHE_KEY='kairo.translate.v1';
  const MAX_CHUNK=900;

  function load(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch{return {}}}
  function save(db){try{localStorage.setItem(CACHE_KEY,JSON.stringify(db))}catch{}}

  function looksSpanish(text){
    const t=String(text||'');
    if(!t.trim())return false;
    if(/[áéíóúñü¿¡]/i.test(t))return true;
    const hits=(t.match(/\b(el|la|los|las|de|del|un|una|y|en|que|por|para|con|su|es|se|al|lo|como|más|pero|sus|le|ya|o|fue|este|esta|son|también|entre|cuando|muy|sin|sobre|ser|tiene|desde|todo|está|hay|durante|puede|hasta)\b/gi)||[]).length;
    const eng=(t.match(/\b(the|and|of|to|in|is|for|that|with|on|as|are|was|be|this|have|from|or|one|had|by|but|not|what|all|were|when|there|can|an)\b/gi)||[]).length;
    return hits>=3 && hits>=eng;
  }

  function looksEnglish(text){
    const t=String(text||'');
    if(!t.trim())return false;
    if(looksSpanish(t))return false;
    const eng=(t.match(/\b(the|and|of|to|in|is|for|that|with|on|as|are|was|be|this|have|from|or|one|had|by|but|not|what|all|were|when|there|can|an|your|which|their|loves|falls|after|before|team|sports|but|he|she|has|long|way|go)\b/gi)||[]).length;
    return eng>=3;
  }

  async function viaGoogle(text){
    const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
    const result=await KairoRemote.json(url,{},10000);
    if(!result.ok||!Array.isArray(result.data))return '';
    // Formato: [[["traducción","original",...],...],...]
    try{
      const chunks=result.data[0]||[];
      return chunks.map(x=>x&&x[0]?x[0]:'').join('').trim();
    }catch{return '';}
  }

  async function viaMyMemory(text){
    const url=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`;
    const result=await KairoRemote.json(url,{},9000);
    const translated=result.ok?(result.data?.responseData?.translatedText||''):'';
    if(translated && !/MYMEMORY WARNING|QUERY LENGTH|INVALID/i.test(translated))return translated;
    return '';
  }

  async function translateChunk(text){
    const q=String(text||'').trim();
    if(!q)return '';
    const key=`en|es|${q}`;
    const db=load();
    if(db[key])return db[key];

    let translated=await viaGoogle(q);
    if(!translated)translated=await viaMyMemory(q);
    if(!translated)return '';

    db[key]=translated;
    const keys=Object.keys(db);
    if(keys.length>250)keys.slice(0,keys.length-250).forEach(k=>delete db[k]);
    save(db);
    return translated;
  }

  async function toSpanish(text){
    const clean=window.KairoUtils?KairoUtils.cleanSynopsis(text):String(text||'').trim();
    if(!clean)return '';
    if(looksSpanish(clean))return clean;
    // Si no parece inglés y no tiene letras latinas largas, dejarlo
    if(!looksEnglish(clean) && !/[A-Za-z]{5,}/.test(clean))return clean;

    const parts=[];
    let buf='';
    for(const para of clean.split(/\n+/)){
      const p=para.trim();
      if(!p)continue;
      if((buf?(buf+'\n'+p):p).length<=MAX_CHUNK){
        buf=buf?`${buf}\n${p}`:p;
      }else{
        if(buf)parts.push(buf);
        if(p.length<=MAX_CHUNK)buf=p;
        else{
          const sentences=p.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[p];
          let sbuf='';
          for(const s of sentences){
            const next=(sbuf+' '+s).trim();
            if(next.length<=MAX_CHUNK)sbuf=next;
            else{if(sbuf)parts.push(sbuf);sbuf=s.trim().slice(0,MAX_CHUNK);}
          }
          buf=sbuf;
        }
      }
    }
    if(buf)parts.push(buf);

    const out=[];
    for(const part of parts){
      const tr=await translateChunk(part);
      out.push(tr||part);
    }
    return out.join('\n\n').trim();
  }

  const GENRE_MAP={
    'action':'Acción','adventure':'Aventura','comedy':'Comedia','drama':'Drama','fantasy':'Fantasía',
    'horror':'Terror','mystery':'Misterio','psychological':'Psicológico','romance':'Romance',
    'sci-fi':'Ciencia ficción','science fiction':'Ciencia ficción','slice of life':'Recuentos de la vida',
    'sports':'Deportes','supernatural':'Sobrenatural','thriller':'Suspenso','suspense':'Suspenso',
    'mecha':'Mecha','music':'Música','school':'Escolar','shounen':'Shounen','shoujo':'Shoujo',
    'seinen':'Seinen','josei':'Josei','isekai':'Isekai','historical':'Histórico','military':'Militar',
    'martial arts':'Artes marciales','super power':'Superpoderes','superpower':'Superpoderes',
    'demons':'Demonios','magic':'Magia','game':'Juegos','harem':'Harem','ecchi':'Ecchi',
    'gourmet':'Gourmet','kids':'Infantil','parody':'Parodia','police':'Policial','samurai':'Samurái',
    'space':'Espacio','vampire':'Vampiros','cars':'Autos','work life':'Vida laboral'
  };

  function genreToSpanish(g){
    const key=String(g||'').trim().toLowerCase();
    return GENRE_MAP[key]||g;
  }
  function genresToSpanish(list){return (list||[]).map(genreToSpanish);}

  return {toSpanish,looksSpanish,looksEnglish,genreToSpanish,genresToSpanish};
})();


/* === assets/js/services/11-report-feedback.js === */
/**
 * Reportes de coincidencias incorrectas.
 * - Se guarda localmente (navegador del usuario).
 * - Exige "prueba": elegir otra alternativa o escribir el título correcto.
 * - La próxima búsqueda con la misma consulta evita el título rechazado
 *   y prioriza el correcto si se indicó.
 */
window.KairoReportFeedback=(function(){
  const KEY='kairo.reports.v1';

  function load(){
    try{
      const data=JSON.parse(localStorage.getItem(KEY)||'{}');
      return {
        rejections:Array.isArray(data.rejections)?data.rejections:[],
        corrections:Array.isArray(data.corrections)?data.corrections:[]
      };
    }catch{
      return {rejections:[],corrections:[]};
    }
  }

  function save(data){
    try{localStorage.setItem(KEY,JSON.stringify(data));}catch{}
  }

  function norm(s){return (window.KairoUtils?KairoUtils.normalizeText(s):String(s||'').toLowerCase().trim());}

  /** ¿Esta pareja consulta→título fue marcada como incorrecta? */
  function isRejected(query,title,type){
    const q=norm(query), t=norm(title), ty=type==='Manga'?'Manga':'Anime';
    return load().rejections.some(r=>r.type===ty&&norm(r.query)===q&&norm(r.wrongTitle)===t);
  }

  /** Si el usuario corrigió esta consulta, devuelve el título canónico correcto. */
  function getCorrection(query,type){
    const q=norm(query), ty=type==='Manga'?'Manga':'Anime';
    const list=load().corrections.filter(c=>c.type===ty&&norm(c.query)===q)
      .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    return list[0]||null;
  }

  /**
   * Reportar coincidencia incorrecta con prueba.
   * proof = { correctTitle: string, note?: string, alternatives?: string[] }
   */
  function reportWrong(query,wrongTitle,type,proof={}){
    const q=String(query||'').trim();
    const wrong=String(wrongTitle||'').trim();
    const ty=type==='Manga'?'Manga':'Anime';
    const correct=String(proof.correctTitle||'').trim();

    if(!q||!wrong)return {ok:false,error:'Faltan datos del reporte.'};
    if(!correct||norm(correct)===norm(wrong)){
      return {ok:false,error:'Debes indicar el título correcto (distinto al que salió mal) como prueba.'};
    }
    if(correct.length<2)return {ok:false,error:'El título correcto es demasiado corto.'};

    const data=load();
    // Evitar spam: máximo 3 reportes iguales
    const same=data.rejections.filter(r=>r.type===ty&&norm(r.query)===norm(q)&&norm(r.wrongTitle)===norm(wrong));
    if(same.length>=3)return {ok:false,error:'Este error ya fue reportado varias veces.'};

    data.rejections.push({
      query:q,
      wrongTitle:wrong,
      type:ty,
      correctTitle:correct,
      note:String(proof.note||'').slice(0,200),
      at:Date.now()
    });
    // Mantener últimos 300
    data.rejections=data.rejections.slice(-300);

    // Guardar corrección activa
    const existing=data.corrections.findIndex(c=>c.type===ty&&norm(c.query)===norm(q));
    const correction={
      query:q,
      type:ty,
      correctTitle:correct,
      rejectedTitle:wrong,
      note:String(proof.note||'').slice(0,200),
      updatedAt:Date.now()
    };
    if(existing>=0)data.corrections[existing]=correction;
    else data.corrections.push(correction);
    data.corrections=data.corrections.slice(-200);

    save(data);

    // También registrar en índice de aliases aprendidos si existe deep research
    if(window.KairoDeepResearch?.remember){
      try{
        KairoDeepResearch.remember([{
          title:correct,
          type:ty,
          aliases:[q,correct],
          source:'Corrección del usuario'
        }]);
      }catch{}
    }

    return {ok:true,correction};
  }

  /** Filtra candidatos eliminando rechazos para esta consulta. */
  function filterCandidates(query,type,candidates){
    const q=norm(query), ty=type==='Manga'?'Manga':'Anime';
    const data=load();
    const rejected=new Set(
      data.rejections
        .filter(r=>r.type===ty&&norm(r.query)===q)
        .map(r=>norm(r.wrongTitle))
    );
    if(!rejected.size)return candidates||[];
    return (candidates||[]).filter(c=>{
      const titles=[c.title,...(c.aliases||[])].map(norm);
      // Si el título canónico está rechazado, fuera
      if(rejected.has(norm(c.title)))return false;
      // Si TODOS los nombres están rechazados, fuera
      return !titles.every(t=>rejected.has(t));
    });
  }

  function listForQuery(query,type){
    const q=norm(query), ty=type==='Manga'?'Manga':'Anime';
    const data=load();
    return {
      rejections:data.rejections.filter(r=>r.type===ty&&norm(r.query)===q),
      correction:getCorrection(query,type)
    };
  }

  return {reportWrong,isRejected,getCorrection,filterCandidates,listForQuery,load};
})();


/* === assets/js/services/06-metadata-enricher.js === */
window.KairoMetadataEnricher=(function(){
  function merge(base,candidates){
    const all=[base,...candidates.filter(Boolean)];
    const out={...base};
    const pick=(key)=>{
      for(const item of all){
        const value=item?.[key];
        if(value!==undefined&&value!==null&&value!==''&&(!(Array.isArray(value))||value.length))return value;
      }
      return out[key];
    };
    ['synopsis','genres','status','year','score','popularity','episodes','seasons','volumes','chapters','studio','author','sourceId']
      .forEach(k=>out[k]=pick(k));
    out.aliases=[...new Set(all.flatMap(x=>Array.isArray(x?.aliases)?x.aliases:[]).filter(Boolean))];
    out.sources=[...new Set(all.map(x=>x?.source).filter(Boolean))];
    if(out.synopsis&&window.KairoUtils)out.synopsis=KairoUtils.cleanSynopsis(out.synopsis);
    if(out.status&&window.KairoUtils)out.status=KairoUtils.translateStatus(out.status);
    if(out.genres&&window.KairoTranslate)out.genres=KairoTranslate.genresToSpanish(out.genres);
    out.metadataComplete=Boolean(out.synopsis||out.genres?.length||out.year||out.episodes||out.volumes||out.author||out.studio);
    return out;
  }

  async function enrich(item){
    if(!item?.title)return item;
    const clients=[window.KairoAniListClient,window.KairoKitsuClient,window.KairoJikanClient].filter(Boolean);
    if(item.type==='Manga'&&window.KairoMangaDexClient)clients.push(window.KairoMangaDexClient);
    try{
      const settled=await Promise.allSettled(clients.map(c=>c.search(item.title,item.type)));
      const candidates=settled.flatMap(x=>x.status==='fulfilled'&&Array.isArray(x.value)?x.value:[]);
      const narrowed=candidates.filter(c=>{
        const names=[c.title,...(c.aliases||[])];
        return Math.max(...names.map(n=>KairoUtils.similarity(item.title,n)),0)>=0.72;
      });
      let enriched=merge(item,narrowed);

      // Traducir sinopsis al español si viene en inglés
      if(enriched.synopsis&&window.KairoTranslate){
        try{
          const es=await KairoTranslate.toSpanish(enriched.synopsis);
          if(es)enriched.synopsis=es;
        }catch{/* si falla la traducción, dejamos el texto original limpio */}
      }
      if(enriched.genres&&window.KairoTranslate){
        enriched.genres=KairoTranslate.genresToSpanish(enriched.genres);
      }

      KairoStorage.cacheMeta({...enriched,cacheKey:`${enriched.type}::${KairoUtils.normalizeText(enriched.title)}`});
      return enriched;
    }catch{return item;}
  }

  return {enrich};
})();


/* === assets/js/services/07-source-resolver.js === */
window.KairoSourceResolver=(function(){
  function localCandidates(raw,type){
    const q=KairoUtils.normalizeText(raw);const out=[];
    const aliases=Array.isArray(window.KairoTitleAliases)?window.KairoTitleAliases:[];
    const profiles=window.KairoTitleProfiles||{};

    // Overrides fijos para títulos en español conocidos (evitan errores absurdos)
    const FORCE={
      'la nobleza de las flores':'The Fragrant Flower Blooms With Dignity',
      'nobleza de las flores':'The Fragrant Flower Blooms With Dignity',
      'kaoru hana wa rin to saku':'The Fragrant Flower Blooms With Dignity'
    };
    if(FORCE[q]){
      const canonical=FORCE[q];
      const entry=aliases.find(e=>e.type===type&&KairoUtils.normalizeText(e.canonical)===KairoUtils.normalizeText(canonical))
        ||{type,canonical,aliases:[raw,canonical]};
      const p=profiles[`${type}::${KairoUtils.normalizeText(canonical)}`]||{};
      out.push({
        source:'Catálogo local',sourceId:null,title:canonical,type,
        aliases:[...new Set([canonical,...(entry.aliases||[]),raw])],
        genres:p.genres||[],synopsis:p.synopsis||'',status:p.status||'',year:p.year||null,
        score:p.score||0,popularity:p.popularity||0,episodes:p.episodes||null,seasons:p.seasons||null,
        volumes:p.volumes||null,chapters:p.chapters||null,studio:p.studio||'',author:p.author||'',
        searchedAs:raw,localScore:1,matchedAlias:raw
      });
      return out;
    }

    for(const entry of aliases){
      if(entry.type!==type)continue;
      const names=[entry.canonical,...(entry.aliases||[])];
      let best=0,bestName=entry.canonical;
      for(const name of names){
        const nn=KairoUtils.normalizeText(name);
        let s=KairoUtils.similarity(q,name);
        if(q===nn)s=1;
        // Solo boost por contención si el alias tiene al menos 8 caracteres (evita falsos positivos)
        if(nn.length>=8&&(q.includes(nn)||nn.includes(q))){
          const ratio=Math.min(q.length,nn.length)/Math.max(q.length,nn.length);
          if(ratio>=0.55)s=Math.max(s,ratio);
        }
        if(s>best){best=s;bestName=name;}
      }
      if(best>=0.78){
        const p=profiles[`${type}::${KairoUtils.normalizeText(entry.canonical)}`]||{};
        out.push({
          source:'Catálogo local',sourceId:null,title:entry.canonical,type,
          aliases:[...new Set([entry.canonical,...(entry.aliases||[])])],
          genres:p.genres||[],synopsis:p.synopsis||'',status:p.status||'',year:p.year||null,
          score:p.score||0,popularity:p.popularity||0,episodes:p.episodes||null,seasons:p.seasons||null,
          volumes:p.volumes||null,chapters:p.chapters||null,studio:p.studio||'',author:p.author||'',
          searchedAs:raw,localScore:best,matchedAlias:bestName
        });
      }
    }
    const catalog=window.KairoCatalogAPI?.all?.()||[];
    for(const item of catalog.filter(x=>x.type===type)){
      const names=[item.title,...(item.aliases||[])];
      const best=Math.max(...names.map(n=>KairoUtils.similarity(q,n)),0);
      if(best>=0.82)out.push({...item,source:'Catálogo local',aliases:[...new Set([item.title,...(item.aliases||[])])],localScore:best,searchedAs:raw});
    }
    return out;
  }
  function scoreCandidate(raw,candidate){
    const names=[candidate.title,...(candidate.aliases||[])].filter(Boolean);
    const nameScore=Math.max(...names.map(n=>KairoUtils.similarity(raw,n)),0,candidate.localScore||0);
    const exact=names.some(n=>KairoUtils.normalizeText(raw)===KairoUtils.normalizeText(n));
    const weights={AniList:1,Kitsu:.97,'Jikan / MyAnimeList':.96,MangaDex:.94,'Catálogo local':.93};
    const sourceWeight=weights[candidate.source]||.9;
    const completeness=[candidate.synopsis,candidate.genres?.length,candidate.year,candidate.episodes||candidate.volumes,candidate.author||candidate.studio].filter(Boolean).length/5;
    return {candidate,nameScore,exact,score:(nameScore*.78)+(sourceWeight*.10)+(completeness*.12)};
  }
  function choose(raw,candidates){
    if(!candidates.length)return null;
    const scored=candidates.map(c=>scoreCandidate(raw,c)).sort((a,b)=>b.score-a.score);
    const top=scored[0];
    const same=scored.filter(x=>KairoUtils.normalizeText(x.candidate.title)===KairoUtils.normalizeText(top.candidate.title));
    const sources=[...new Set(same.map(x=>x.candidate.source).filter(Boolean))];
    const agreement=sources.length;
    const tokens=KairoUtils.tokens(raw);
    // Consultas largas (3+ palabras) exigen mejor coincidencia para evitar emparejamientos absurdos
    const strict=tokens.length>=3;
    const minScore=strict?0.82:0.78;
    const minAgree=strict?0.74:0.68;
    const accepted=top.exact
      ||(top.candidate.source==='Catálogo local'&&top.nameScore>=0.88)
      ||(top.candidate.source==='Corrección del usuario'&&top.nameScore>=0.5)
      ||(top.nameScore>=minScore)
      ||(top.nameScore>=minAgree&&agreement>=2);
    if(!accepted)return null;
    return {
      item:top.candidate,
      confidence:Math.min(1,top.score+(Math.min(3,agreement-1)*0.04)),
      sources,
      alternatives:scored.slice(0,10).map(x=>x.candidate),
      allScored:scored.slice(0,10)
    };
  }
  async function resolve(raw,type,{allowRemote=true,lang='auto'}={}){
    const input=String(raw||'').trim();if(!input)return null;
    const local=localCandidates(input,type);
    // Si hay match local muy fuerte (alias exacto/casi exacto), no hace falta remoto
    const strongLocal=local.some(x=>(x.localScore||0)>=0.92);
    if(!allowRemote || strongLocal){
      const picked=choose(input,local);
      if(picked)return {...picked,source:strongLocal?'local-strong':'local'};
      if(!allowRemote)return null;
    }
    // Si el usuario indica español (o auto y parece español), también buscar versión en inglés
    let searchQueries=[input];
    const isEs=lang==='es'||(lang==='auto'&&window.KairoTranslate?.looksSpanish?.(input));
    if(isEs && window.KairoTranslate?.toSpanish){
      // Traducir ES→EN para APIs (toSpanish está pensado EN→ES; usamos google gtx inverso vía remote)
      try{
        const en=await translateQueryToEnglish(input);
        if(en && KairoUtils.normalizeText(en)!==KairoUtils.normalizeText(input))searchQueries.push(en);
      }catch{}
    }
    let remote=[];
    if(window.KairoDeepResearch){
      const batches=await Promise.all(searchQueries.map(q=>window.KairoDeepResearch.search(q,type).catch(()=>[])));
      remote=batches.flat();
    } else {
      const clients=[window.KairoAniListClient,window.KairoKitsuClient,window.KairoJikanClient].filter(Boolean);
      if(type==='Manga'&&window.KairoMangaDexClient)clients.push(window.KairoMangaDexClient);
      const jobs=[];
      for(const q of searchQueries){
        for(const c of clients)jobs.push(c.search(q,type).catch(()=>[]));
      }
      remote=(await Promise.all(jobs)).flat();
    }
    const checkedSources=['Catálogo local','AniList','Kitsu','Jikan / MyAnimeList',...(type==='Manga'?['MangaDex']:[])];
    // Aplicar reportes del usuario: excluir rechazos y priorizar correcciones
    let pool=[...local,...remote];
    if(window.KairoReportFeedback){
      pool=KairoReportFeedback.filterCandidates(input,type,pool);
      const correction=KairoReportFeedback.getCorrection(input,type);
      if(correction?.correctTitle){
        // Si hay corrección, buscar ese título en el pool o forzar candidato
        const hit=pool.find(c=>KairoUtils.normalizeText(c.title)===KairoUtils.normalizeText(correction.correctTitle)
          || (c.aliases||[]).some(a=>KairoUtils.normalizeText(a)===KairoUtils.normalizeText(correction.correctTitle)));
        if(hit){
          // subir prioridad moviendo al frente
          pool=[hit,...pool.filter(x=>x!==hit)];
        }else{
          pool=[{
            source:'Corrección del usuario',sourceId:null,title:correction.correctTitle,type,
            aliases:[correction.correctTitle,input],genres:[],synopsis:'',status:'',year:null,score:0,popularity:0,
            searchedAs:input,localScore:1,matchedAlias:input
          },...pool];
        }
      }
    }
    const chosen=choose(input,pool);
    if(!chosen)return null;
    const allNames=[chosen.item.title,...(chosen.item.aliases||[]),...chosen.alternatives.flatMap(x=>[x.title,...(x.aliases||[])])].filter(Boolean);
    const famous=KairoUtils.preferFamousTitle(allNames,chosen.item.title);
    const item={...chosen.item,title:famous,type,aliases:[...new Set(allNames)],sources:chosen.sources.length?chosen.sources:[chosen.item.source||'Fuente local'],recognitionConfidence:chosen.confidence,matchedAlias:chosen.item.matchedAlias||chosen.item.title,cacheKey:`${type}::${KairoUtils.normalizeText(famous)}`};
    KairoStorage.cacheMeta(item);
    return {item,confidence:chosen.confidence,sources:item.sources,sourcesChecked:checkedSources,alternatives:chosen.alternatives};
  }
  return {resolve,localCandidates};
})();
