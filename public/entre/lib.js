// Förhandlingen intro-3D — delad scaffold för alla scener.
// three.js r0.160 via importmap (se scenernas <head>). Mått i meter (cm/100).
// Sida A = Z>0, sida B = Z<0 (speglad över mellanväggen). Kopia av forhandlingen/intro-3d/lib.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
export { THREE };

// ---------- Palett ----------
export const PAL = {
  bg: 0x141518, floor: 0x222327, grid: 0x2c2e33,
  wall: 0x3a3d42, wallEdge: 0x8d9299, seam: 0x15161a,
  frame: 0xb9bdc3, panel: 0x4a4e55, door: 0x565b63, top: 0x2a2c30,
  valdi: 0x1fbf6b, amber: 0xffb347, crt: 0xffb000, crtBg: 0x0c0d0b,
  rapportor: 0xf0f0f0, sandebud: 0xffd23f, headset: 0x2b2e34, cup: 0x3d4148,
};

export const clamp01 = x => Math.min(1, Math.max(0, x));
export const ramp = (t, a, b) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });

// ---------- Stationen ----------
// Mått (spegla mot SketchUp-bilderna 1–5):
export const DIM = {
  wallH: 1.90, wallW: 1.55, wallT: 0.05, chamfer: 0.20,
  doorHalf: 0.24, doorTop: 1.80,          // genomgående öppning i väggen där konsolen står
  podW: 0.46, podD: 0.45,                  // konsolens bredd, djup ut från väggen per sida
  bench: 1.05,                             // bänkyta
  valdiY0: 1.30, valdiY1: 1.62, valdiY: 1.46, valdiR: 0.09, valdiD: 0.12,
  tilt: 30 * Math.PI / 180,                // skärmens lutning från lodrätt
  scrW: 0.33, scrH: 0.20,
};

