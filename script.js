/* Veebros — one IIFE, every feature existence-guarded. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };

  /* ---------------------------------------------------- sticky header --- */
  var hdr = $("[data-header]");
  if (hdr) {
    var tick = false;
    var onScroll = function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        hdr.classList.toggle("is-stuck", window.scrollY > 12);
        tick = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* -------------------------------------------------------- reveals --- */
  var reveals = $$("[data-reveal]");
  if (reveals.length) {
    var activate = function (el) { el.classList.add("is-in"); };
    if (reduced || !("IntersectionObserver" in window)) {
      reveals.forEach(activate);
    } else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) { activate(en.target); io.unobserve(en.target); }
        });
      }, { threshold: 0.1, rootMargin: "0px 0px -8% 0px" });
      reveals.forEach(function (el) { io.observe(el); });

      /* Safety net: IntersectionObserver does not fire in a hidden or
         non-composited document. Reveal anything at or above the fold —
         including content already scrolled PAST, which an anchor jump or a
         restored scroll position would otherwise strand at opacity:0. */
      var sweep = function () {
        var h = window.innerHeight || document.documentElement.clientHeight;
        reveals.forEach(function (el) {
          if (!el.classList.contains("is-in") &&
              el.getBoundingClientRect().top < h * 0.96) activate(el);
        });
      };
      ["load", "scroll", "resize", "pageshow"].forEach(function (e) {
        window.addEventListener(e, sweep, { passive: true });
      });
      setTimeout(sweep, 300);
      sweep();
    }
  }

  /* ------------------------------------------------- the 48-hour clock --- */
  /* Scroll position through the timeline IS elapsed time. The scroll trigger
     encodes the argument rather than decorating it. */
  var tl = $("[data-timeline]");
  if (tl) {
    var ch = $("[data-clock-h]"), cm = $("[data-clock-m]"),
        cf = $("[data-clock-fill]");
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var running = false;
    var paint = function () {
      running = false;
      var r = tl.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      // 0 when the section's top reaches mid-screen, 1 when its bottom does
      var span = r.height - vh * 0.35;
      var p = span > 0 ? (vh * 0.65 - r.top) / span : (r.top < 0 ? 1 : 0);
      p = Math.max(0, Math.min(1, p));
      var mins = Math.round(p * 48 * 60);
      if (ch) ch.textContent = pad(Math.floor(mins / 60));
      if (cm) cm.textContent = pad(mins % 60);
      if (cf) cf.style.width = (p * 100).toFixed(1) + "%";
    };
    var q = function () {
      if (running) return;
      running = true;
      requestAnimationFrame(paint);
    };
    window.addEventListener("scroll", q, { passive: true });
    window.addEventListener("resize", q, { passive: true });
    paint();
  }

  /* ==================== THE DEMO MACHINE ================================ */
  var machine = $("[data-machine]");
  if (machine) {
    var TYPES;
    try { TYPES = JSON.parse(machine.getAttribute("data-archetypes")); }
    catch (e) { TYPES = null; }

    if (TYPES) {
      var form = $("[data-machine-form]", machine);
      var input = $("[data-machine-input]", machine);
      var stage = $("[data-machine-stage]", machine);
      var canvas = $("[data-machine-canvas]", machine);
      var after = $("[data-machine-after]", machine);
      var send = $("[data-machine-send]", machine);
      var again = $("[data-machine-again]", machine);
      var steps = $$("[data-machine-steps] .step", machine);
      var timers = [];

      var clearTimers = function () {
        timers.forEach(clearTimeout);
        timers = [];
      };
      var at = function (fn, ms) { timers.push(setTimeout(fn, ms)); };

      /* Pick the archetype whose keywords the idea matches best. Longer
         keywords score higher so "dental clinic" beats a stray "book". */
      function classify(text) {
        var t = " " + text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ") + " ";
        var best = null, bestScore = 0;
        TYPES.forEach(function (a) {
          var score = 0;
          a.match.forEach(function (k) {
            // Require a word start, or "rent" matches "parents" and a
            // medicine-ordering app gets classified as a marketplace.
            // Still a prefix match, so "rent" catches "renting".
            if (t.indexOf(" " + k) > -1) score += k.length;
          });
          if (score > bestScore) { bestScore = score; best = a; }
        });
        return best || TYPES[TYPES.length - 1];
      }

      /* Turn the typed idea into a plausible product name.

         English puts the specific domain at the end — "a booking system for
         my dental clinic". Taking the first words gives keyword soup
         ("Booking Dental"); taking what follows "for" gives the real subject
         ("Dental Clinic"). */
      var STOP = ("a an the this that for my our your their of to in on and or with "
        + "app apps site website web system platform tool software service portal "
        + "solution build building make making create creating want need like "
        + "i we us me some something manage managing handle handling").split(" ");

      function contentWords(str) {
        return str.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, " ")
          .split(/\s+/)
          .filter(function (w) { return w && w.length > 1 && STOP.indexOf(w) === -1; });
      }

      function titleCase(words) {
        return words.map(function (w) {
          return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(" ");
      }

      function nameFor(text) {
        var lower = text.toLowerCase();
        var words;
        // prefer the noun phrase introduced by "for (my|our|the|a)"
        var m = lower.match(/\bfor\s+(?:my|our|your|their|the|a|an)?\s*(.+)$/);
        if (m) words = contentWords(m[1]);
        if (!words || !words.length) {
          var all = contentWords(lower);
          words = all.slice(-2);           // otherwise the tail carries the subject
        }
        // a leading gerund is a verb, not the subject ("renting camera gear")
        while (words.length > 1 && /ing$/.test(words[0])) words = words.slice(1);
        words = words.slice(0, 2);
        if (!words.length) return "Your Product";
        var out = titleCase(words);
        return out.length > 24 ? titleCase(words.slice(0, 1)) : out;
      }

      var PRIMS = {
        search: '<div class="el el--search"></div>',
        chips: '<div class="el el--chips"><span></span><span></span><span></span></div>',
        list: '<div class="el el--list"><b></b><i></i></div>',
        grid: '<div class="el el--grid"><span></span><span></span><span></span><span></span></div>',
        hero: '<div class="el el--hero"></div>',
        meta: '<div class="el el--meta"><i></i><i></i></div>',
        cta: '<div class="el el--cta"></div>',
        field: '<div class="el el--field"></div>',
        summary: '<div class="el el--summary"><i></i><i></i><i></i></div>',
        cal: '<div class="el el--cal">' + Array(22).join("<span></span>") + '</div>',
        kpis: '<div class="el el--kpis"><span></span><span></span><span></span></div>',
        chart: '<div class="el el--chart"><i style="height:38%"></i><i style="height:62%"></i>'
             + '<i style="height:48%"></i><i style="height:83%"></i><i style="height:56%"></i>'
             + '<i style="height:96%"></i><i style="height:71%"></i></div>',
        table: '<div class="el el--table"><i></i><i></i><i></i><i></i><i></i></div>',
        kanban: '<div class="el el--kanban"><span><i></i><i></i></span>'
              + '<span><i></i></span><span><i></i><i></i></span></div>',
        ring: '<div class="el el--ring"></div>',
        map: '<div class="el el--map"></div>',
        post: '<div class="el el--post"><b></b><u></u><i></i></div>'
      };

      function screenHTML(scr, title, n) {
        var rows = scr.rows.map(function (r, i) {
          var el = PRIMS[r] || PRIMS.field;
          // stagger the primitives so the screen visibly fills in
          return el.replace('class="el',
            'style="animation-delay:' + (n * 110 + i * 90 + 260) + 'ms" class="el');
        }).join("");
        return '<div class="scr" style="--n:' + n + '">'
          + '<div class="scr__bar"><i></i><i></i><i></i>'
          + '<span class="scr__title">' + title + ' &middot; ' + scr.t + '</span></div>'
          + '<div class="scr__body">' + rows + '</div></div>';
      }

      function setStep(i) {
        steps.forEach(function (s, n) {
          s.classList.toggle("is-live", n === i);
          s.classList.toggle("is-done", n < i);
        });
      }

      function run(idea, quiet) {
        clearTimers();
        var type = classify(idea);
        var title = nameFor(idea);

        stage.hidden = false;
        after.hidden = true;
        canvas.innerHTML = "";
        canvas.className = "canvas canvas--" + type.device;
        setStep(0);

        if (reduced) {
          // No theatre: show the finished thing immediately.
          canvas.innerHTML = '<div class="canvas__app">'
            + type.screens.map(function (s, n) { return screenHTML(s, title, n); }).join("")
            + '</div>';
          $$(".scr", canvas).forEach(function (s) { s.classList.add("is-in"); });
          setStep(steps.length);
          if (!quiet) { after.hidden = false; wire(idea, type); }
          return;
        }

        at(function () { setStep(1); }, 420);
        at(function () {
          setStep(2);
          canvas.innerHTML = '<div class="canvas__app">'
            + type.screens.map(function (s, n) { return screenHTML(s, title, n); }).join("")
            + '</div>';
          // next frame so the transition actually runs
          requestAnimationFrame(function () {
            $$(".scr", canvas).forEach(function (s) { s.classList.add("is-in"); });
          });
        }, 900);
        at(function () { setStep(3); }, 1700);
        at(function () { setStep(4); }, 2600);
        at(function () {
          setStep(steps.length);
          if (!quiet) { after.hidden = false; wire(idea, type); }
        }, 3500);
      }

      function wire(idea, type) {
        if (!send) return;
        var msg = "Hi Veebros — I'd like a demo.\n\nIdea: " + idea
          + "\n\n(Shape: " + String(type.label).replace(/&amp;/g, "&") + ")";
        send.href = "https://wa.me/" + machine.getAttribute("data-wa")
          + "?text=" + encodeURIComponent(msg);
      }

      /* Demonstrate on arrival. A visitor who lands on an empty input has to
         guess what this does; one that arrives mid-build does not. The payoff
         copy stays suppressed until they run their own idea, so the page
         never claims credit for something they did not ask for. */
      var touched = false;
      var autoRan = false;
      function autoDemo() {
        if (autoRan || touched) return;
        autoRan = true;
        run(input.getAttribute("placeholder"), true);
      }
      ["focus", "input", "keydown"].forEach(function (ev) {
        input.addEventListener(ev, function () { touched = true; }, { once: true });
      });
      if (!reduced) {
        if ("IntersectionObserver" in window) {
          var mio = new IntersectionObserver(function (es) {
            es.forEach(function (en) {
              if (en.isIntersecting) { mio.disconnect(); setTimeout(autoDemo, 700); }
            });
          }, { threshold: 0.25 });
          mio.observe(machine);
        } else {
          setTimeout(autoDemo, 900);
        }
        // IntersectionObserver does not fire in a hidden document; make sure
        // the demo still exists for anyone who arrives that way.
        setTimeout(autoDemo, 2600);
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!v) { input.focus(); return; }
        touched = true;
        run(v);
      });

      $$("[data-seed]", machine).forEach(function (b) {
        b.addEventListener("click", function () {
          input.value = b.textContent.trim();
          touched = true;
          run(input.value);
        });
      });

      if (again) {
        again.addEventListener("click", function () {
          clearTimers();
          stage.hidden = true;
          input.value = "";
          input.focus();
        });
      }
    }
  }

  /* ============================= THE MODAL ============================== */
  /* Two fields, and the scene answers to them: the cubes gather around
     whichever field has focus, then scatter when it is sent. */
  var modal = $("[data-modal]");
  if (modal) {
    var panel = $(".modal__panel", modal);
    var scrim = $("[data-scrim]");
    var sceneEl = $("[data-scene]");
    var formStage = $("[data-modal-form]", modal);
    var doneStage = $("[data-modal-done]", modal);
    var ideaForm = $("[data-idea-form]", modal);
    var fields = $$("[data-field]", modal);
    var lastFocus = null;

    var scene = function () { return window.__scene; };

    function pointAt(el) {
      var s = scene();
      if (s && el) s.focusRect(el.getBoundingClientRect());
    }

    function openModal() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      if (scrim) scrim.hidden = false;
      // Lift the cubes over the scrim immediately — this is a z-index, not an
      // animation, and must not wait on a frame that may never come.
      if (sceneEl) sceneEl.classList.add("is-modal");
      // Force a reflow so the opacity transition runs from its start state.
      // rAF would do too, but it is suspended in a hidden document and the
      // panel would then open with no transition at all.
      void modal.offsetWidth;
      if (scrim) void scrim.offsetWidth;
      modal.classList.add("is-open");
      if (scrim) scrim.classList.add("is-open");
      document.documentElement.style.overflow = "hidden";
      if (scene()) {
        scene().modal(true);
        scene().panelRect(panel.getBoundingClientRect());
      }
      pointAt(panel);
      setTimeout(function () { if (fields[0]) fields[0].focus(); }, 260);
    }

    function closeModal() {
      modal.classList.remove("is-open", "is-done");
      if (scrim) scrim.classList.remove("is-open");
      if (sceneEl) sceneEl.classList.remove("is-modal");
      document.documentElement.style.overflow = "";
      if (scene()) scene().modal(false);
      setTimeout(function () {
        modal.hidden = true;
        if (scrim) scrim.hidden = true;
        formStage.hidden = false;
        doneStage.hidden = true;
      }, 380);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    $$("[data-open-modal]").forEach(function (b) {
      b.addEventListener("click", openModal);
    });
    $$("[data-modal-close]").forEach(function (b) {
      b.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    // the cubes follow the caret from field to field, and every keystroke
    // kicks the ring outward for a beat
    fields.forEach(function (f) {
      f.addEventListener("focus", function () { pointAt(f); });
      f.addEventListener("input", function () {
        if (scene()) scene().type();
      });
    });
    addEventListener("resize", function () {
      if (modal.hidden) return;
      if (scene()) scene().panelRect(panel.getBoundingClientRect());
      var a = document.activeElement;
      pointAt(a && a.matches && a.matches("[data-field]") ? a : panel);
    }, { passive: true });

    // keep tab inside the dialog while it is open
    modal.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || modal.hidden) return;
      var f = $$('a[href],button:not([disabled]),textarea,input,select', modal)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    if (ideaForm) {
      ideaForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var idea = (ideaForm.idea.value || "").trim();
        var wa = (ideaForm.wa.value || "").trim();
        if (!idea) { ideaForm.idea.focus(); return; }
        if (!wa) { ideaForm.wa.focus(); return; }

        if (scene()) {
          scene().burst();
          scene().focusRect(panel.getBoundingClientRect());
          scene().panelRect(panel.getBoundingClientRect());
        }
        formStage.hidden = true;
        doneStage.hidden = false;
        modal.classList.add("is-done");

        // hand the brief over on the number they just gave us
        var msg = "Hi Veebros \u2014 an idea for you.\n\n" + idea + "\n\nMy WhatsApp: " + wa;
        var to = modal.getAttribute("data-wa") || "";
        setTimeout(function () {
          window.open("https://wa.me/" + to + "?text=" + encodeURIComponent(msg),
                      "_blank", "noopener");
        }, 900);
      });
    }
  }

  /* ------------------------------------------- floating label fields --- */
  /* :has() covers modern browsers on its own; this keeps the state explicit
     and handles the filled-but-not-focused case everywhere. */
  $$("[data-fl]").forEach(function (fl) {
    var input = $(".fl__input", fl);
    if (!input) return;
    var sync = function () {
      var filled = String(input.value || "").length > 0;
      fl.classList.toggle("is-raised", filled || document.activeElement === input);
      fl.classList.toggle("is-focused", document.activeElement === input);
    };
    ["focus", "blur", "input", "change"].forEach(function (e) {
      input.addEventListener(e, sync);
    });
    sync();
  });
})();
