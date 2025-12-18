// =======================
// MODULE IMPORTS (LOCKED)
// =======================
import * as THREE from "https://esm.sh/three@0.158.0";
import { Pane } from "https://cdn.skypack.dev/tweakpane@4.0.4";
import { EffectComposer } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/ShaderPass.js";

// =======================
// PRELOADER
// =======================
class PreloaderManager {
  constructor() {
    this.preloader = document.getElementById("preloader");
    this.mainContent = document.getElementById("main-content");
    this.progressBar = document.querySelector(".progress-bar");
    this.loadingSteps = 0;
    this.totalSteps = 5;
    this.isComplete = false;
  }

  updateProgress(step) {
    this.loadingSteps = Math.min(step, this.totalSteps);
    const percent = (this.loadingSteps / this.totalSteps) * 100;
    this.progressBar.style.width = `${percent}%`;
  }

  complete(canvas) {
    if (this.isComplete) return;
    this.isComplete = true;
    this.updateProgress(this.totalSteps);

    setTimeout(() => {
      this.preloader.classList.add("fade-out");
      this.mainContent.classList.add("fade-in");
      canvas.classList.add("fade-in");

      setTimeout(() => {
        this.preloader.style.display = "none";
      }, 1000);
    }, 1500);
  }
}

const preloader = new PreloaderManager();
preloader.updateProgress(1);

// =======================
// SCENE SETUP
// =======================
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 20;

preloader.updateProgress(2);

// =======================
// RENDERER
// =======================
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

document.body.appendChild(renderer.domElement);

Object.assign(renderer.domElement.style, {
  position: "absolute",
  inset: "0",
  zIndex: "2",
  background: "transparent"
});

// =======================
// POST PROCESSING
// =======================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.3,
  1.25,
  0.0
);
composer.addPass(bloomPass);

preloader.updateProgress(3);

