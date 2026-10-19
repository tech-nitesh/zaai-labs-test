/* =========================================================
   ZAAI LABS — Three.js scene
   Neural-industrial core (wireframe AI sphere ⇄ industrial gear),
   particle field, holographic grid floor, mouse + scroll camera.
   ========================================================= */
import * as THREE from 'three';

const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// Shared morph logic (sphere -> gear) used by wireframe + node points
const MORPH_GLSL = /* glsl */ `
uniform float uTime; uniform float uMorph;
vec3 morphPos(vec3 pIn, out float nz){
  vec3 n = normalize(pIn);
  nz = snoise(n * 1.7 + vec3(uTime * 0.22));
  vec3 sphere = n * (1.6 + nz * 0.17);

  // Industrial gear facing the camera (XY plane)
  float ang = atan(n.y, n.x);
  float rxy = length(n.xy);
  float teeth = 14.0;
  float tooth = smoothstep(0.32, 0.68, 0.5 + 0.5 * cos(ang * teeth));
  float R = 1.5 + 0.3 * tooth;
  float rh = mix(0.5, R, smoothstep(0.05, 0.85, rxy));
  vec2 dir = rxy > 0.0001 ? n.xy / rxy : vec2(1.0, 0.0);
  float depth = clamp(n.z * 3.0, -1.0, 1.0) * 0.3;
  vec3 gear = vec3(dir * rh, depth);

  // transitional burst so the morph feels energetic
  float burst = sin(uMorph * 3.14159) * 0.35;
  return mix(sphere, gear, smoothstep(0.0, 1.0, uMorph)) + n * burst * (0.5 + 0.5 * nz);
}`;