export function makeStation({ screenTex = {} } = {}) {
  const D = DIM;
  const g = new THREE.Group();
  g.name = 'station';
  const matWall = M(PAL.wall, { roughness: 0.95 });
  const matEdge = M(PAL.wallEdge, { roughness: 0.9 });
  const matFrame = M(PAL.frame, { roughness: 0.6, metalness: 0.2 });
  const matPanel = M(PAL.panel);
  const matDoor = M(PAL.door);
  const matTop = M(PAL.top, { roughness: 0.7 });
  const box = (w, h, d, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };

  // --- Mellanväggen: "hus-form" med avfasade hörn + genomgående öppning för konsolen ---
  const hw = D.wallW / 2, c = D.chamfer;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(-hw, D.wallH - c); s.lineTo(-hw + c, D.wallH);
  s.lineTo(hw - c, D.wallH); s.lineTo(hw, D.wallH - c); s.lineTo(hw, 0);
  s.lineTo(D.doorHalf, 0); s.lineTo(D.doorHalf, D.doorTop); s.lineTo(-D.doorHalf, D.doorTop);
  s.lineTo(-D.doorHalf, 0); s.lineTo(-hw, 0);
  const wg = new THREE.ExtrudeGeometry(s, { depth: D.wallT, bevelEnabled: false });
  wg.translate(0, 0, -D.wallT / 2);
  const wall = new THREE.Mesh(wg, [matWall, matEdge]);   // grupp 0 = ytor, 1 = kanter (ljusa som i SketchUp)
  wall.castShadow = wall.receiveShadow = true;
  g.add(wall);
  // synlig vertikal mittskarv ovanför öppningen (båda ytor)
  const matSeam = new THREE.MeshBasicMaterial({ color: PAL.seam });
  for (const sz of [1, -1]) box(0.006, D.wallH - D.doorTop, 0.002, matSeam, 0, (D.wallH + D.doorTop) / 2, sz * (D.wallT / 2 + 0.001)).castShadow = false;

  // --- Delad mittdel i öppningen: Valdi-låda, igentäppt panel, ljus ram ---
  const vd = D.valdiD;
  // Valdi-front med runt hål (båda sidor)
  const fs = new THREE.Shape();
  fs.moveTo(-D.podW / 2, D.valdiY0); fs.lineTo(D.podW / 2, D.valdiY0); fs.lineTo(D.podW / 2, D.valdiY1); fs.lineTo(-D.podW / 2, D.valdiY1); fs.lineTo(-D.podW / 2, D.valdiY0);
  const hole = new THREE.Path(); hole.absarc(0, D.valdiY, D.valdiR, 0, Math.PI * 2, true); fs.holes.push(hole);
  const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.012, bevelEnabled: false, curveSegments: 40 });
  for (const sz of [1, -1]) {
    const f = new THREE.Mesh(fg, matPanel);
    f.position.z = sz > 0 ? vd - 0.012 : -vd;
    f.castShadow = f.receiveShadow = true; g.add(f);
    // bezel runt hålet
    const bz = new THREE.Mesh(new THREE.TorusGeometry(D.valdiR + 0.008, 0.009, 10, 48), M(0x2a2d31, { roughness: 0.4, metalness: 0.4 }));
    bz.position.set(0, D.valdiY, sz * vd); g.add(bz);
  }
  // sidor/botten/topp på Valdi-lådan
  box(0.012, D.valdiY1 - D.valdiY0, 2 * vd, matPanel, -D.podW / 2 + 0.006, (D.valdiY0 + D.valdiY1) / 2, 0);
  box(0.012, D.valdiY1 - D.valdiY0, 2 * vd, matPanel, D.podW / 2 - 0.006, (D.valdiY0 + D.valdiY1) / 2, 0);
  // Valdi-hålet: genomgående rör med diskret grön glow + svagt inre ljus
  const matValdi = new THREE.MeshStandardMaterial({ color: 0x06150d, emissive: PAL.valdi, emissiveIntensity: 0.07, roughness: 0.9, side: THREE.BackSide });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(D.valdiR, D.valdiR, 2 * vd, 40, 1, true), matValdi);
  tube.rotation.x = Math.PI / 2; tube.position.set(0, D.valdiY, 0); g.add(tube);
  const vl = new THREE.PointLight(PAL.valdi, 0.05, 0.5, 2); vl.position.set(0, D.valdiY, 0); g.add(vl);
  // IGENTÄPPT fyrkantshål ovanför Valdi: hel panel i frontmaterialet
  box(D.podW, D.doorTop - D.valdiY1, 2 * vd, matPanel, 0, (D.doorTop + D.valdiY1) / 2, 0);
  // ljus ram runt mittdelen (som i bilderna)
  for (const sx of [-1, 1]) box(0.02, D.doorTop - D.bench, 2 * vd + 0.01, matFrame, sx * (D.podW / 2 + 0.01), (D.doorTop + D.bench) / 2, 0);
  box(D.podW + 0.04, 0.02, 2 * vd + 0.01, matFrame, 0, D.valdiY1, 0);
  // central bärande skiva under bänken (syns mellan benen)
  box(D.podW - 0.12, D.bench - 0.06, 0.12, matPanel, 0, (D.bench - 0.06) / 2, 0);

  // --- Per sida: bygg A, spegla till B ---
  const screens = {};
  for (const [side, sz] of [['A', 1], ['B', -1]]) {
    const p = new THREE.Group(); p.name = 'pod' + side; p.scale.z = sz; g.add(p);
    const b = (w, h, d, mat, x, y, z) => box(w, h, d, mat, x, y, z, p);
    const W = D.podW + 0.04, Dd = D.podD;
    // bänkskiva + ljus kant
    b(W, 0.03, Dd, matTop, 0, D.bench - 0.015, Dd / 2);
    b(W, 0.025, Dd, matFrame, 0, D.bench - 0.0425, Dd / 2);
    // fyra smala ben (två ytterben per sida, två vid väggen)
    for (const sx of [-1, 1]) for (const z of [Dd - 0.025, 0.07]) b(0.035, D.bench - 0.055, 0.035, matFrame, sx * (W / 2 - 0.02), (D.bench - 0.055) / 2, z);
    // nedre ram + mellanhylla
    b(W - 0.02, 0.03, 0.03, matFrame, 0, 0.25, Dd - 0.025);
    for (const sx of [-1, 1]) b(0.03, 0.03, Dd - 0.06, matFrame, sx * (W / 2 - 0.02), 0.25, Dd / 2 + 0.02);
    b(W - 0.06, 0.02, Dd - 0.1, matTop, 0, 0.55, Dd / 2 + 0.02);
    // slutet skåp under bänken med inskjuten lucka
    b(W - 0.08, 0.30, Dd - 0.14, matPanel, 0, 0.78, Dd / 2 + 0.01);
    b(W - 0.16, 0.24, 0.01, matDoor, 0, 0.78, Dd - 0.055);
    // lutad skärm-hus (30° från lodrätt), vänd utåt
    const zT = vd, yT = D.valdiY0, yB = D.bench, zB = zT + (yT - yB) * Math.tan(D.tilt);
    const ps = new THREE.Shape();
    ps.moveTo(zT - 0.02, yB); ps.lineTo(zB, yB); ps.lineTo(zT, yT); ps.lineTo(zT - 0.02, yT); ps.lineTo(zT - 0.02, yB);
    const hg = new THREE.ExtrudeGeometry(ps, { depth: D.podW, bevelEnabled: false });
    hg.rotateY(-Math.PI / 2); hg.translate(D.podW / 2, 0, 0);
    const house = new THREE.Mesh(hg, matPanel); house.castShadow = house.receiveShadow = true; p.add(house);
    // själva skärmen (plane på lutningen). Scen 1: canvas-UI. Scen 2+: CSS3D-iframe läggs på samma pose.
    const midZ = (zT + zB) / 2, midY = (yT + yB) / 2;
    const n = V(0, Math.sin(D.tilt), Math.cos(D.tilt));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(D.scrW, D.scrH),
      new THREE.MeshBasicMaterial({ color: 0xffffff, map: screenTex[side] || null, toneMapped: false }));
    scr.position.set(0, midY, midZ).addScaledVector(n, 0.0015);
    scr.rotation.x = -D.tilt;
    if (!screenTex[side]) scr.material.color.set(0x05060a);
    p.add(scr);
    // ram runt skärmen
    const bez = new THREE.Mesh(new THREE.PlaneGeometry(D.scrW + 0.03, D.scrH + 0.03), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.5 }));
    bez.position.copy(scr.position).addScaledVector(n, -0.0008); bez.rotation.x = -D.tilt; p.add(bez);
    if (sz < 0) { scr.scale.x = -1; } // läsbar text även på speglade sidan
    screens[side] = { mesh: scr, group: p };
  }
  return { group: g, screens, valdiLight: vl, valdiMat: matValdi };
}