// =======================
// ANALOG DECAY SHADER
// =======================
const analogDecayShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight)
    },
    uAnalogIntensity: { value: 0.6 },
    uAnalogGrain: { value: 0.4 },
    uAnalogBleeding: { value: 1.0 },
    uAnalogVSync: { value: 1.0 },
    uAnalogScanlines: { value: 1.0 },
    uAnalogVignette: { value: 1.0 },
    uAnalogJitter: { value: 0.4 },
    uLimboMode: { value: 0.0 }
  },

  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAnalogIntensity;
    uniform float uAnalogGrain;
    uniform float uAnalogBleeding;
    uniform float uAnalogVSync;
    uniform float uAnalogScanlines;
    uniform float uAnalogVignette;
    uniform float uAnalogJitter;
    uniform float uLimboMode;
    varying vec2 vUv;

    float rand(vec2 co){
      return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);
    }

    void main(){
      vec2 uv = vUv;
      float t = uTime * 1.8;

      uv.x += (rand(vec2(t,uv.y))-0.5)*0.003*uAnalogJitter*uAnalogIntensity;
      vec4 col = texture2D(tDiffuse, uv);

      if(uAnalogBleeding>0.01){
        float off = sin(t+uv.y*20.0)*0.012*uAnalogBleeding*uAnalogIntensity;
        col.r = texture2D(tDiffuse, uv+vec2(off,0)).r;
        col.b = texture2D(tDiffuse, uv-vec2(off,0)).b;
      }

      if(uAnalogGrain>0.01){
        col.rgb += (rand(uv+t)-0.5)*0.1*uAnalogGrain*uAnalogIntensity;
      }

      if(uAnalogScanlines>0.01){
        float s = sin(uv.y*800.0)*0.1*uAnalogScanlines*uAnalogIntensity;
        col.rgb *= (1.0-s);
      }

      if(uAnalogVignette>0.01){
        float d = distance(uv,vec2(0.5));
        col.rgb *= smoothstep(0.9,0.4,d);
      }

      if(uLimboMode>0.5){
        float g = dot(col.rgb,vec3(0.299,0.587,0.114));
        col.rgb = vec3(g);
      }

      gl_FragColor = col;
    }
  `
};

const analogPass = new ShaderPass(analogDecayShader);
composer.addPass(analogPass);
composer.addPass(new OutputPass());

// =======================
// GHOST
// =======================
const ghostGroup = new THREE.Group();
scene.add(ghostGroup);

const ghostGeom = new THREE.SphereGeometry(2, 40, 40);
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0x0f2027,
  transparent: true,
  opacity: 0.88,
  emissive: 0xff4500,
  emissiveIntensity: 5.8,
  roughness: 0.02
});

const ghost = new THREE.Mesh(ghostGeom, ghostMat);
ghostGroup.add(ghost);

// =======================
// LIGHTING
// =======================
scene.add(new THREE.AmbientLight(0x0a0a2e, 0.08));

const rim1 = new THREE.DirectionalLight(0x4a90e2, 1.8);
rim1.position.set(-8, 6, -4);
scene.add(rim1);

const rim2 = new THREE.DirectionalLight(0x50e3c2, 1.2);
rim2.position.set(8, -4, -6);
scene.add(rim2);

preloader.updateProgress(4);

// =======================
// GUI
// =======================
const pane = new Pane({ title: "Spectral Ghost", expanded: false });
pane.addBinding(ghostMat, "emissiveIntensity", {
  min: 1,
  max: 10,
  step: 0.1
});

// =======================
// INPUT
// =======================
const mouse = new THREE.Vector2();
window.addEventListener("mousemove", e => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// =======================
// ANIMATION
// =======================
let time = 0;
let initialized = false;

function init() {
  composer.render();
  preloader.complete(renderer.domElement);
  initialized = true;
}

preloader.updateProgress(5);
setTimeout(init, 100);

function animate(t) {
  requestAnimationFrame(animate);
  if (!initialized) return;

  time += 0.01;
  analogPass.uniforms.uTime.value = time;

  ghostGroup.position.x += (mouse.x * 11 - ghostGroup.position.x) * 0.08;
  ghostGroup.position.y += (mouse.y * 7 - ghostGroup.position.y) * 0.08;
  ghost.rotation.y = Math.sin(time) * 0.2;

  composer.render();
}

animate(0);

// =======================
// RESIZE
// =======================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});


// /* ============================================================
//    LOCKED IMPORTS — REQUIRED FOR GITHUB PAGES
//    ============================================================ */
// import * as THREE from "https://esm.sh/three@0.158.0";
// import { Pane } from "https://cdn.skypack.dev/tweakpane@4.0.4";
// import { EffectComposer } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js";
// import { RenderPass } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/RenderPass.js";
// import { UnrealBloomPass } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js";
// import { OutputPass } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/OutputPass.js";
// import { ShaderPass } from "https://esm.sh/three@0.158.0/examples/jsm/postprocessing/ShaderPass.js";

// /* ============================================================
//    PRELOADER — UNCHANGED
//    ============================================================ */
// class PreloaderManager {
//   constructor() {
//     this.preloader = document.getElementById("preloader");
//     this.mainContent = document.getElementById("main-content");
//     this.progressBar = document.querySelector(".progress-bar");
//     this.loadingSteps = 0;
//     this.totalSteps = 5;
//     this.isComplete = false;
//   }

//   updateProgress(step) {
//     this.loadingSteps = Math.min(step, this.totalSteps);
//     this.progressBar.style.width =
//       (this.loadingSteps / this.totalSteps) * 100 + "%";
//   }

//   complete(canvas) {
//     if (this.isComplete) return;
//     this.isComplete = true;

//     this.updateProgress(this.totalSteps);

//     setTimeout(() => {
//       this.preloader.classList.add("fade-out");
//       this.mainContent.classList.add("fade-in");
//       canvas.classList.add("fade-in");

//       setTimeout(() => {
//         this.preloader.style.display = "none";
//       }, 1000);
//     }, 1500);
//   }
// }

// const preloader = new PreloaderManager();
// preloader.updateProgress(1);

// /* ============================================================
//    SCENE / CAMERA / RENDERER
//    ============================================================ */
// const scene = new THREE.Scene();
// scene.background = null;

// const camera = new THREE.PerspectiveCamera(
//   75,
//   window.innerWidth / window.innerHeight,
//   0.1,
//   1000
// );
// camera.position.z = 20;

// preloader.updateProgress(2);

// const renderer = new THREE.WebGLRenderer({
//   antialias: true,
//   powerPreference: "high-performance",
//   alpha: true
// });
// renderer.setSize(window.innerWidth, window.innerHeight);
// renderer.setClearColor(0x000000, 0);
// renderer.toneMapping = THREE.ACESFilmicToneMapping;
// renderer.toneMappingExposure = 0.9;

// document.body.appendChild(renderer.domElement);

// /* ============================================================
//    POST PROCESSING
//    ============================================================ */
// const composer = new EffectComposer(renderer);
// composer.addPass(new RenderPass(scene, camera));

// const bloomPass = new UnrealBloomPass(
//   new THREE.Vector2(window.innerWidth, window.innerHeight),
//   0.3,
//   1.25,
//   0.0
// );
// composer.addPass(bloomPass);

// preloader.updateProgress(3);

// /* ============================================================
//    ANALOG DECAY SHADER — UNCHANGED LOGIC
//    ============================================================ */
// const analogDecayPass = new ShaderPass({
//   uniforms: {
//     tDiffuse: { value: null },
//     uTime: { value: 0 },
//     uAnalogIntensity: { value: 0.6 },
//     uAnalogGrain: { value: 0.4 },
//     uAnalogBleeding: { value: 1.0 },
//     uAnalogVSync: { value: 1.0 },
//     uAnalogScanlines: { value: 1.0 },
//     uAnalogVignette: { value: 1.0 },
//     uAnalogJitter: { value: 0.4 },
//     uLimboMode: { value: 0.0 }
//   },
//   vertexShader: `
//     varying vec2 vUv;
//     void main() {
//       vUv = uv;
//       gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
//     }
//   `,
//   fragmentShader: `
//     uniform sampler2D tDiffuse;
//     uniform float uTime,uAnalogIntensity,uAnalogGrain,uAnalogBleeding;
//     uniform float uAnalogScanlines,uAnalogVignette,uAnalogJitter,uLimboMode;
//     varying vec2 vUv;