export function createScene(canvas) {
  const isMobile = matchMedia('(max-width: 767px)').matches || matchMedia('(pointer: coarse)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
  let maxDpr = isMobile ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x07090e, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07090e, 0.035);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 9);

  const CYAN = new THREE.Color('#00F0FF');
  const AMBER = new THREE.Color('#FF6B00');

  const shared = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uMix: { value: 0 },
    uFade: { value: 1 },
    uColorA: { value: CYAN.clone() },
    uColorB: { value: AMBER.clone() },
  };

  /* ---------------- World (particles + grid) ---------------- */
  const world = new THREE.Group();
  scene.add(world);

  // Particles
  const COUNT = isMobile ? 1800 : 4200;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 36;
    pos[i * 3 + 2] = -Math.random() * 70 + 12;
    seed[i] = Math.random();
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uSize: { value: 26 * renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uSize; attribute float aSeed; varying float vSeed;
      void main(){
        vec3 p = position;
        p.y += sin(uTime * 0.4 + aSeed * 40.0) * 0.35;
        p.x += cos(uTime * 0.3 + aSeed * 25.0) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.35 + aSeed) / -mv.z;
        gl_Position = projectionMatrix * mv;
        vSeed = aSeed;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA; uniform vec3 uColorB; uniform float uMix; varying float vSeed;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 c = mix(uColorA, uColorB, clamp(uMix + (vSeed > 0.85 ? 0.6 - uMix*1.2 : 0.0), 0.0, 1.0));
        c = mix(c, vec3(1.0), smoothstep(0.15, 0.0, d) * 0.6);
        gl_FragColor = vec4(c, a * (0.35 + vSeed * 0.65));
      }`,
  });
  const particles = new THREE.Points(pGeo, pMat);
  world.add(particles);

  // Holographic grid floor
  const gMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: shared,
    vertexShader: /* glsl */ `
      varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uMix; uniform vec3 uColorA; uniform vec3 uColorB; varying vec3 vW;
      float grid(vec2 p, float s){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y), 1.0); }
      void main(){
        vec2 p = vW.xz + vec2(0.0, uTime * 1.2);
        float g = grid(p, 1.5) * 0.55 + grid(p, 7.5) * 0.9;
        float dist = length(vW.xz - cameraPosition.xz);
        float fade = smoothstep(42.0, 4.0, dist);
        float scan = smoothstep(0.0, 0.6, sin(vW.z * 0.25 - uTime * 1.6) * 0.5 + 0.5) * 0.6 + 0.4;
        vec3 c = mix(uColorA, uColorB, uMix);
        gl_FragColor = vec4(c, g * fade * scan * (0.32 + uMix * 0.25));
      }`,
    extensions: { derivatives: true },
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220, 1, 1), gMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.2;
  world.add(floor);
  const ceiling = floor.clone();
  ceiling.position.y = 7.5;
  ceiling.material = gMat;
  ceiling.visible = !isMobile;
  world.add(ceiling);

  /* ---------------- Neural-industrial core ---------------- */
  const core = new THREE.Group();
  scene.add(core);

  const coreGeo = new THREE.IcosahedronGeometry(1, isMobile ? 12 : 18);
  const wireMat = new THREE.ShaderMaterial({
    wireframe: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: shared,
    vertexShader: NOISE_GLSL + MORPH_GLSL + /* glsl */ `
      varying float vN; varying float vDepth;
      void main(){
        float nz; vec3 p = morphPos(position, nz);
        vN = nz;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA; uniform vec3 uColorB; uniform float uMix; uniform float uFade; varying float vN; varying float vDepth;
      void main(){
        vec3 c = mix(uColorA, uColorB, uMix);
        c = mix(c, vec3(1.0), smoothstep(0.35, 0.9, vN) * 0.5);
        float a = (0.16 + smoothstep(-0.4, 0.8, vN) * 0.38) * uFade;
        gl_FragColor = vec4(c, a);
      }`,
  });
  const wire = new THREE.Mesh(coreGeo, wireMat);
  core.add(wire);

  // Glowing vertex nodes (subset)
  const nodeGeo = new THREE.IcosahedronGeometry(1, 6);
  const nodeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uSize: { value: 70 * renderer.getPixelRatio() } },
    vertexShader: NOISE_GLSL + MORPH_GLSL + /* glsl */ `
      uniform float uSize; varying float vN;
      void main(){
        float nz; vec3 p = morphPos(position, nz) * 1.01; vN = nz;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.3 + max(nz, 0.0)) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA; uniform vec3 uColorB; uniform float uMix; uniform float uFade; varying float vN;
      void main(){
        float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d);
        vec3 c = mix(mix(uColorA, uColorB, uMix), vec3(1.0), 0.35);
        gl_FragColor = vec4(c, a * (0.25 + smoothstep(0.0, 0.8, vN) * 0.75) * uFade);
      }`,
  });
  const nodes = new THREE.Points(nodeGeo, nodeMat);
  core.add(nodes);

  // Inner energy core (fresnel)
  const innerMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: shared,
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vView;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA; uniform vec3 uColorB; uniform float uMix; uniform float uTime; uniform float uFade; varying vec3 vNormal; varying vec3 vView;
      void main(){
        float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
        vec3 c = mix(uColorA, uColorB, uMix);
        float pulse = 0.75 + 0.25 * sin(uTime * 2.0);
        gl_FragColor = vec4(c * (f * 1.6 + 0.12) * pulse, (f * 0.9 + 0.08) * uFade);
      }`,
  });
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 3), innerMat);
  core.add(inner);

  // Orbit rings
  const ringMat = new THREE.MeshBasicMaterial({ color: CYAN.clone(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const rings = [];
  [[2.35, 0.008, 1.2, 0.3], [2.75, 0.005, -0.6, 1.1], [3.15, 0.004, 0.4, -0.8]].forEach(([r, t, rx, ry], i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 220), ringMat.clone());
    m.rotation.set(rx, ry, 0);
    m.material.opacity = 0.5 - i * 0.12;
    core.add(m);
    rings.push(m);
  });
  // Ring satellites
  const satGeo = new THREE.OctahedronGeometry(0.06);
  const sats = rings.map((ring, i) => {
    const s = new THREE.Mesh(satGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.add(s);
    s.userData.speed = 0.5 + i * 0.25;
    s.userData.r = ring.geometry.parameters.radius;
    return s;
  });

  /* ---------------- State ---------------- */
  const state = {
    mouse: new THREE.Vector2(), mouseS: new THREE.Vector2(),
    scroll: 0, scrollS: 0, hero: 0, heroS: 0,
    morphT: 0, mixT: 0, spin: 0,
  };

  function layout() {
    const w = window.innerWidth;
    if (w < 768) { core.userData.base = new THREE.Vector3(0, -1.6, 0); core.userData.scale = 0.62; }
    else if (w < 1024) { core.userData.base = new THREE.Vector3(1.6, -0.6, 0); core.userData.scale = 0.75; }
    else { core.userData.base = new THREE.Vector3(2.75, 0.05, 0); core.userData.scale = 1; }
  }
  layout();

  window.addEventListener('pointermove', (e) => {
    state.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  }, { passive: true });

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    layout();
  }
  window.addEventListener('resize', resize);

  /* ---------------- Loop ---------------- */
  const clock = new THREE.Clock();
  let elapsed = 0, frames = 0, fpsTimer = 0, checkedPerf = false;
  const timeScale = reduced ? 0.25 : 1;

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt * timeScale;
    shared.uTime.value = elapsed;

    // adaptive quality: drop DPR if the device can't keep ~50fps
    if (!checkedPerf) {
      frames++; fpsTimer += dt;
      if (fpsTimer > 2.5) {
        const fps = frames / fpsTimer;
        if (fps < 48 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); renderer.setSize(window.innerWidth, window.innerHeight, false); }
        checkedPerf = true;
      }
    }

    const k = 1 - Math.pow(0.001, dt); // frame-rate independent smoothing
    state.mouseS.lerp(state.mouse, k * 0.9);
    state.scrollS += (state.scroll - state.scrollS) * k * 0.9;
    state.heroS += (state.hero - state.heroS) * k;
    shared.uMorph.value += (state.morphT - shared.uMorph.value) * k * 0.55;
    shared.uMix.value += (state.mixT - shared.uMix.value) * k * 0.7;
    state.spin *= 0.96;

    const s = reduced ? 0 : state.scrollS;
    const h = state.heroS;

    // Camera flies through the particle space as you scroll
    const angle = s * Math.PI * 0.9;
    camera.position.x = Math.sin(angle) * 2.5 + state.mouseS.x * 0.7;
    camera.position.y = -s * 2.2 + state.mouseS.y * 0.45;
    camera.position.z = 9 - s * 34;
    camera.lookAt(Math.sin(angle) * 0.5, -s * 2.2, camera.position.z - 9);
    camera.rotation.z = Math.sin(angle) * 0.06;

    world.rotation.y = s * 0.6 + state.mouseS.x * 0.04;

    // Core: anchored in hero, then drifts with the camera as an ambient presence
    const base = core.userData.base;
    const sc = core.userData.scale * (1 - h * 0.25);
    core.scale.setScalar(sc);
    core.position.set(
      base.x + h * (window.innerWidth < 768 ? 0 : 1.2) + camera.position.x * 0.9,
      base.y + h * 0.6 + camera.position.y,
      camera.position.z - 9 - h * 3
    );
    shared.uFade.value = 1 - h * 0.6;

    const rotSpeed = (0.12 + state.spin) * dt * timeScale * 6;
    wire.rotation.y += rotSpeed * 0.5;
    nodes.rotation.y = wire.rotation.y;
    core.rotation.x += ((state.mouseS.y * 0.35) - core.rotation.x) * k;
    core.rotation.y += ((state.mouseS.x * 0.5) - core.rotation.y) * k;
    inner.rotation.x += dt * 0.4; inner.rotation.y -= dt * 0.3;
    inner.scale.setScalar(1 + Math.sin(elapsed * 2) * 0.05);

    const ringColor = CYAN.clone().lerp(AMBER, shared.uMix.value);
    rings.forEach((r, i) => {
      r.rotation.z += dt * timeScale * (0.15 + i * 0.08) * (i % 2 ? -1 : 1) * (1 + state.spin * 8);
      r.material.color.copy(ringColor);
      r.material.opacity = (0.5 - i * 0.12) * shared.uFade.value;
    });
    sats.forEach((sat) => {
      const a = elapsed * sat.userData.speed;
      sat.position.set(Math.cos(a) * sat.userData.r, Math.sin(a) * sat.userData.r, 0);
      sat.rotation.x += dt * 2;
    });

    renderer.render(scene, camera);
  }

  let running = true;
  renderer.setAnimationLoop(tick);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) { renderer.setAnimationLoop(null); running = false; }
    else if (!document.hidden && !running) { clock.getDelta(); renderer.setAnimationLoop(tick); running = true; }
  });

  return {
    setMode(mode) {
      const ind = mode === 'industrial';
      state.morphT = ind ? 1 : 0;
      state.mixT = ind ? 1 : 0;
      state.spin = 0.6;
    },
    setScroll(p) { state.scroll = p; },
    setHero(p) { state.hero = p; },
  };
}
