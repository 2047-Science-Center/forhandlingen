// Stationsmodeller + platser för "så här ska ni stå" (XY-PLATSER.md, Josefs beslut 2026-11-18).
//
// Konvention (alla stationer): kameran står på +X och tittar mot −X, så
//   sida A / första zonen = +Z = VÄNSTER i bild, sida B = −Z = HÖGER i bild.
// Mått i meter. Varje station:
//   build()   → THREE.Group med modellen
//   zones     → golvzoner { id: { label, side, cx, cz, w, d } } (färg = sidans/zonens färg)
//   roles     → plats-id → { zone, title, prop, headset, mic, pattern, slots: [[x, z, faceX, faceZ], …] }
//               Fler personer än slots → extra platser runt zonens sista slot.
//   arrival   → ankomstläge: köer per startsida A/B ([[x, z, faceX, faceZ], …], 4 st)
//   cam       → { target: [x, y, z], r, h }
import { THREE, makeStation, PAL } from './lib.js';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
const box = (g, w, h, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
};
const matFrame = M(PAL.frame, { roughness: 0.6, metalness: 0.2 });
const matPanel = M(PAL.panel);
const matTop = M(PAL.top, { roughness: 0.7 });
const matDark = M(0x1b1d21, { roughness: 0.6 });
const matScreen = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, emissive: 0x1a1206, roughness: 0.4 });
const matGlass = new THREE.MeshStandardMaterial({ color: 0xbfd0ff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });

// kö ut från en punkt, vinkelrätt mot stationen (sz = +1 på A-sidan, −1 på B-sidan)
const queue = (sz, z0 = 0.95, dz = 0.47, faceZ = 0) =>
  [-0.05, 0.28, -0.22, 0.24].map((x, i) => [x, sz * (z0 + i * dz), x, faceZ]);

// vagn på hjul (svetsvagn): ben, hyllor, skiva
function cart(g, W, D, H, { shelves = [0.2, 0.56] } = {}) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(g, 0.035, H - 0.08, 0.035, matFrame, sx * (W / 2 - 0.02), 0.07 + (H - 0.08) / 2, sz * (D / 2 - 0.02));
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.022, 14), matDark);
    w.rotation.x = Math.PI / 2; w.position.set(sx * (W / 2 - 0.02), 0.032, sz * (D / 2 - 0.02)); g.add(w);
  }
  for (const y of shelves) box(g, W - 0.02, 0.02, D - 0.02, matTop, 0, y, 0);
  box(g, W, 0.03, D, matTop, 0, H - 0.015, 0);
}

/* ============================== FÖRHANDLINGEN ============================== */
const forh = {
  name: 'Förhandlingen',
  model: 'finns (forhandlingen/intro-3d/lib.js)',
  build() { return makeStation().group; },
  zones: {
    A: { label: 'LAG A', side: 'A', cx: 0.05, cz: 1.35, w: 1.9, d: 1.9 },
    B: { label: 'LAG B', side: 'B', cx: 0.05, cz: -1.35, w: 1.9, d: 1.9 },
  },
  roles: {
    'A.sandebud': { zone: 'A', title: 'Sändebud', mic: true, headset: true, pattern: 'puls', slots: [[0, 0.78, 0, 0]] },
    'A.rapportor': { zone: 'A', title: 'Rapportör', headset: true, slots: [[0.5, 1.05, 0.1, 0.3], [-0.45, 1.3, -0.1, 0.3], [0.35, 1.65, 0, 0.3], [-0.4, 1.8, 0, 0.3], [0.45, 2.1, 0, 0.3]] },
    'B.sandebud': { zone: 'B', title: 'Sändebud', mic: true, headset: true, pattern: 'puls', slots: [[0, -0.78, 0, 0]] },
    'B.rapportor': { zone: 'B', title: 'Rapportör', headset: true, slots: [[0.5, -1.05, 0.1, -0.3], [-0.45, -1.3, -0.1, -0.3], [0.35, -1.65, 0, -0.3], [-0.4, -1.8, 0, -0.3], [0.45, -2.1, 0, -0.3]] },
  },
  arrival: { A: queue(1), B: queue(-1) },
  cam: { target: [0.1, 0.6, 0], r: 4.4, h: 5.6 },
};

