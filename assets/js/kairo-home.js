/* config */
window.KairoConfig = Object.freeze({
  appName: "Kairo",
  loaderDuration: 1200,
  scrollBehavior: "smooth",
  defaultStatus: "ONLINE"
});


/* === assets/js/02-dom.js === */
window.KairoDOM={
  app:document.getElementById("app"),
  loadingScreen:document.getElementById("loadingScreen"),
  systemStatus:document.getElementById("systemStatus"),
  statusMessage:document.getElementById("statusMessage"),
  navButtons:[...document.querySelectorAll(".nav-button")],
  moduleButtons:[...document.querySelectorAll(".module-button")],
  moduleCards:[...document.querySelectorAll("[data-module]")]
};


/* === assets/js/03-state.js === */
window.KairoState = {
  data: { status: "ONLINE", loading: true, activeSection: "inicio", activeModule: null },
  set(patch) { Object.assign(this.data, patch); return this.data; },
  get() { return { ...this.data }; }
};


/* === assets/js/04-loader.js === */
window.KairoLoader = {
  show(text = `Cargando ${window.KairoConfig.appName}`) {
    const dom = window.KairoDOM;
    if (!dom.loadingScreen) return;
    if (dom.loadingText) dom.loadingText.textContent = text;
    dom.loadingScreen.classList.remove("is-hidden");
    window.KairoState.set({ loading: true });
  },
  hide() {
    const dom = window.KairoDOM;
    if (!dom.loadingScreen) return;
    dom.loadingScreen.classList.add("is-hidden");
    window.KairoState.set({ loading: false });
  },
  test() {
    this.show("Cargando módulo");
    window.setTimeout(() => this.hide(), window.KairoConfig.loaderDuration);
  }
};


/* === assets/js/05-status.js === */
window.KairoStatus = {
  set(status, message) {
    const dom = window.KairoDOM;
    if (dom.systemStatus) dom.systemStatus.textContent = status;
    if (dom.statusMessage && message) dom.statusMessage.textContent = message;
    window.KairoState.set({ status });
  }
};


/* === assets/js/06-navigation.js === */
window.KairoNavigation = {
  init() {
    const dom = window.KairoDOM || {};
    const buttons = Array.isArray(dom.navButtons) ? dom.navButtons : [];
    buttons.forEach(button => {
      button.addEventListener("click", () => {
        buttons.forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        const target = document.getElementById(button.dataset.section);
        if (target) {
          target.scrollIntoView({
            behavior: window.KairoConfig?.scrollBehavior || "smooth",
            block: "start"
          });
        }
        window.KairoState?.set({ activeSection: button.dataset.section });
      });
    });
  }
};


/* === assets/js/07-modules.js === */
window.KairoModules={routes:{metadata:'modules/metadata.html',inventory:'modules/inventory.html',analytics:'modules/analytics.html',recommendations:'modules/recommendations.html'},init(){window.KairoDOM.moduleButtons.forEach(button=>{button.addEventListener('click',()=>{const card=button.closest('.module-card');const moduleId=card?.dataset.module;const route=this.routes[moduleId];if(route)window.location.href=route;});});}};

/* === assets/js/08-loader-events.js === */
window.KairoLoaderEvents={init(){/* El cargador se controla automáticamente; no hay botón de prueba. */}};


/* === assets/js/09-system-events.js === */
window.KairoSystemEvents = {
  init() {
    window.addEventListener("load", () => {
      window.KairoDOM.app?.classList.add("ready");
      window.requestAnimationFrame(() => window.KairoLoader.hide());
    }, { once: true });
  }
};


/* === assets/js/10-accessibility.js === */
window.KairoAccessibility = {
  init() {
    const buttons = Array.isArray(window.KairoDOM?.navButtons) ? window.KairoDOM.navButtons : [];
    buttons.forEach(button => {
      button.setAttribute("aria-current", button.classList.contains("active") ? "page" : "false");
      button.addEventListener("click", () => {
        buttons.forEach(item => item.setAttribute("aria-current", "false"));
        button.setAttribute("aria-current", "page");
      });
    });
  }
};


/* === assets/js/11-app.js === */
window.KairoApp = {
  init() {
    window.KairoNavigation.init();
    window.KairoModules.init();
    window.KairoLoaderEvents.init();
    window.KairoSystemEvents.init();
    window.KairoAccessibility.init();
  }
};


/* === assets/js/12-bootstrap.js === */
window.KairoLoader.show("Cargando Kairo");

try {
  window.KairoApp.init();
} catch (error) {
  console.error("Kairo no pudo iniciar correctamente:", error);
  const status = document.getElementById("systemStatus");
  const message = document.getElementById("statusMessage");
  if (status) status.textContent = "ERROR";
  if (message) message.textContent = "Kairo encontró un error al iniciar. Revisa la consola del navegador.";
  document.getElementById("app")?.classList.add("ready");
  document.getElementById("loadingScreen")?.classList.add("is-hidden");
}