// Världspose för en skärm (för kamera-mål och CSS3D-placering).
export function screenPose(screen) {
  screen.mesh.updateWorldMatrix(true, false);
  const pos = new THREE.Vector3().setFromMatrixPosition(screen.mesh.matrixWorld);
  const sz = screen.group.scale.z; // +1 sida A, −1 sida B
  const normal = new THREE.Vector3(0, Math.sin(DIM.tilt), sz * Math.cos(DIM.tilt));
  return { pos, normal };
}

// Enkelt canvas-UI (scen 1, där skärmen bara är liten i bild). Riktigt UI = CSS3D från scen 2.
export function makeScreenTexture(title) {
  const cv = document.createElement('canvas'); cv.width = 660; cv.height = 400;
  const x = cv.getContext('2d');
  x.fillStyle = '#0c0d0b'; x.fillRect(0, 0, 660, 400);
  x.strokeStyle = '#ffb000'; x.lineWidth = 4; x.strokeRect(14, 14, 632, 372);
  x.fillStyle = '#ffb000'; x.font = 'bold 34px ui-monospace, Menlo, monospace'; x.textAlign = 'center';
  x.fillText(title, 330, 70);
  x.font = '54px system-ui'; ['💉', '🔋', '🎛️', '📡', '💧'].forEach((e, i) => x.fillText(e, 90 + i * 120, 330));
  x.beginPath(); x.arc(330, 185, 62, 0, Math.PI * 2); x.stroke();
  x.font = '74px system-ui'; x.fillText('🔋', 330, 210);
  for (let y = 0; y < 400; y += 4) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, y, 660, 2); } // CRT-linjer
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------- Gubbe ----------
// makeGubbe(color, {mic}) → { group, setGlow(0..1), setSpeaking(bool), setDim(0..1), gesture (0..1), update(t) }
export function makeGubbe(color, { mic = false } = {}) {
  const g = new THREE.Group();
  const base = new THREE.Color(color);
  const body = M(color, { roughness: 0.7, emissive: color, emissiveIntensity: 0 });
  const hs = M(PAL.headset, { roughness: 0.5, metalness: 0.3 });
  const cup = M(PAL.cup, { roughness: 0.5, metalness: 0.2 });
  const stripe = M(color, { roughness: 0.5 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: PAL.amber, emissiveIntensity: 0.4 });
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  // ben, bål, huvud (höjd ~1,75 inkl. headset)
  for (const sx of [-1, 1]) add(new THREE.CapsuleGeometry(0.058, 0.72, 4, 10), body, sx * 0.08, 0.43, 0);
  add(new THREE.CapsuleGeometry(0.135, 0.38, 6, 14), body, 0, 1.17, 0).scale.set(1, 1, 0.62);
  add(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 10), body, 0, 1.48, 0);
  const head = new THREE.Group(); head.position.set(0, 1.61, 0); g.add(head);
  add(new THREE.SphereGeometry(0.105, 20, 16), body, 0, 0, 0, head);
  // armar (axel-pivå, hänger ner)
  const arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.18, 1.40, 0); g.add(piv);
    add(new THREE.CapsuleGeometry(0.04, 0.50, 4, 10), body, 0, -0.29, 0, piv);
    piv.rotation.z = sx * 0.08; arms.push(piv);
  }
  // headset: bygel + två tjocka öronkåpor (alla bär)
  const band = add(new THREE.TorusGeometry(0.122, 0.014, 8, 28, Math.PI), hs, 0, 0.01, 0, head);
  band.rotation.y = 0;
  for (const sx of [-1, 1]) {
    const c = add(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 20), cup, sx * 0.118, 0, 0, head);
    c.rotation.z = Math.PI / 2;
    // rollmarkering: rand i gubbens färg runt kåpan (som den fysiska tejpen på headseten)
    const r = add(new THREE.TorusGeometry(0.047, 0.007, 8, 28), stripe, sx * 0.142, 0, 0, head);
    r.rotation.y = Math.PI / 2;
  }
  // rand längs bygeln
  const bs = add(new THREE.TorusGeometry(0.134, 0.0045, 6, 28, Math.PI * 0.5), stripe, 0, 0.01, 0, head);
  bs.rotation.z = Math.PI * 0.25;
  // mik-bom (bara sändebud)
  let tip = null;
  if (mic) {
    const curve = new THREE.CatmullRomCurve3([V(0.13, -0.01, 0.01), V(0.12, -0.06, 0.07), V(0.07, -0.075, 0.115), V(0.03, -0.07, 0.125)]);
    add(new THREE.TubeGeometry(curve, 20, 0.006, 6), hs, 0, 0, 0, head);
    tip = add(new THREE.SphereGeometry(0.016, 12, 10), tipMat, 0.03, -0.07, 0.125, head);
  }
  // ström ur munnen (setSpeaking): ringar som vandrar framåt och tonar ut
  const stream = new THREE.Group(); stream.position.set(0, -0.06, 0.11); head.add(stream);
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.009, 6, 24),
      new THREE.MeshBasicMaterial({ color: PAL.amber, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    stream.add(m); rings.push(m);
  }
  // glow-ring på golvet (syns bra snett uppifrån)
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.30, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.006; g.add(halo);

  const st = { glow: 0, dim: 0, speaking: 0, speakingTarget: 0, gesture: 0, nod: 0 };
  const api = {
    group: g, head, arms, isGubbe: true,
    setGlow(v) { st.glow = clamp01(v); },
    setDim(v) { st.dim = clamp01(v); },
    setSpeaking(b) { st.speakingTarget = b ? 1 : 0; },
    set gesture(v) { st.gesture = v; }, get gesture() { return st.gesture; },
    set nod(v) { st.nod = v; }, get nod() { return st.nod; },
    update(t, dt = 1 / 60) {
      st.speaking += (st.speakingTarget - st.speaking) * Math.min(1, dt * 12);
      const glow = Math.max(st.glow, st.speaking);
      const lit = 1 - 0.72 * st.dim;
      body.color.copy(base).multiplyScalar(lit);
      body.emissiveIntensity = glow * 0.45 * lit;
      hs.color.set(PAL.headset).multiplyScalar(lit); cup.color.set(PAL.cup).multiplyScalar(lit); stripe.color.copy(base).multiplyScalar(lit);
      halo.material.opacity = glow * 0.85 * lit;
      if (tip) tipMat.emissiveIntensity = (0.3 + glow * (1.6 + 1.2 * Math.sin(t * 7))) * lit + st.speaking * 2;
      // liten gest: höger arm upp/fram, lätt huvudnick
      arms[1].rotation.x = -st.gesture * (0.9 + 0.25 * Math.sin(t * 3.1));
      arms[1].rotation.z = 0.08 + st.gesture * 0.25;
      head.rotation.x = st.nod * 0.12 * Math.sin(t * 2.4) + st.speaking * 0.05 * Math.sin(t * 9);
      // ström
      rings.forEach((r, i) => {
        const ph = (t * 1.6 + i / rings.length) % 1;
        r.position.z = ph * 0.3;
        r.scale.setScalar(0.6 + ph * 1.8);
        r.material.opacity = st.speaking * (1 - ph) * 0.9;
      });
    },
  };
  return api;
}