/* ===================== MÄNNISKOTESTET / LÖGNDETEKTORN (delad) ===================== */
// Josef 2026-11-18: exakt samma station som Förhandlingen. Enda skillnaden: sida A har tre
// telefonlurar liggande på bänkskivan (Människotestet), sida B en gooseneck-XLR-mikrofon som
// sticker upp ur bänken (Lögndetektorn, turordning → kö bakom).
function buildMinne() {
  const g = makeStation().group;
  const BENCH = 1.05;
  // tre lurar (krämvita, som på .skp) liggande snett på A-bänken
  const matLur = M(0xeadfb8, { roughness: 0.55 });
  for (const x of [-0.15, 0, 0.15]) {
    const h = new THREE.Group(); h.position.set(x, BENCH + 0.02, 0.3); h.rotation.y = 0.55; g.add(h);
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.12, 4, 10), matLur);
    grip.rotation.x = Math.PI / 2; grip.castShadow = true; h.add(grip);
    for (const z of [0.085, -0.085]) {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.035, 14), matLur);
      e.position.set(0, 0.008, z); e.castShadow = true; h.add(e);
    }
  }
  // gooseneck-mikrofon ur B-bänken, böjd upp mot den som står vid den
  const fot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.02, 16), matDark);
  fot.position.set(0, BENCH + 0.01, -0.32); g.add(fot);
  const neck = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, BENCH + 0.01, -0.32), new THREE.Vector3(0, BENCH + 0.2, -0.33),
    new THREE.Vector3(0, BENCH + 0.36, -0.4), new THREE.Vector3(0, BENCH + 0.43, -0.5),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(neck, 24, 0.008, 8), M(0x3a3d42, { metalness: 0.5, roughness: 0.4 }));
  tube.castShadow = true; g.add(tube);
  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.09, 12), matDark);
  capsule.position.set(0, BENCH + 0.45, -0.54); capsule.rotation.x = Math.PI / 2 - 0.5; g.add(capsule);
  const ledring = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.003, 6, 16), new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 1 }));
  ledring.position.copy(capsule.position).add(new THREE.Vector3(0, 0.018, -0.03)); ledring.rotation.x = -0.5; g.add(ledring);
  // kö-markeringar på golvet bakom mikrofonplatsen (turordning)
  const matMark = new THREE.MeshBasicMaterial({ color: 0x8d9299, transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.19, 32), matMark);
    m.rotation.x = -Math.PI / 2; m.position.set(0.05, 0.004, -1.5 - i * 0.45); g.add(m);
  }
  return g;
}
const minne = {
  name: 'Människotestet / Lögndetektorn',
  model: 'finns — Förhandlingens station + 3 lurar (A) + gooseneck-mik (B), enligt Josef 2026-11-18',
  build: buildMinne,
  zones: {
    A: { label: 'MÄNNISKOTESTET', side: 'A', cx: 0.05, cz: 1.1, w: 1.9, d: 1.3 },
    B: { label: 'LÖGNDETEKTORN', side: 'B', cx: 0.05, cz: -1.55, w: 1.5, d: 2.5 },
  },
  roles: {
    'A.lur': { zone: 'A', title: 'Människotestet', prop: 'lur', max: 3, slots: [[-0.42, 0.8, -0.15, 0.3], [0, 0.86, 0, 0.3], [0.42, 0.8, 0.15, 0.3]] },
    'B.mikrofon': { zone: 'B', title: 'Vid mikrofonen', pattern: 'puls', slots: [[0, -0.85, 0, -0.5]] },
    'B.ko': { zone: 'B', title: 'I kö', slots: [[0.05, -1.5, 0, 0], [0.05, -1.95, 0, 0], [0.05, -2.4, 0, 0], [0.05, -2.85, 0, 0], [0.5, -2.85, 0, 0]] },
  },
  arrival: { A: queue(1), B: queue(-1) },
  cam: { target: [0.1, 0.6, -0.4], r: 4.8, h: 6.0 },
};