//     float r(vec2 c){return fract(sin(dot(c,vec2(12.9,78.2)))*43758.5);}

//     void main(){
//       vec2 uv=vUv;
//       uv.x+=(r(vec2(uTime,uv.y))-0.5)*0.003*uAnalogJitter*uAnalogIntensity;
//       vec4 col=texture2D(tDiffuse,uv);

//       if(uAnalogBleeding>0.01){
//         float o=sin(uTime+uv.y*20.)*0.012*uAnalogBleeding;
//         col.r=texture2D(tDiffuse,uv+vec2(o,0)).r;
//         col.b=texture2D(tDiffuse,uv-vec2(o,0)).b;
//       }

//       if(uAnalogGrain>0.01)
//         col.rgb+=(r(uv+uTime)-0.5)*0.08*uAnalogGrain;

//       if(uAnalogScanlines>0.01)
//         col.rgb*=1.-sin(uv.y*800.)*0.1*uAnalogScanlines;

//       if(uAnalogVignette>0.01)
//         col.rgb*=smoothstep(.9,.3,distance(uv,.5));

//       if(uLimboMode>0.5){
//         float g=dot(col.rgb,vec3(.299,.587,.114));
//         col.rgb=vec3(g);
//       }

//       gl_FragColor=col;
//     }
//   `
// });
// composer.addPass(analogDecayPass);
// composer.addPass(new OutputPass());

// /* ============================================================
//    GHOST BODY — DEFORMATION RESTORED
//    ============================================================ */
// const ghostGroup = new THREE.Group();
// scene.add(ghostGroup);