// global dim(obj, 0..1): gubbe → setDim, annat → mörka materialen
export function dim(obj, v) {
  if (obj && obj.isGubbe) return obj.setDim(v);
  const o = obj.group || obj;
  o.traverse(m => {
    if (!m.isMesh) return;
    for (const mat of [].concat(m.material)) {
      if (!mat.color || mat.isMeshBasicMaterial) continue;
      mat.userData.base ??= mat.color.clone();
      mat.color.copy(mat.userData.base).multiplyScalar(1 - 0.6 * v);
    }
  });
}

// ---------- Kamerarigg ----------
// tweenCamera([{at, pos:[x,y,z], look:[x,y,z], fov?, via?:[x,y,z]}]) → (t) => {pos, look, fov}
// Mjuk (smoothstep) mellan på varandra följande nycklar; `via` = kontrollpunkt (båge) för segmentet IN till nyckeln.
export function tweenCamera(keys) {
  const K = keys.map(k => ({ ...k, pos: V(...k.pos), look: V(...k.look), via: k.via && V(...k.via), fov: k.fov ?? 40 }));
  const out = { pos: V(0, 0, 0), look: V(0, 0, 0), fov: 40 };
  return t => {
    let i = K.findIndex(k => k.at > t);
    if (i === -1) i = K.length;
    if (i === 0) { out.pos.copy(K[0].pos); out.look.copy(K[0].look); out.fov = K[0].fov; return out; }
    if (i === K.length) { const k = K[i - 1]; out.pos.copy(k.pos); out.look.copy(k.look); out.fov = k.fov; return out; }
    const a = K[i - 1], b = K[i], u = ramp(t, a.at, b.at);
    if (b.via) { // kvadratisk bezier
      const p = a.pos.clone().multiplyScalar((1 - u) ** 2).addScaledVector(b.via, 2 * u * (1 - u)).addScaledVector(b.pos, u * u);
      out.pos.copy(p);
    } else out.pos.lerpVectors(a.pos, b.pos, u);
    out.look.lerpVectors(a.look, b.look, u);
    out.fov = a.fov + (b.fov - a.fov) * u;
    return out;
  };
}