/* ============================== UNDERSÖKNINGEN ============================== */
// Efter Josefs .skp: vagn 0,90 hög, långsidan 0,46 (X) man står framför, 0,90 tvärs över (Z)
// mellan lagen. Kiosk med porthål (axel längs Z), sluttningar med skärm åt vardera lag.
// A = Labb (+Z, mikroskop), B = Fält (−Z, utökad skiva med avtryck).
function buildUnders() {
  const g = new THREE.Group();
  const W = 0.46, D = 0.9, H = 0.9;
  cart(g, W, D, H);
  box(g, 0.3, 0.3, 0.42, matDark, 0, 0.37, 0.02); // dator-låda
  // kiosk: hög låda med porthål (bygg av ramdelar runt hålet)
  const KZ = 0.1, BY0 = 1.16, BY1 = 1.5, PY = 1.33, PR = 0.085, BW = 0.5;
  box(g, BW, PY - PR - BY0, 2 * KZ, matPanel, 0, (BY0 + PY - PR) / 2, 0);
  box(g, BW, BY1 - PY - PR, 2 * KZ, matPanel, 0, (PY + PR + BY1) / 2, 0);
  for (const sx of [-1, 1]) { const w = BW / 2 - PR; box(g, w, 2 * PR, 2 * KZ, matPanel, sx * (PR + w / 2), PY, 0); }
  const glass = new THREE.Mesh(new THREE.CircleGeometry(PR, 28), matGlass); glass.position.y = PY; g.add(glass);
  // sluttningar (kilar) med skärm
  const SZ = 0.27;
  for (const sz of [-1, 1]) {
    const tri = new THREE.Shape();
    tri.moveTo(sz * KZ, H); tri.lineTo(sz * SZ, H); tri.lineTo(sz * KZ, BY0); tri.closePath();
    const geo = new THREE.ExtrudeGeometry(tri, { depth: BW - 0.004, bevelEnabled: false });
    const wedge = new THREE.Mesh(geo, matPanel);
    wedge.rotation.y = -Math.PI / 2; wedge.position.x = -(BW - 0.004) / 2; // shape-x → världs-z
    wedge.castShadow = wedge.receiveShadow = true; g.add(wedge);
    const ang = Math.atan2(BY0 - H, SZ - KZ);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.17), matScreen);
    scr.position.set(0, (H + BY0) / 2 + 0.01, sz * ((KZ + SZ) / 2 + 0.012));
    scr.rotation.set(sz > 0 ? -(Math.PI / 2 - Math.abs(ang)) : Math.PI / 2 - Math.abs(ang), sz > 0 ? 0 : Math.PI, 0);
    g.add(scr);
  }
  // FÄLT (−Z): utökad skiva, bred med avfasade ytterhörn, avtryck
  const IN = -SZ, OUT = -(D / 2) - 0.1, HX = 0.5, CH = 0.16, CHI = 0.07;
  const sh = new THREE.Shape();
  sh.moveTo(-HX + CHI, IN); sh.lineTo(-HX, IN - CHI); sh.lineTo(-HX, OUT + CH); sh.lineTo(-HX + CH, OUT);
  sh.lineTo(HX - CH, OUT); sh.lineTo(HX, OUT + CH); sh.lineTo(HX, IN - CHI); sh.lineTo(HX - CHI, IN); sh.closePath();
  const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.024, bevelEnabled: false });
  sg.rotateX(Math.PI / 2);
  const slab = new THREE.Mesh(sg, [M(0x2a2620), matTop]); slab.position.y = H + 0.024; slab.receiveShadow = true; g.add(slab);
  const matPrint = new THREE.MeshBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.35, depthWrite: false });
  for (const [x, z] of [[0.02, -0.42], [-0.28, -0.38], [0.3, -0.36], [-0.12, -0.5], [0.18, -0.52]]) {
    const p = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.022, 16), matPrint); p.rotation.x = -Math.PI / 2; p.position.set(x, H + 0.026, z); g.add(p);
  }
  // LABB (+Z): provskålar
  const matDish = new THREE.MeshStandardMaterial({ color: 0xbfd0ff, transparent: true, opacity: 0.4, roughness: 0.1 });
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 18), matDish);
    d.position.set(-0.15 + i * 0.1, H + 0.006, 0.37); g.add(d);
  }
  return g;
}
const unders = {
  name: 'Undersökningen',
  model: 'finns (undersokningen introScene.ts, efter .skp) — förenklad kopia här',
  build: buildUnders,
  zones: {
    A: { label: 'LABB', side: 'A', cx: 0.05, cz: 1.05, w: 1.9, d: 1.3 },
    B: { label: 'FÄLT', side: 'B', cx: 0.05, cz: -1.15, w: 1.9, d: 1.1 },
  },
  roles: {
    'A.labb': { zone: 'A', title: 'Labbtekniker', prop: 'mikroskop', slots: [[0, 0.75, 0, 0.37], [0.6, 0.95, 0.1, 0.37], [-0.6, 0.95, -0.1, 0.37], [0.3, 1.4, 0, 0.37], [-0.3, 1.45, 0, 0.37]] },
    // fältets operatörer står mot +Z: deras vänster = +X (nära kameran), höger = −X
    'B.lyspenna': { zone: 'B', title: 'Lyspenna', prop: 'lyspenna', slots: [[0.62, -0.9, 0.25, -0.4]] },
    'B.skannare': { zone: 'B', title: 'Skannare', prop: 'skanner', slots: [[-0.62, -0.9, -0.25, -0.4]] },
    'B.logg': { zone: 'B', title: 'Logggranskare', prop: 'logg', slots: [[0, -1.0, 0, -0.2], [0.3, -1.5, 0, -0.2]] },
  },
  arrival: { A: queue(1, 0.85), B: queue(-1, 0.95) },
  cam: { target: [0.1, 0.7, -0.05], r: 4.3, h: 6.6 }, // brantare: fältets vänster/höger ligger i djupled
};

