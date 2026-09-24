
/* === 01-query.js === */
window.KairoQuery={get(key){return new URLSearchParams(location.search).get(key)},all(){return Object.fromEntries(new URLSearchParams(location.search).entries())}};


/* === 02-time.js === */
window.KairoTime={now(){return Date.now()},iso(ts=Date.now()){return new Date(ts).toISOString()}};


/* === 03-numbers.js === */
window.KairoNumbers={clamp(n,min,max){return Math.min(max,Math.max(min,n))},percent(n,total){return total?Math.round(n/total*100):0}};


/* === 04-text.js === */
window.KairoText={same(a,b){return KairoUtils.normalizeText(a)===KairoUtils.normalizeText(b)},clean(s){return String(s||'').trim().replace(/\s+/g,' ')}};


/* === 05-events.js === */
window.KairoSharedEvents={listen(name,fn){window.addEventListener(name,fn);},emit(name,detail){window.dispatchEvent(new CustomEvent(name,{detail}));}};


/* === 06-errors.js === */
window.KairoErrors={message(error,fallback='Ocurrió un error inesperado.'){return error?.message||fallback},report(error){console.warn('[Kairo]',error)}};


/* === 07-a11y.js === */
window.KairoA11y={announce(el,text){if(!el)return;el.setAttribute('aria-live','polite');el.textContent=text;}};


/* === 08-runtime.js === */
window.KairoRuntime={isFile:location.protocol==='file:',online:navigator.onLine!==false};


/* === 09-feature-flags.js === */
window.KairoFeatures={remoteTitleLookup:true,inventoryUnits:true,combinedAnalytics:true,smartRecommendations:true};


/* === 10-debug.js === */
window.KairoDebug={enabled:false,log(...args){if(this.enabled)console.log('[Kairo]',...args)}};