// timeline([{at, do}]) → update(t). Cues ska vara "sätt-tillstånd" (idempotenta):
// går tiden bakåt (loop / ?t=) spelas alla cues ≤ t om från början.
export function timeline(cues) {
  const C = [...cues].sort((a, b) => a.at - b.at);
  let last = -Infinity, idx = 0;
  return t => {
    if (t < last) idx = 0;
    while (idx < C.length && C[idx].at <= t) C[idx++].do();
    last = t;
  };
}

// ---------- Scen-ram: renderer, ljus, golv, ?spela-in, ?t=, orbit-övertagning, fade ----------
// css3d: true → riktigt webb-UI (iframe) på skärmarna via CSS3DRenderer under en genomskinlig WebGL-canvas.
// Inspelning blir då skärminspelning av fliken (getDisplayMedia) — canvas.captureStream ser inte DOM-lagret.
export function createStage({ name, loop, warm = 1, camera: camFn, css3d = false }) {
  const qs = new URLSearchParams(location.search);
  const REC = qs.has('spela-in');
  const FREEZE = parseFloat(qs.get('t'));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: css3d });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.body.appendChild(renderer.domElement);
  let cssRenderer = null; const cssScene = new THREE.Scene();
  if (css3d) {
    cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(innerWidth, innerHeight);
    Object.assign(cssRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', zIndex: '0', pointerEvents: 'none' });
    Object.assign(renderer.domElement.style, { position: 'absolute', top: '0', left: '0', zIndex: '1' });
    document.body.appendChild(cssRenderer.domElement);
  }
  const REC_CANVAS = REC && !css3d;
  if (REC_CANVAS) {
    renderer.setPixelRatio(1);
    renderer.setSize(1920, 1080, false);
    Object.assign(renderer.domElement.style, { width: '100vw', height: '56.25vw', maxHeight: '100vh', maxWidth: '177.78vh', margin: 'auto' });
    document.body.style.display = 'flex';
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.bg);
  scene.fog = new THREE.Fog(PAL.bg, 7, 16);
  const camera = new THREE.PerspectiveCamera(40, REC_CANVAS ? 16 / 9 : innerWidth / innerHeight, 0.02, 100);
  scene.add(camera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  if (REC) controls.enabled = false;
  let userUntil = 0;
  controls.addEventListener('start', () => { userUntil = Infinity; });
  controls.addEventListener('end', () => { userUntil = performance.now() + 4000; });

  // ljus: varm, lite CRT/amber-ton
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x1a1712, 0.9));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.6);
  key.position.set(2.6, 5, 2.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 1, far: 14 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb066, 0.6); rim.position.set(-3, 2.5, -2.5); scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), M(PAL.floor, { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(40, 80, PAL.grid, PAL.grid); grid.position.y = 0.001; scene.add(grid);

  // fade till svart (ritas i WebGL så den kommer med i inspelningen)
  const fadeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), fadeMat);
  fadeQuad.position.z = -0.1; fadeQuad.renderOrder = 999; camera.add(fadeQuad);

  // inspelning: spelar in exakt ett varv efter `warm` s uppvärmning
  let recState = REC ? (css3d ? 'click' : 'warm') : 'off', recorder = null, displayStream = null, lastT = 0;
  const recStatus = document.createElement('div');
  Object.assign(recStatus.style, { position: 'fixed', top: '12px', left: '12px', font: '14px ui-monospace, Menlo, monospace', color: '#ff9500', background: 'rgba(0,0,0,.6)', padding: '6px 10px', borderRadius: '6px', display: REC ? 'block' : 'none' });
  recStatus.textContent = `Värmer upp (${warm} s)…`;
  Object.assign(recStatus.style, { zIndex: '10' });
  document.body.appendChild(recStatus);
  if (REC && css3d) {
    recStatus.innerHTML = 'Skärminspelning: gör fönstret 16:9 (t.ex. helskärm), klicka sen här och välj <b>den här fliken</b>.';
    recStatus.style.cursor = 'pointer'; recStatus.style.pointerEvents = 'auto';
    recStatus.onclick = async () => {
      if (recState !== 'click') return;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
        recState = 'armed'; recStatus.style.display = 'none'; // dölj innan nästa varv börjar
      } catch (e) { recStatus.textContent = 'Inspelning avbruten: ' + e.message; }
    };
  }
  function startRecorder(stream) {
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mimeType = types.find(t => MediaRecorder.isTypeSupported(t));
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12e6 });
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
      a.download = `${name}.${ext}`; a.click();
      displayStream?.getTracks().forEach(tr => tr.stop());
      recStatus.style.display = 'block';
      recStatus.textContent = `Klart: ${name}.${ext} (${loop.toFixed(2)} s) nedladdad`;
    };
    recorder.start();
  }
  function recTickDisplay(t) {
    const wrapped = t < lastT; lastT = t;
    if (recState === 'armed' && wrapped) { startRecorder(displayStream); recState = 'rec'; }
    else if (recState === 'rec' && wrapped) { recorder.stop(); recState = 'done'; }
  }
  function recTick(elapsed) {
    if (recState === 'off' || css3d) return;
    const i = Math.floor(elapsed / loop);
    if (recState === 'warm' && i >= 1) {
      const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
      const mimeType = types.find(t => MediaRecorder.isTypeSupported(t));
      const chunks = [];
      recorder = new MediaRecorder(renderer.domElement.captureStream(60), { mimeType, videoBitsPerSecond: 12e6 });
      recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        a.download = `${name}.${ext}`; a.click();
        recStatus.textContent = `Klart: ${name}.${ext} (${loop.toFixed(2)} s) nedladdad`;
      };
      recorder.start(); recState = 'rec';
      recStatus.textContent = `● Spelar in (${loop.toFixed(2)} s)…`;
    } else if (recState === 'rec' && i >= 2) { recorder.stop(); recState = 'done'; }
  }

  const stage = {
    THREE, scene, cssScene, camera, renderer, controls, REC, FREEZE,
    setFade(v) { fadeMat.opacity = clamp01(v); },
    start(onFrame) {
      const clock = new THREE.Clock();
      let first = true;
      renderer.setAnimationLoop(() => {
        const dt = Math.min(clock.getDelta(), 0.05);
        const el = clock.elapsedTime + (REC_CANVAS ? loop - warm : 0);
        const t = isNaN(FREEZE) ? el % loop : FREEZE;
        onFrame(t, dt);
        if (camFn && performance.now() > userUntil) {
          const c = camFn(t);
          // nytt varv / frysläge / första bilden: placera direkt (rent klipp); annars mjuk följning
          const k = (first || !isNaN(FREEZE) || t < 0.05) ? 1 : 1 - Math.exp(-dt * 12);
          camera.position.lerp(c.pos, k);
          controls.target.lerp(c.look, k);
          if (Math.abs(camera.fov - c.fov) > 1e-3) { camera.fov += (c.fov - camera.fov) * k; camera.updateProjectionMatrix(); }
          first = false;
        }
        controls.update();
        renderer.render(scene, camera);
        if (cssRenderer) cssRenderer.render(cssScene, camera);
        recTick(el);
        if (css3d && REC) recTickDisplay(t);
      });
    },
  };
  addEventListener('resize', () => {
    if (REC_CANVAS) return;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    cssRenderer?.setSize(innerWidth, innerHeight);
  });
  window.__stage = stage; // felsökning
  return stage;
}