/* ============================ REAKTORKÄRNAN ============================ */
// Efter stav-rorelsetest/pulsScene: vagn 0,6 (X) × 1,0 (Z), gavlar på kortsidorna, glaslåda
// emellan. Pulsvakt = +Z-kortsidan (pulsstången), Gyro = −Z-kortsidan (staven),
// Fälttekniker = långsidorna (±X, skruvhålen). Byggs i drift efter Borlänge.
function buildReaktor() {
  const g = new THREE.Group();
  const W = 0.6, D = 1.0, H = 0.88, GH = 0.72, GT = 0.18, BY = H + 0.015;
  cart(g, W, D, H, { shelves: [0.25, 0.55] });
  for (const sz of [-1, 1]) box(g, W, GH, GT, matPanel, 0, BY + GH / 2, sz * (D / 2 - GT / 2));
  const inner = D - 2 * GT;
  for (const sx of [-1, 1]) box(g, 0.02, 0.42, inner, matPanel, sx * (W / 2 - 0.01), BY + 0.21, 0);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.26, inner), matGlass); gl.position.set(0, BY + 0.55, 0); g.add(gl);
  // pulsstången (liggande i +Z-gaveln)
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, W - 0.24, 14), M(0xd8d8d8, { roughness: 0.4 }));
  bar.rotation.z = Math.PI / 2; bar.position.set(0, BY + 0.31, D / 2 + 0.02); g.add(bar);
  // skruvhål på långsidorna
  for (const sx of [-1, 1]) for (const z of [-0.18, 0, 0.18]) {
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), matDark);
    h.rotation.y = sx * Math.PI / 2; h.position.set(sx * (W / 2 + 0.001), BY + 0.25, z); g.add(h);
  }
  // gyrostaven framför −Z-kortsidan (hålls av gyro-personerna)
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 12), M(0xd8d8d8, { roughness: 0.4 }));
  staff.rotation.z = Math.PI / 2; staff.position.set(0, 1.05, -D / 2 - 0.42); g.add(staff);
  return g;
}
const reaktor = {
  name: 'Reaktorkärnan',
  model: 'finns (stresstestet stav/pulsScene.ts + stav-rorelsetest) — förenklad kopia här',
  build: buildReaktor,
  zones: {
    puls: { label: 'PULSVAKT', side: 'A', cx: 0.05, cz: 1.25, w: 1.4, d: 1.0 },
    gyro: { label: 'GYRO', side: 'B', cx: 0.05, cz: -1.3, w: 1.6, d: 1.0 },
    falt: { label: 'FÄLTTEKNIKER', side: '', cx: 0, cz: 0, w: 2.3, d: 0.9, around: true },
  },
  roles: {
    puls: { zone: 'puls', title: 'Pulsvakt', prop: 'puls', max: 2, slots: [[0, 1.08, 0, 0.5], [0.5, 1.3, 0, 0.5]] },
    gyro: { zone: 'gyro', title: 'Gyro', prop: 'gyro', max: 2, slots: [[0.62, -0.92, 0, -0.92], [-0.62, -0.92, 0, -0.92]] },
    falt: { zone: 'falt', title: 'Fälttekniker', prop: 'skruv', max: 2, slots: [[0.78, 0, 0, 0], [-0.78, 0, 0, 0]] },
  },
  arrival: { A: queue(1, 1.05), B: queue(-1, 1.15) },
  cam: { target: [0.05, 0.6, 0], r: 4.6, h: 5.8 },
};

