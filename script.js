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