// ---------- Riktigt UI på skärmen (CSS3D-iframe) ----------
// Lägger appens skärmsida (intro3d-skarm.html) som iframe exakt på skärm-planet och stansar
// ett genomskinligt hål i WebGL-canvasen där (djuptestat → saker framför skärmen skymmer korrekt).
// Appens adress: ?app=http://localhost:5177 (default). Returnerar { iframe, setState(s) }.
export const APP_URL = new URLSearchParams(location.search).get('app') || 'http://localhost:5177';
export function addScreenIframe(stage, station, side, { team, state = 'idle', px = 1100 } = {}) {
  const scr = station.screens[side];
  const iframe = document.createElement('iframe');
  iframe.src = `${APP_URL}/intro3d-skarm.html?team=${team}&state=${state}`;
  const pxH = Math.round(px * DIM.scrH / DIM.scrW);
  Object.assign(iframe.style, { width: px + 'px', height: pxH + 'px', border: '0', background: '#0c0d0b' });
  const obj = new CSS3DObject(iframe);
  const { pos, normal } = screenPose(scr);
  obj.position.copy(pos);
  obj.lookAt(pos.clone().add(normal));
  obj.scale.setScalar(DIM.scrW / px);
  stage.cssScene.add(obj);
  // hål i canvasen
  scr.mesh.material = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, transparent: false, blending: THREE.NoBlending });
  let cur = state;
  const setState = s => {
    if (s === cur) return; cur = s;
    iframe.contentWindow?.postMessage({ type: 'xy-intro3d', state: s }, '*');
  };
  iframe.addEventListener('load', () => iframe.contentWindow?.postMessage({ type: 'xy-intro3d', state: cur }, '*'));
  return { iframe, object: obj, setState };
}