export const STATIONS = { forh, minne, unders, reaktor };
export const STATION_ALIAS = {
  forhandlingen: 'forh', '1': 'forh', st1: 'forh',
  minnestest: 'minne', manniskotest: 'minne', '2': 'minne', st2: 'minne',
  undersokningen: 'unders', '3': 'unders', st3: 'unders',
  reaktorkarnan: 'reaktor', stresstest: 'reaktor', stresstestet: 'reaktor', '4': 'reaktor', st4: 'reaktor',
};

/* ------------------------------ rekvisita ------------------------------ */
// Byggs i lokala koordinater för höger hand (handen = origo, armen pekar −Y).
export function makeProp(kind) {
  const g = new THREE.Group();
  const glow = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4 });
  const body = M(0x30333a, { roughness: 0.5 });
  if (kind === 'lyspenna' || kind === 'mikroskop') {
    const len = kind === 'lyspenna' ? 0.16 : 0.15, r = kind === 'lyspenna' ? 0.012 : 0.02;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 10), body); c.position.y = -len / 2; g.add(c);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 1.2, 10, 8), glow(kind === 'lyspenna' ? 0x9b6cff : 0xffffff)); tip.position.y = -len; g.add(tip);
  } else if (kind === 'skanner') {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.11, 8), body); grip.position.y = -0.05; g.add(grip);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.06), body); head.position.set(0, -0.12, 0.02); g.add(head);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, 0.04), glow(0xffffff)); win.position.set(0, -0.145, 0.02); g.add(win);
  } else if (kind === 'logg') {
    const slate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.22), body); slate.position.set(0, -0.04, 0.06); slate.rotation.x = 0.5; g.add(slate);
    const lines = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), glow(0x8d9299)); lines.position.set(0, -0.032, 0.06); lines.rotation.x = 0.5 - Math.PI / 2; g.add(lines);
  } else if (kind === 'lur') {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.03), body); h.position.y = -0.04; g.add(h);
    for (const y of [0.04, -0.12]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.04), body); e.position.set(0, y, 0.015); g.add(e); }
  } else if (kind === 'skruv') {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 8), M(0xffd23f)); h.position.y = -0.04; g.add(h);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), M(0xb9bdc3, { metalness: 0.5 })); s.position.y = -0.125; g.add(s);
  }
  return g;
}
/** Armvinkel för rekvisitan: [höger x, höger z, vänster x, vänster z] (rotation på axel-pivån). */
export const PROP_POSE = {
  lyspenna: [-1.0, 0.15, 0, 0.08], mikroskop: [-1.0, 0.15, 0, 0.08], skanner: [-0.95, 0.1, 0, 0.08],
  logg: [-0.8, 0.25, -0.6, -0.3], lur: [-2.4, -0.45, 0, 0.08], skruv: [-1.1, 0.1, 0, 0.08],
  puls: [-1.15, -0.15, -1.15, 0.15], gyro: [-1.2, -0.25, -1.2, 0.25],
};