// const ghostGeometry = new THREE.SphereGeometry(2, 40, 40);
// const pos = ghostGeometry.attributes.position.array;

// for (let i = 0; i < pos.length; i += 3) {
//   if (pos[i + 1] < -0.2) {
//     const x = pos[i];
//     const z = pos[i + 2];
//     pos[i + 1] =
//       -2 +
//       Math.sin(x * 5) * 0.35 +
//       Math.cos(z * 4) * 0.25 +
//       Math.sin((x + z) * 3) * 0.15;
//   }
// }
// ghostGeometry.computeVertexNormals();

// const ghostMaterial = new THREE.MeshStandardMaterial({
//   color: 0x0f2027,
//   transparent: true,
//   opacity: 0.88,
//   emissive: 0xff4500,
//   emissiveIntensity: 5.8,
//   roughness: 0.02
// });

// const ghostBody = new THREE.Mesh(ghostGeometry, ghostMaterial);
// ghostGroup.add(ghostBody);

// /* ============================================================
//    EYES — RESTORED
//    ============================================================ */
// function createEyes() {
//   const g = new THREE.Group();
//   ghostGroup.add(g);

//   const mat = new THREE.MeshBasicMaterial({
//     color: 0x00ff80,
//     transparent: true,
//     opacity: 0
//   });

//   const geo = new THREE.SphereGeometry(0.3, 12, 12);
//   const left = new THREE.Mesh(geo, mat.clone());
//   const right = new THREE.Mesh(geo, mat.clone());

//   left.position.set(-0.7, 0.6, 2);
//   right.position.set(0.7, 0.6, 2);

//   g.add(left, right);
//   return { left, right };
// }

// const eyes = createEyes();

// /* ============================================================
//    LIGHTING
//    ============================================================ */
// scene.add(new THREE.AmbientLight(0x0a0a2e, 0.08));

// const rim1 = new THREE.DirectionalLight(0x4a90e2, 1.8);
// rim1.position.set(-8, 6, -4);
// scene.add(rim1);

// const rim2 = new THREE.DirectionalLight(0x50e3c2, 1.2);
// rim2.position.set(8, -4, -6);
// scene.add(rim2);

// preloader.updateProgress(4);

// /* ============================================================
//    INPUT
//    ============================================================ */
// const mouse = new THREE.Vector2();
// window.addEventListener("mousemove", e => {
//   mouse.x = (e.clientX / innerWidth) * 2 - 1;
//   mouse.y = -(e.clientY / innerHeight) * 2 + 1;
// });

// /* ============================================================
//    INITIAL RENDER (CRITICAL)
//    ============================================================ */
// let initialized = false;

// function forceInitialRender() {
//   for (let i = 0; i < 3; i++) composer.render();
//   initialized = true;
//   preloader.complete(renderer.domElement);
// }

// preloader.updateProgress(5);
// setTimeout(forceInitialRender, 100);

// /* ============================================================
//    ANIMATION LOOP
//    ============================================================ */
// let time = 0;

// function animate() {
//   requestAnimationFrame(animate);
//   if (!initialized) return;

//   time += 0.01;
//   analogDecayPass.uniforms.uTime.value = time;

//   ghostGroup.position.x += (mouse.x * 11 - ghostGroup.position.x) * 0.075;
//   ghostGroup.position.y += (mouse.y * 7 - ghostGroup.position.y) * 0.075;

//   ghostBody.rotation.y = Math.sin(time * 1.4) * 0.05;

//   const glow = Math.min(1, Math.abs(mouse.x) + Math.abs(mouse.y));
//   eyes.left.material.opacity = glow;
//   eyes.right.material.opacity = glow;

//   composer.render();
// }

// animate();

// /* ============================================================
//    RESIZE
//    ============================================================ */
// window.addEventListener("resize", () => {
//   camera.aspect = innerWidth / innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(innerWidth, innerHeight);
//   composer.setSize(innerWidth, innerHeight);
// });
