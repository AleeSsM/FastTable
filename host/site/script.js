/**
 * FastTable — landing (solo frontend).
 *
 * CONFIGURA AQUÍ los enlaces de descarga cuando los tengas.
 * Deja la cadena vacía ("") para que el botón muestre el aviso de "próximamente".
 */
const DOWNLOAD_LINKS = {
  // Ej.: "https://play.google.com/store/apps/details?id=com.fasttable.app"
  play: "",
  // Tras el build/host, el APK vive en /apk/fasttable.apk en tu dominio
  apk: "/apk/fasttable.apk",
};

(function () {
  "use strict";

  // Año dinámico en el footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Sombra/borde de la nav al hacer scroll
  const nav = document.getElementById("nav");
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Menú móvil
  const burger = document.getElementById("burger");
  if (burger && nav) {
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("is-menu-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll(".nav__links a").forEach((a) => {
      a.addEventListener("click", () => {
        nav.classList.remove("is-menu-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Botones de descarga (placeholder hasta tener los enlaces reales)
  const note = document.getElementById("download-note");
  let noteTimer = null;

  const flashNote = (msg) => {
    if (!note) return;
    note.textContent = msg;
    note.classList.add("is-flash");
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      note.classList.remove("is-flash");
      note.textContent =
        "* Coloca fasttable.apk en host/site/apk/, ejecuta npm run build:host y despliega.";
    }, 3200);
  };

  const setupStoreButton = (id, key, pendingMsg) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const url = DOWNLOAD_LINKS[key];
    if (url) {
      btn.setAttribute("href", url);
      btn.setAttribute("target", "_blank");
      btn.setAttribute("rel", "noopener");
    } else {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        flashNote(pendingMsg);
      });
    }
  };

  setupStoreButton(
    "playstore-btn",
    "play",
    "Google Play estará disponible muy pronto. ¡Gracias por tu interés!"
  );
  setupStoreButton(
    "apk-btn",
    "apk",
    "Sube fasttable.apk a host/site/apk/ y vuelve a desplegar el sitio."
  );

  // Animaciones de aparición al hacer scroll
  const revealTargets = document.querySelectorAll(
    ".feature, .role, .step, .download__card, .section__head"
  );
  revealTargets.forEach((el) => el.classList.add("reveal"));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }
})();
