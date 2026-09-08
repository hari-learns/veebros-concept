/* The Fab — one object, five acts, driven by scroll.
 *
 * The acts ARE the 48 hours, and the last one is the sign-off:
 *   rings -> lattice -> chip die (traces alive) -> release -> VEEBROS
 *
 * Nothing is random. Every position is a function of index: concentric
 * ellipses, a square lattice, a die floorplan with an IO ring / bus / cache /
 * four cores, and finally letterforms sampled from real type.
 *
 * It also answers to the page: instances are pushed out of the copy column
 * while roaming, and when the idea modal is open they gather around whichever
 * field has focus.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const TAU = Math.PI * 2;
const TILT = -0.42;                    // the oval sits on a diagonal
const TILT_C = Math.cos(TILT);
const TILT_S = Math.sin(TILT);

/* A hand-authored 9x12 pixel font.
 *
 * Rasterising a real typeface and thresholding it will never give clean
 * letterforms at this size — the font's optical corrections and the cutoff
 * leave B with two different bowls and O lopsided. At nine cells wide there
 * is no room for optical correction anyway, so the glyphs are drawn by hand.
 *
 * Every letter is deliberately symmetric:
 *   V  mirrors left-right
 *   E  mirrors top-bottom
 *   B  mirrors top-bottom, so both bowls are identical (rows 2-4 and 7-9)
 *   O  mirrors both ways
 *   S  has 180-degree rotational symmetry
 * The 12-row grid is 2 (bar) + 3 (counter) + 2 (bar) + 3 (counter) + 2 (bar),
 * which is what makes the B and E halves come out exactly equal.
 */
const GLYPHS = {
  V: ["##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      ".##...##.",
      ".##...##.",
      ".##...##.",
      "..##.##..",
      "..##.##..",
      "..##.##..",
      "...###...",
      "...###..."],
  E: ["#########",
      "#########",
      "##.......",
      "##.......",
      "##.......",
      "#######..",
      "#######..",
      "##.......",
      "##.......",
      "##.......",
      "#########",
      "#########"],
  B: ["#######..",
      "########.",
      "##....##.",
      "##....##.",
      "##....##.",
      "########.",
      "########.",
      "##....##.",
      "##....##.",
      "##....##.",
      "########.",
      "#######.."],
  R: ["#######..",
      "########.",
      "##....##.",
      "##....##.",
      "##....##.",
      "########.",
      "#######..",
      "##..##...",
      "##...##..",
      "##...##..",
      "##....##.",
      "##....##."],
  O: ["..#####..",
      ".#######.",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      ".#######.",
      "..#####.."],
  S: [".#######.",
      "########.",
      "##.......",
      "##.......",
      "##.......",
      "########.",
      ".########",
      ".......##",
      ".......##",
      ".......##",
      ".########",
      ".#######."],
  /* The second wordmark. Same 12-row grid, same 2px stroke, so both phrases
     are one typeface rather than two. Widths vary per glyph — I and L are
     narrow because forcing them into a 9-column box would make the phrase
     read as spaced-out capitals. */
  I: ["#####",
      "#####",
      ".###.",
      ".###.",
      ".###.",
      ".###.",
      ".###.",
      ".###.",
      ".###.",
      ".###.",
      "#####",
      "#####"],
  D: ["#######..",
      "########.",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##",
      "########.",
      "#######.."],
  A: ["...###...",
      "..#####..",
      "..##.##..",
      ".##...##.",
      ".##...##.",
      ".##...##.",
      "#########",
      "#########",
      "##.....##",
      "##.....##",
      "##.....##",
      "##.....##"],
  L: ["##.....",
      "##.....",
      "##.....",
      "##.....",
      "##.....",
      "##.....",
      "##.....",
      "##.....",
      "##.....",
      "##.....",
      "#######",
      "#######"],
  F: ["#########",
      "#########",
      "##.......",
      "##.......",
      "##.......",
      "#######..",
      "#######..",
      "##.......",
      "##.......",
      "##.......",
      "##.......",
      "##......."],
  // padded two columns each side so the arrow gets air the letters do not
  "\u2192": [
      ".....##......",
      "......##.....",
      ".......##....",
      "........##...",
      ".........##..",
      "..#########..",
      "..#########..",
      ".........##..",
      "........##...",
      ".......##....",
      "......##.....",
      ".....##......"],
};

