(function () {
  const MOBILE = "(hover: none), (pointer: coarse), (max-width: 640px)";
  const PATHS = {
    home: "",
    story: "/story",
    related: "/lights",
    about: "/about"
  };

  function isMobile() {
    return window.matchMedia(MOBILE).matches;
  }

  function init(root) {
    const viewport = root.querySelector("[data-try-it-viewport]");
    const crosshair = root.querySelector("[data-try-it-crosshair]");
    const urlEl = root.querySelector("[data-try-it-url]");
    const host = urlEl.textContent.trim();
    const live = document.querySelector("[data-try-it-live]");
    const keyF = root.querySelector(".try-it-key-f");
    const keyD = root.querySelector(".try-it-key-d");
    const backIcon = root.querySelector("[data-try-it-back-icon]");
    const pages = new Map(
      [...root.querySelectorAll("[data-try-it-page]")].map((el) => [el.getAttribute("data-try-it-page"), el])
    );

    let armed = false;
    let aimed = null;
    let busy = false;
    let lastPoint = { x: 0, y: 0 };
    const stack = ["home"];

    function currentPage() {
      return stack[stack.length - 1];
    }

    function pageEl() {
      return pages.get(currentPage());
    }

    function clearAim() {
      if (aimed) aimed.classList.remove("is-aimed", "is-clicking");
      aimed = null;
    }

    function syncChrome() {
      const id = currentPage();
      root.dataset.page = id;
      const canOpen = !!pageEl()?.querySelector("[data-try-it-to]");
      const canBack = stack.length > 1;
      root.toggleAttribute("data-can-open", canOpen);
      root.toggleAttribute("data-can-back", canBack);
      backIcon.classList.toggle("is-active", canBack);
      const url = host + (PATHS[id] || "");
      urlEl.textContent = url;
      if (live) live.textContent = url;
    }

    function showPage(id, animate = true) {
      for (const [pageId, el] of pages) {
        el.hidden = pageId !== id;
      }
      clearAim();
      syncChrome();
      if (!animate) return;
      root.classList.add("is-loading");
      window.setTimeout(() => root.classList.remove("is-loading"), 280);
    }

    function pressKey(el) {
      el.classList.add("is-down");
      window.setTimeout(() => el.classList.remove("is-down"), 140);
    }

    function spawnRipple() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const ripple = document.createElement("span");
      ripple.className = "try-it-ripple";
      ripple.style.left = `${lastPoint.x}px`;
      ripple.style.top = `${lastPoint.y}px`;
      viewport.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    }

    function linkFromPoint(clientX, clientY) {
      const node = document.elementFromPoint(clientX, clientY);
      if (!node || !viewport.contains(node)) return null;
      return node.closest("[data-try-it-to]");
    }

    function setAimed(next) {
      if (aimed === next) return;
      if (aimed) aimed.classList.remove("is-aimed");
      aimed = next;
      if (aimed) aimed.classList.add("is-aimed");
    }

    function arm() {
      if (!isMobile()) armed = true;
    }

    root.addEventListener("pointerenter", arm);
    root.addEventListener("pointerover", arm);
    root.addEventListener("pointerleave", (event) => {
      if (root.contains(event.relatedTarget)) return;
      armed = document.activeElement === root || root.contains(document.activeElement);
      crosshair.hidden = true;
      clearAim();
    });
    root.addEventListener("focusin", arm);
    root.addEventListener("focusout", (event) => {
      if (!root.contains(event.relatedTarget)) armed = false;
    });

    viewport.addEventListener("pointermove", (event) => {
      if (isMobile()) return;
      arm();
      const rect = viewport.getBoundingClientRect();
      lastPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      crosshair.hidden = false;
      crosshair.style.transform = `translate(${lastPoint.x}px, ${lastPoint.y}px)`;
      setAimed(linkFromPoint(event.clientX, event.clientY));
    });
    viewport.addEventListener("pointerleave", () => {
      crosshair.hidden = true;
      clearAim();
    });

    viewport.addEventListener("click", (event) => {
      if (event.target.closest("[data-try-it-to]")) event.preventDefault();
    });

    window.addEventListener("keydown", (event) => {
      if (isMobile() || !armed || busy) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "KeyF") {
        if (!aimed) return;
        const next = aimed.getAttribute("data-try-it-to");
        if (!next || !pages.has(next)) return;
        event.preventDefault();
        busy = true;
        pressKey(keyF);
        aimed.classList.add("is-clicking");
        spawnRipple();
        window.setTimeout(() => {
          stack.push(next);
          showPage(next);
          busy = false;
        }, 120);
        return;
      }
      if (event.code === "KeyD") {
        if (stack.length < 2) return;
        event.preventDefault();
        busy = true;
        pressKey(keyD);
        window.setTimeout(() => {
          stack.pop();
          showPage(currentPage());
          busy = false;
        }, 120);
      }
    });

    showPage("home", false);
  }

  document.querySelectorAll("[data-try-it-demo]").forEach(init);
})();