// ---------- Rollbesättning: 3 gubbar per sida i grund båge (r≈0,7) runt skärmen ----------
// Sida A sett framifrån: Rapportör vänster (vit), Sändebud 2 mitten/höger, Sändebud 1 längst höger (gula, mik).
// Sida B = spegling över väggen. Returnerar { A:{rapportor,sandebud1,sandebud2}, B:{…}, sandebud:[4], rapportor:[2], all:[6] }.
export const SCREEN_CENTER = { y: 1.17, z: 0.19 };
export function makeCast(scene) {
  const SLOTS = [
    { role: 'rapportor', ang: -50, r: 0.76 },
    { role: 'sandebud2', ang: 8, r: 0.70 },
    { role: 'sandebud1', ang: 54, r: 0.74 },
  ];
  const cast = { sandebud: [], rapportor: [], all: [] };
  for (const [side, sz] of [['A', 1], ['B', -1]]) {
    cast[side] = {};
    for (const s of SLOTS) {
      const isSand = s.role !== 'rapportor';
      const f = makeGubbe(isSand ? PAL.sandebud : PAL.rapportor, { mic: isSand });
      const a = s.ang * Math.PI / 180;
      f.group.position.set(Math.sin(a) * s.r, 0, sz * (SCREEN_CENTER.z + Math.cos(a) * s.r));
      f.group.lookAt(0, 0, sz * SCREEN_CENTER.z);
      f.side = side; f.role = s.role;
      scene.add(f.group);
      cast[side][s.role] = f;
      (isSand ? cast.sandebud : cast.rapportor).push(f);
      cast.all.push(f);
    }
  }
  return cast;
}