/* Lays a phrase out in cells. Coordinates come back in COLUMN units centred
   on the origin, not world units — the caller multiplies by one shared pitch,
   which is what keeps two phrases of different length at the same type size
   and both dead centre. */
function buildWord(text, maxCubes) {
  const GH = 12, GAP = 2;
  const letters = text.split("");

  let cols = 0;
  const runs = letters.map((ch) => {
    const g = GLYPHS[ch];
    const x0 = cols;
    cols += (g ? g[0].length : 0) + GAP;
    return { g, x0 };
  });
  cols -= GAP;

  const cells = [];
  runs.forEach(({ g, x0 }) => {
    if (!g) return;
    for (let r = 0; r < GH; r++) {
      for (let c = 0; c < g[r].length; c++) {
        if (g[r][c] === "#") cells.push([x0 + c, r]);
      }
    }
  });
  if (!cells.length) return null;

  let pts = cells.map(([c, r]) => new THREE.Vector3(
    c - (cols - 1) / 2, -(r - (GH - 1) / 2), 0));

  // never clip a glyph: if the word needs more cubes than we have, thin it
  if (pts.length > maxCubes) {
    const keep = [];
    const stride = pts.length / maxCubes;
    for (let i = 0; i < maxCubes; i++) keep.push(pts[Math.floor(i * stride)]);
    pts = keep;
  }
  return { pts, cols };
}

