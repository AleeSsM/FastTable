/**
 * A la Carta — landing (solo frontend).
 */
const DOWNLOAD_LINKS = {
  play: "",
  apk: "/apk/alacarta.apk",
};

(function () {
  "use strict";

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const nav = document.getElementById("nav");
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

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
        "* Coloca alacarta.apk en host/site/apk/, ejecuta npm run build:host y despliega.";
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
    "Sube alacarta.apk a host/site/apk/ y vuelve a desplegar el sitio."
  );

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
