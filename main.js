import * as THREE from 'three';
// import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'; // Replaced with GLTFLoader
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('white');

const rgbeLoader = new RGBELoader();
rgbeLoader.load('/hdr/background.hdr', function (texture) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.background = texture;
});

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

const effect = new AsciiEffect(renderer, ' .:-+*=%@#', { invert: true });
effect.setSize(window.innerWidth, window.innerHeight);
effect.domElement.style.color = 'white';
effect.domElement.style.backgroundColor = 'black';
effect.domElement.style.fontSize = (10 / 1) + 'px';
effect.domElement.style.position = 'absolute';
effect.domElement.style.top = '50%';
effect.domElement.style.left = '50%';
effect.domElement.style.transform = 'translate(-50%, -50%)';
let useAscii = false;
document.body.appendChild(effect.domElement);
renderer.domElement.style.display = '';      // Show default renderer by default
effect.domElement.style.display = 'none';    // Hide ASCII renderer initially

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const loaderDiv = document.createElement('div');
loaderDiv.id = 'loader';
loaderDiv.textContent = '';
loaderDiv.style.position = 'fixed';
loaderDiv.style.top = '50%';
loaderDiv.style.left = '50%';
loaderDiv.style.transform = 'translate(-50%, -50%)';
loaderDiv.style.width = '50px';
loaderDiv.style.height = '50px';
loaderDiv.style.border = '5px solid rgba(0, 0, 0, 0.1)';
loaderDiv.style.borderTop = '5px solid black';
loaderDiv.style.borderRadius = '50%';
loaderDiv.style.animation = 'spin 1s linear infinite';
document.body.appendChild(loaderDiv);

// Add spinner animation style
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight('white', 1);
light.position.set(5, 5, 5);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft white ambient light
scene.add(ambientLight);

// Point light and visible mesh representation
const pointLight = new THREE.PointLight(0xffaa55, 1, 100);
pointLight.position.set(2, 2, 2);
scene.add(pointLight);



let object;

const gltfLoader = new GLTFLoader();

gltfLoader.load('/models/model.glb', (gltf) => {
  setTimeout(() => {
    onObjLoad(gltf.scene);
  }, 2000); // 2 second delay to simulate loading
}, undefined, (err) => {
  console.error("Error loading .glb file:", err);
});

function onObjLoad(obj) {
  const loader = document.getElementById('loader');
  if (loader) loader.remove();

  object = obj;
  object.position.set(0, 0, 0);
  object.scale.set(1, 1, 1);
  object.traverse((child) => {
    if (child.isMesh && child.material) {
      // Removed line that replaced material with red MeshStandardMaterial
    }
  });

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center); // center the object
  camera.position.set(center.x, center.y, size.length()); // move camera back based on size
  // Set zoom distance limits based on model size
  controls.minDistance = size.length() * 0.5;
  controls.maxDistance = size.length() * 3;
  camera.lookAt(center);

  scene.add(object);
  animate();
}

const gui = new GUI();


const asciiSettings = {
  asciiRender: false,
  resolutionScale: 1,
  webcam: false,
  widthScale: 1,
  heightScale: 1
};

gui.add(asciiSettings, 'asciiRender').name('ASCII Render').onChange(val => {
  useAscii = val;
  renderer.domElement.style.display = val ? 'none' : '';
  effect.domElement.style.display = val ? '' : 'none';
  controls.domElement = val ? effect.domElement : renderer.domElement;

  if (!val) {
    renderer.setSize(window.innerWidth, window.innerHeight); // Restore main render resolution
  }
});
gui.add(asciiSettings, 'resolutionScale', 0.1, 2).step(0.1).name('ASCII Resolution').onChange(updateAsciiDisplaySize);
gui.add(asciiSettings, 'widthScale', 0.5, 2).step(0.1).name('Width Scale').onChange(updateAsciiDisplaySize);
gui.add(asciiSettings, 'heightScale', 0.5, 2).step(0.1).name('Height Scale').onChange(updateAsciiDisplaySize);
gui.add(asciiSettings, 'webcam').name('Use Webcam for ASCII').onChange(toggleWebcamAscii);

function updateAsciiDisplaySize() {
  const width = window.innerWidth * asciiSettings.widthScale;
  const height = window.innerHeight * asciiSettings.heightScale;
  effect.setSize(width * asciiSettings.resolutionScale, height * asciiSettings.resolutionScale);
  effect.domElement.style.fontSize = (10 / asciiSettings.resolutionScale) + 'px';
  effect.domElement.style.position = 'absolute';
  effect.domElement.style.top = '50%';
  effect.domElement.style.left = '50%';
  effect.domElement.style.transform = 'translate(-50%, -50%)';
}

let videoStream = null;
let videoTexture = null;
let videoPlane = null;

async function toggleWebcamAscii(useWebcam) {
  if (useWebcam) {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = videoStream;
      video.play();

      videoTexture = new THREE.VideoTexture(video);
      const geometry = new THREE.PlaneGeometry(window.innerWidth / 100, window.innerHeight / 100);
      const material = new THREE.MeshBasicMaterial({ map: videoTexture });
      videoPlane = new THREE.Mesh(geometry, material);
      scene.add(videoPlane);

      if (object) scene.remove(object);
    } catch (err) {
      console.error('Webcam access failed:', err);
    }
  } else {
    if (videoPlane) {
      scene.remove(videoPlane);
      videoPlane = null;
    }
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    if (object) scene.add(object);
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (useAscii) {
    effect.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateAsciiDisplaySize();
  if (videoPlane) {
    videoPlane.geometry.dispose();
    videoPlane.geometry = new THREE.PlaneGeometry(window.innerWidth / 100, window.innerHeight / 100);
  }
});

const footerText = document.createElement('div');
footerText.textContent = 'pee pee poo poo';
footerText.style.position = 'fixed';
footerText.style.bottom = '10px';
footerText.style.left = '50%';
footerText.style.transform = 'translateX(-50%)';
footerText.style.color = 'white';
footerText.style.fontFamily = 'Times New Roman, serif';
footerText.style.fontSize = '16px';
document.body.appendChild(footerText);