async function boot() {
  const canvas = document.createElement("canvas");
  canvas.className = "scene__canvas";
  host.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: true, powerPreference: "high-performance",
  });
  let mobile = innerWidth < 760;
  const narrow = () => innerWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);
  camera.position.set(0, 0, 16);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xFFFFFF, 1.5);
  key.position.set(5, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7C5CFF, 2.2);   // violet edge
  rim.position.set(-7, -3, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x4568FF, 1.1);  // blue fill
  fill.position.set(3, -5, 2);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xE8EBF5, 1.5));

  /* ---------------------------------------------------------- geometry --- */
  // Both wordmarks must render every cell rather than be thinned: the longer
  // phrase needs 510, so 24x24 = 576 on desktop and 23x23 = 529 on a phone.
  // SPREAD below keeps each breakpoint's composition exactly as it was, so
  // the extra cubes read as density and not as a bigger object.
  const GRID = mobile ? 23 : 24;
  const COUNT = GRID * GRID;
  const half = (GRID - 1) / 2;

  const geo = new THREE.BoxGeometry(1, 1, 1);
  // Transparent and dark: it must sit UNDER the type at all times. The rim
  // light describes the silhouette; the traces do the talking.
  // White base: every cube's real colour lives in instanceColor, which is
  // what lets a single one light up without touching the rest.
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xFFFFFF, metalness: 0.18, roughness: 0.52,
    clearcoat: 1, clearcoatRoughness: 0.30,
    transparent: true, opacity: 0.72,
  });
  const rig = new THREE.Group();          // lets the object be staged
  scene.add(rig);
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(COUNT * 3).fill(1), 3);
  rig.add(mesh);

  /* An ambient wave that lives BEHIND the wordmark, on its own mesh, so the
     letters themselves never move. Only visible at the sign-off — the rest of
     the page has enough going on. */
  const WCOLS = mobile ? 22 : 32, WROWS = mobile ? 7 : 9;
  const WCOUNT = WCOLS * WROWS;
  const WPITCH = 0.60;
  const waveMat = new THREE.MeshPhysicalMaterial({
    color: 0x9AA4D8, metalness: 0.12, roughness: 0.55,
    transparent: true, opacity: 0,
  });
  const wave = new THREE.InstancedMesh(geo, waveMat, WCOUNT);
  wave.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wave.frustumCulled = false;
  wave.visible = false;
  scene.add(wave);

  const traceMat = new THREE.MeshBasicMaterial({
    color: 0x4568FF, transparent: true, opacity: 0.9 });
  const traceCount = mobile ? 24 : 40;
  const traces = new THREE.InstancedMesh(geo, traceMat, traceCount);
  traces.frustumCulled = false;
  rig.add(traces);

  function floorplan(cx, cy) {
    const ax = Math.abs(cx) / half, ay = Math.abs(cy) / half;
    const m = Math.max(ax, ay);
    const onBus = Math.abs(cx) < 0.75 || Math.abs(cy) < 0.75;
    if (m > 0.86) return 0.20;                      // IO pads
    if (onBus) return 0.34;                         // bus channels
    if (m > 0.60) return 0.52;                      // cache band
    const mod = ((Math.abs(cx) | 0) % 3 === 0 || (Math.abs(cy) | 0) % 3 === 0);
    return mod ? 0.78 : 1.15;                       // four cores
  }

  // Sized against the frustum: at fov 38 / z 16 the visible half-width is
  // ~8.2 world units, so the outer ring sits just past it and the inner one
  // clears the copy column.
  const RINGS = 6;
  const perRing = Math.ceil(COUNT / RINGS);

  // Grid-independent staging. cx/cy are normalised against the grid each
  // breakpoint was composed on — 22 wide on desktop, 16 on a phone — so
  // raising GRID for the wordmark changes the cube count and nothing else.
  // Normalising both to the desktop figure would have grown the phone's chip
  // by 40% and run it off the side of the frame.
  const SPREAD = (mobile ? 7.5 : 10.5) / half;

  const P = [];
  for (let i = 0; i < COUNT; i++) {
    const gx = i % GRID, gy = (i / GRID) | 0;
    const cx = (gx - half) * SPREAD, cy = (gy - half) * SPREAD;
    const ring = Math.floor(i / perRing);
    const slot = i % perRing;

    P.push({
      ringA: (slot / perRing) * TAU + ring * 0.18,
      ringI: ring,
      ringRX: 5.2 + ring * 1.0,
      ringRY: 2.0 + ring * 0.5,
      ringZ: Math.sin(ring * 1.1) * 1.2,
      lattice: new THREE.Vector3(cx * 0.66, cy * 0.66, 0),
      die: new THREE.Vector3(cx * 0.40, cy * 0.40, 0),
      // release: a wide symmetric spray, still ordered
      free: new THREE.Vector3(
        Math.cos((i / COUNT) * TAU * 3) * (7 + (i % 5) * 1.1),
        Math.sin((i / COUNT) * TAU * 3) * (4.4 + (i % 4) * 0.8),
        Math.sin(i * 0.7) * 3),
      h: floorplan(cx, cy),
      phase: (i % 7) / 7,
      u: i / COUNT,          // its place on the modal loop, 0..1
      wordA: null,
      wordB: null,
    });
  }

  // the camera's settled z at the sign-off (see the camera line in frame())
  const WORD_CAM_Z = 16.6;

  /* Two wordmarks on one pitch. The sign-off alternates between them every
     five seconds; cube i holds its cell in each, so the swap is a morph
     rather than a cut, and a cube that only belongs to one of them grows in
     and shrinks out on the spot. */
  const WORDS = [buildWord("VEEBROS", COUNT), buildWord("IDEAS\u2192LIFE", COUNT)];
  const WORD_COLS = Math.max(...WORDS.map((w) => (w ? w.cols : 1)));
  for (let i = 0; i < COUNT; i++) {
    // spare cubes park where they stand and shrink away, so each word is
    // exactly its glyphs and nothing else
    P[i].wordA = WORDS[0] ? WORDS[0].pts[i] || null : null;
    P[i].wordB = WORDS[1] ? WORDS[1].pts[i] || null : null;
  }

  /* One pitch, chosen so the LONGER phrase fits the frame — which is what
     makes both phrases the same type size. Recomputed on resize, because on
     a portrait phone the frustum is a third of the desktop's width and a
     fixed pitch would run the wordmark off both edges. */
  let wordK = 0.14;
  const fitWord = () => {
    const visH = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * WORD_CAM_Z;
    wordK = Math.min(14.2, visH * camera.aspect * 0.90) / WORD_COLS;
  };
  fitWord();

  const dummy = new THREE.Object3D();
  const cBase = new THREE.Color();
  const cLit = new THREE.Color(0x3355F0);   // the pop
  const cTmp = new THREE.Color();
  const pos = new THREE.Vector3();
  const world = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const focusW = new THREE.Vector3();
  const panelW = new THREE.Vector3();
  const edgeW = new THREE.Vector3();
  const centreW = new THREE.Vector3();
  const frameW = new THREE.Vector3();

  /* ------------------------------------------------------------ scroll --- */
  let target = 0, cur = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  };
  addEventListener("scroll", readScroll, { passive: true });
  addEventListener("resize", () => {
    mobile = narrow();
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    fitWord();
    readScroll();
  }, { passive: true });
  readScroll();

  let live = true;
  addEventListener("visibilitychange", () => { live = !document.hidden; });

  /* Pointer. Cubes shove out of the way of the cursor — most obvious on the
     wordmark, where they are the content and you can push the letters
     around. Hover only: a coarse pointer has no hover state and a finger
     already has the scroll. */
  const hover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const ptr = new THREE.Vector2(-9, -9);
  const ptrTo = new THREE.Vector2(-9, -9);
  let ptrOn = 0, ptrOnT = 0;
  if (hover) {
    addEventListener("pointermove", (e) => {
      ptrTo.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1));
      ptrOnT = 1;
    }, { passive: true });
    addEventListener("pointerleave", () => { ptrOnT = 0; }, { passive: true });
    addEventListener("blur", () => { ptrOnT = 0; });
  }

  /* ------------------------------------------------ the page's handle --- */
  // The modal drives these. Cubes gather around whichever field has focus.
  let modal = 0, modalT = 0;            // 0..1 blend into modal behaviour
  let burst = 0, burstT = 0;            // the submit payoff
  let loopT = 0;
  // One character in, a few cells on the board light up and fade — the chip
  // reacting to input. Indices are chosen per keystroke, so the pattern never
  // repeats.
  const lit = new Float32Array(COUNT);
  let anyLit = false;
  const panelN = new THREE.Vector2(0, 0);      // the modal panel, in NDC
  const panelHalf = new THREE.Vector2(0.3, 0.4);
  const focusN = new THREE.Vector2(0, 0);
  const focusTargetN = new THREE.Vector2(0, 0);

  window.__scene = {
    modal(on) { modalT = on ? 1 : 0; },
    // the panel the cubes must ring — they orbit OUTSIDE this box
    panelRect(r) {
      if (!r) return;
      panelN.set((r.left + r.width / 2) / innerWidth * 2 - 1,
                 -((r.top + r.height / 2) / innerHeight * 2 - 1));
      panelHalf.set(Math.max(r.width / innerWidth, 0.12),
                    Math.max(r.height / innerHeight, 0.12));
    },
    focusRect(r) {
      if (!r) return;
      focusTargetN.set((r.left + r.width / 2) / innerWidth * 2 - 1,
                       -((r.top + r.height / 2) / innerHeight * 2 - 1));
    },
    // every keystroke lights a handful of cells
    type() {
      const n = 5 + ((Math.random() * 4) | 0);
      for (let k = 0; k < n; k++) {
        lit[(Math.random() * COUNT) | 0] = 1;
      }
      anyLit = true;
    },
    burst() { burstT = 1; setTimeout(() => { burstT = 0; }, 2600); },
  };

  // NDC -> the world point on the z=0 plane, so a screen position becomes a
  // place the cubes can actually gather around.
  function ndcToWorld(nx, ny, out) {
    out.set(nx, ny, 0.5).unproject(camera);
    out.sub(camera.position);
    const t = -camera.position.z / out.z;
    return out.multiplyScalar(t).add(camera.position);
  }

  const ease = (t) => t * t * (3 - 2 * t);
  const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));

  const ZX = 0.62, ZY = 0.44, PUSH = 1.7;

  const SWAP_MS = 5000;         // the beat the two wordmarks alternate on
  let slot = 0;                 // 0 = VEEBROS, 1 = IDEAS -> LIFE
  let mix = 0;                  // eased position between them
  let swapAt = 0;
  const wp = new THREE.Vector3();
  const far = new THREE.Vector3();

  let t = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (!live) return;

    cur += (target - cur) * 0.055;
    modal += (modalT - modal) * 0.07;
    burst += (burstT - burst) * 0.09;
    loopT += 0.0016;
    ptrOn += (ptrOnT - ptrOn) * 0.08;
    ptr.x += (ptrTo.x - ptr.x) * 0.16;
    ptr.y += (ptrTo.y - ptr.y) * 0.16;
    if (anyLit) {
      let still = false;
      for (let k = 0; k < COUNT; k++) {
        if (lit[k] > 0.002) { lit[k] *= 0.935; still = true; } else lit[k] = 0;
      }
      anyLit = still;
    }
    focusN.x += (focusTargetN.x - focusN.x) * 0.08;
    focusN.y += (focusTargetN.y - focusN.y) * 0.08;
    t += 0.0055;

    const p = cur;
    const toLattice = ease(seg(p, 0.03, 0.32));
    const toDie     = ease(seg(p, 0.32, 0.62));
    const alive     = ease(seg(p, 0.56, 0.78));
    const toFree    = ease(seg(p, 0.78, 0.88));   // release
    const toWord    = ease(seg(p, 0.88, 1.0));    // the sign-off
    const roam      = Math.max(1 - toDie, toFree * (1 - toWord));

    /* The alternation. It only runs while the sign-off is actually on screen,
       and resets to VEEBROS when you leave, so the section always opens on
       the name. */
    const wordAmt = toWord * (1 - modal);
    if (wordAmt > 0.45) {
      const now = performance.now();
      if (!swapAt) swapAt = now + SWAP_MS;
      else if (now >= swapAt) { slot ^= 1; swapAt = now + SWAP_MS; }
    } else if (swapAt) { swapAt = 0; slot = 0; }
    mix += (slot - mix) * 0.09;

    let panelWX = 3.2, panelWY = 2.4, modalBeep = 0;
    let ringX0 = 4.45, ringY0 = 3.40, ringStepX = 1.15, ringStepY = 0.72;
    if (modal > 0.01) {
      ndcToWorld(focusN.x, focusN.y, focusW);
      ndcToWorld(panelN.x, panelN.y, panelW);
      // half-extents of the panel in world units, so the ring clears it
      ndcToWorld(panelN.x + panelHalf.x, panelN.y + panelHalf.y, edgeW);
      panelWX = Math.abs(edgeW.x - panelW.x);
      panelWY = Math.abs(edgeW.y - panelW.y);

      /* The ring has to do two things at once: clear the panel, and stay
         inside the frame. Growing it off the panel alone (+1.15 per ring)
         pushed every ring past the frustum on a wide, short window — the
         oval became two arcs stuck to the left and right edges. So the
         innermost ring clears the panel, the outermost sits just inside the
         frame, and the rest are spaced evenly between the two. That makes
         the oval read the same whatever shape the window is. */
      ndcToWorld(0, 0, centreW);
      ndcToWorld(0.96, 0.96, frameW);
      const visHW = Math.abs(frameW.x - centreW.x);
      const visHH = Math.abs(frameW.y - centreW.y);
      ringX0 = panelWX + 1.25;
      ringY0 = panelWY + 1.00;
      // the max() floors keep a visible gap between rings when the panel
      // already fills the frame and there is nothing left to spread into
      ringStepX = Math.max(0.16, (Math.max(visHW, ringX0 + 0.8) - ringX0) / (RINGS - 1));
      ringStepY = Math.max(0.12, (Math.max(visHH, ringY0 + 0.6) - ringY0) / (RINGS - 1));
    }

    // set before the loop that reads it — otherwise frame one renders black
    cBase.setHex(toWord * (1 - modal) > 0.5 ? 0x5B6BF0
               : (modal > 0.5 ? 0xAEB7E8 : 0xC9CEE6));

    for (let i = 0; i < COUNT; i++) {
      const s = P[i];
      let sBeep = 0;

      const ang = s.ringA + t * (0.40 - s.ringI * 0.045);
      pos.set(Math.cos(ang) * s.ringRX, Math.sin(ang) * s.ringRY, s.ringZ);
      pos.lerp(s.lattice, toLattice).lerp(s.die, toDie);
      if (toFree > 0) pos.lerp(s.free, toFree);
      if (wordAmt > 0) {
        const a = s.wordA, b = s.wordB;
        if (a || b) {
          // a cube missing from one word holds the other word's cell and
          // simply has no size there, so nothing flies in from off-screen
          const pa = a || b, pb = b || a;
          wp.set((pa.x + (pb.x - pa.x) * mix) * wordK,
                 (pa.y + (pb.y - pa.y) * mix) * wordK, 0);
          pos.lerp(wp, wordAmt);
        } else {
          pos.lerp(far.set(pos.x * 3.2, pos.y * 3.2, -14), wordAmt);
        }
      }

      /* Modal: the hero's own ring formation, re-centred on the form.
         Same concentric ellipses, same per-ring rotation, sized so the
         innermost clears the panel, and tilted onto a diagonal. */
      if (modal > 0.01) {
        const push = burst * (5 + (i % 9));
        const rx = ringX0 + s.ringI * ringStepX + push;
        const ry = ringY0 + s.ringI * ringStepY + push * 0.7;
        const ox = Math.cos(ang) * rx;
        const oy = Math.sin(ang) * ry;
        pos.lerp(new THREE.Vector3(
          panelW.x + ox * TILT_C - oy * TILT_S,
          panelW.y + ox * TILT_S + oy * TILT_C,
          s.ringZ * 0.5 + lit[i] * 1.2), modal);
      }

      const wantsCopyPush = roam > 0.02 && modal < 0.4;
      // Pointer shove is for the sign-off only. Everywhere else the cubes are
      // background and should not react to the cursor at all.
      const wantsPointer = ptrOn > 0.02 && toWord > 0.55 && modal < 0.4;
      if (wantsCopyPush || wantsPointer) {
        world.copy(pos).applyMatrix4(mesh.matrixWorld);
        ndc.copy(world).project(camera);

        if (wantsCopyPush) {
          const d = Math.max(Math.abs(ndc.x) / ZX, Math.abs(ndc.y) / ZY);
          if (d < 1) {
            const len = Math.hypot(ndc.x, ndc.y) || 0.0001;
            const f = (1 - d) * PUSH * roam * (1 - modal);
            pos.x += (ndc.x / len) * f;
            pos.y += (ndc.y / len) * f * 0.7;
          }
        }

        if (wantsPointer) {
          // aspect-corrected so the shove is round, not an ellipse
          const dx = (ndc.x - ptr.x) * (innerWidth / innerHeight);
          const dy = ndc.y - ptr.y;
          const dist = Math.hypot(dx, dy);
          // 0.09 NDC ~= 4% of viewport height: a handful of cubes around the
          // cursor, not a crater. The first pass at 0.42 punched a hole
          // through the whole die.
          const R = 0.09;
          if (dist < R) {
            const k = 1 - dist / R;
            const f = k * k * 0.75 * ptrOn * toWord / Math.max(rig.scale.x, 0.2);
            const len = dist || 0.0001;
            pos.x += (dx / len) * f;
            pos.y += (dy / len) * f;
            pos.z += k * 0.35;
            sBeep = Math.max(sBeep, k * 0.3);   // and they swell a little
          }
        }
      }

      dummy.position.copy(pos);
      const r = roam * (1 - modal);
      dummy.rotation.set(0.22 * r, ang * 0.25 * r + modal * ang * 0.4, 0.16 * r);

      // a lit cell pops: colour AND a little scale, or it just recolours
      if (lit[i] > 0.002) sBeep = Math.max(sBeep, lit[i] * 0.6);

      const dieAmt = Math.max(toDie, modal);
      const flat = wordAmt;
      let side = (0.19 + 0.15 * dieAmt) * (1 + sBeep * 1.5);
      let depth = (0.19 * (1 - dieAmt) + s.h * dieAmt) * (1 - flat) + 0.20 * flat;
      if (wordAmt > 0) {
        // presence in the blend: 1 in both words, ramping to 0 in neither
        const occ = (s.wordA ? 1 : 0) + ((s.wordB ? 1 : 0) - (s.wordA ? 1 : 0)) * mix;
        // fill the cell, minus a hairline, so glyphs read as solid strokes
        side = side * (1 - wordAmt) + wordK * 0.92 * occ * wordAmt;
        depth = depth * (1 - wordAmt) + wordK * 0.55 * occ * wordAmt;
      }
      dummy.scale.set(side, side, depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      cTmp.copy(cBase);
      if (lit[i] > 0.002) cTmp.lerp(cLit, Math.min(1, lit[i]));
      mesh.setColorAt(i, cTmp);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const traceOn = toDie * (1 - toFree) * (1 - modal);
    traces.visible = traceOn > 0.04;
    if (traces.visible) {
      const span = half * 0.40;
      for (let i = 0; i < traceCount; i++) {
        const f = (i + 0.5) / traceCount;
        const vertical = i % 2 === 0;
        const lane = (f * 2 - 1) * span;
        const slide = Math.sin(t * 0.9 + i * 0.9) * span * 0.55;
        if (vertical) dummy.position.set(lane, slide, 0.62);
        else dummy.position.set(slide, lane, 0.62);
        dummy.rotation.set(0, 0, 0);
        const on = alive * (0.55 + 0.45 * Math.sin(t * 2.6 + i * 1.7));
        const long = 1.5 * traceOn;
        if (vertical) dummy.scale.set(0.05, long, 0.03 + 0.06 * on);
        else dummy.scale.set(long, 0.05, 0.03 + 0.06 * on);
        dummy.updateMatrix();
        traces.setMatrixAt(i, dummy.matrix);
      }
      traces.instanceMatrix.needsUpdate = true;
      traceMat.opacity = 0.9 * traceOn;
      // blue settling toward violet as the die comes alive
      traceMat.color.setRGB(0.27 + alive * 0.22, 0.41 - alive * 0.05, 1);
    }

    // the wordmark is the content, so it takes the brand colour

    /* Staging. The die is ~9 world units across and the copy column is dead
       centre, so a centred chip simply sits on top of the words. While there
       is anything to read the object moves to the right edge and shrinks —
       a machine glimpsed beside the text. It only takes the stage where
       there is nothing to read: the hero and the sign-off. */
    const reading = toDie * (1 - toWord);             // 1 while the die is up
    const offX = 6.4 * reading * (1 - modal);
    const sc = (1 - 0.46 * reading) * (1 - modal * 0.25);
    rig.position.x += (offX - rig.position.x) * 0.06;
    rig.scale.setScalar(rig.scale.x + (sc - rig.scale.x) * 0.06);
    // and it recedes further while the eye is on the copy

    // only the wordmark flattens the view; the modal keeps the board tilted
    const flatten = toWord * (1 - modal);
    const dieView = Math.max(toDie, modal);
    camera.position.set(Math.sin(t * 0.22) * 0.7 * roam * (1 - flatten) * (1 - modal),
                        (0.9 - dieView * 0.4) * (1 - flatten),
                        16 + toLattice * 1.2 - dieView * 1.0 + toFree * 1.6 * (1 - modal)
                          - flatten * 1.2);
    mesh.rotation.x = -0.88 * dieView * (1 - flatten);
    mesh.rotation.z = 0.20 * dieView * (1 - flatten);
    traces.rotation.copy(mesh.rotation);
    camera.lookAt(0, (-1.1 * dieView) * (1 - flatten), 0);

    /* the wave: a travelling swell on a grid, behind the letters */
    const waveAmt = toWord * (1 - modal);
    wave.visible = waveAmt > 0.02;
    if (wave.visible) {
      waveMat.opacity = 0.62 * waveAmt;
      for (let i = 0; i < WCOUNT; i++) {
        const gx = i % WCOLS, gy = (i / WCOLS) | 0;
        const x = (gx - (WCOLS - 1) / 2) * WPITCH;
        const y = (gy - (WROWS - 1) / 2) * WPITCH;
        // two crossing swells so it never reads as a single repeating ripple
        const h = Math.sin(gx * 0.52 + t * 3.1) * 0.72
                + Math.cos(gy * 0.75 - t * 2.2) * 0.52;
        dummy.position.set(x, y, -2.1 + h);
        dummy.rotation.set(0, 0, h * 0.35);
        const sc2 = 0.17 + Math.max(0, h) * 0.13;
        dummy.scale.set(sc2, sc2, sc2);
        dummy.updateMatrix();
        wave.setMatrixAt(i, dummy.matrix);
      }
      wave.instanceMatrix.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  host.classList.add("is-live");
  frame();
}

/* ---------------------------------------------------------------------------
   Start it. This call lives at the BOTTOM on purpose: boot() runs its body
   synchronously, so any module-level `const` declared below the call site is
   still in the temporal dead zone when boot() reaches it. That has now bitten
   twice — first TAU, then GLYPHS — and each time the symptom was a scene that
   simply never appeared. Declarations first, invocation last.
   --------------------------------------------------------------------------- */
const host = document.querySelector("[data-scene]");
if (host && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // Never swallow this: a silent catch turns a one-line ReferenceError into an
  // invisible failure — the canvas mounts, `is-live` never lands, the poster
  // stays up, and the page looks merely empty rather than broken.
  boot().catch((err) => { console.warn("[scene] disabled:", err); });
}
