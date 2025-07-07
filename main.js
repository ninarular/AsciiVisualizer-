import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js';

// -- Scene, Camera, Renderer Setup --
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// -- HDR Background --
const rgbeLoader = new RGBELoader();
rgbeLoader.load('/hdr/background.hdr', function (texture) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.background = texture;
});

// -- Lighting --
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffaa55, 1, 100);
pointLight.position.set(2, 2, 2);
scene.add(pointLight);


// -- Loading Spinner --
const loaderDiv = document.createElement('div');
loaderDiv.id = 'loader';
loaderDiv.style.position = 'fixed';
loaderDiv.style.top = '50%';
loaderDiv.style.left = '50%';
loaderDiv.style.transform = 'translate(-50%, -50%)';
loaderDiv.style.width = '50px';
loaderDiv.style.height = '50px';
loaderDiv.style.border = '5px solid rgba(255, 255, 255, 0.2)';
loaderDiv.style.borderTop = '5px solid white';
loaderDiv.style.borderRadius = '50%';
loaderDiv.style.animation = 'spin 1s linear infinite';
document.body.appendChild(loaderDiv);

const style = document.createElement('style');
style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);


// -- Controls --
let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// -- ASCII Effect Setup --
const effect = new AsciiEffect(renderer, ' .:-+*=%@#', { invert: true });
effect.setSize(window.innerWidth, window.innerHeight);
effect.domElement.style.color = 'white';
effect.domElement.style.backgroundColor = 'black';
effect.domElement.style.position = 'absolute';
effect.domElement.style.top = '50%';
effect.domElement.style.left = '50%';
document.body.appendChild(effect.domElement);

let useAscii = false;
renderer.domElement.style.display = 'block';
effect.domElement.style.display = 'none';

// -- Audio Setup --
let audioCtx, analyser, sourceNode, frequencyData, audio;
let isPlaying = false;
let lastBassLevel = 0;

const fileInputElement = document.createElement('input');
fileInputElement.type = 'file';
fileInputElement.id = 'audio-file-input';
fileInputElement.accept = 'audio/*';
fileInputElement.style.display = 'none';
fileInputElement.addEventListener('change', handleFileUpload);
document.body.appendChild(fileInputElement);


function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (audio) {
    audio.pause();
  }
  
  audio = new Audio();
  audio.src = URL.createObjectURL(file);
  audio.loop = true;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);

    sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
  
  audioControls.playPause();
}

// -- Model Loading --
let object;
const gltfLoader = new GLTFLoader();
gltfLoader.load('/models/model.glb', (gltf) => {
    setTimeout(() => onObjLoad(gltf.scene), 2000);
}, undefined, (err) => {
    console.error("Error loading .glb file:", err);
    loaderDiv.remove();
});

function onObjLoad(loadedObject) {
    loaderDiv.remove();
    object = loadedObject;
    scene.add(object);
}

// -- GUI Setup --
const gui = new GUI();

const audioControls = {
  upload: () => fileInputElement.click(),
  playPause: function() {
    if (!audio) { console.warn("No audio loaded."); return; }
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }

    isPlaying = !isPlaying;
    if (isPlaying) { audio.play(); } else { audio.pause(); }
    this['Play/Pause'] = isPlaying ? 'Pause' : 'Play';
    audioFolder.controllers[1].updateDisplay();
  }
};
audioControls['Play/Pause'] = 'Play';

const audioFolder = gui.addFolder('Audio Controls');
audioFolder.add(audioControls, 'upload').name('Upload Audio');
audioFolder.add(audioControls, 'playPause').name('Play/Pause');

const asciiSettings = {
  asciiRender: false,
  webcam: false,
  resolutionScale: 1.0,
  widthScale: 1.0,
  heightScale: 1.0,
};

const asciiFolder = gui.addFolder('ASCII Settings');
asciiFolder.add(asciiSettings, 'asciiRender').name('ASCII Render').onChange(val => {
  useAscii = val;
  renderer.domElement.style.display = val ? 'none' : 'block';
  effect.domElement.style.display = val ? 'block' : 'none';
  
  controls.dispose();
  controls = new OrbitControls(camera, val ? effect.domElement : renderer.domElement);
});
asciiFolder.add(asciiSettings, 'resolutionScale', 0.1, 2).step(0.1).name('ASCII Resolution').onChange(updateAsciiDisplaySize);
asciiFolder.add(asciiSettings, 'widthScale', 0.5, 2).step(0.1).name('Width Scale').onChange(updateAsciiDisplaySize);
asciiFolder.add(asciiSettings, 'heightScale', 0.5, 2).step(0.1).name('Height Scale').onChange(updateAsciiDisplaySize);
asciiFolder.add(asciiSettings, 'webcam').name('Use Webcam for ASCII').onChange(toggleWebcamAscii);


function updateAsciiDisplaySize() {
  const width = window.innerWidth * asciiSettings.widthScale;
  const height = window.innerHeight * asciiSettings.heightScale;
  effect.setSize(width * asciiSettings.resolutionScale, height * asciiSettings.resolutionScale);
  effect.domElement.style.fontSize = (10 / asciiSettings.resolutionScale) + 'px';
}
updateAsciiDisplaySize();

// -- Webcam Functionality --
let videoStream, videoTexture, videoPlane;
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

      if (object) object.visible = false;
    } catch (err) {
      console.error('Webcam access failed:', err);
    }
  } else {
    if (videoPlane) { scene.remove(videoPlane); videoPlane = null; }
    if (videoStream) { videoStream.getTracks().forEach(track => track.stop()); videoStream = null; }
    if (object) object.visible = true;
  }
}

// -- Footer --
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

// -- Animation Loop --
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // **FIX: Start with a base transform for centering**
  let currentTransform = 'translate(-50%, -50%)';

  if (analyser && useAscii && isPlaying && !asciiSettings.webcam) {
    analyser.getByteFrequencyData(frequencyData);

    const bass = frequencyData.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const treble = frequencyData.slice(41, 100).reduce((a, b) => a + b, 0) / 59;
    
    const blurAmount = Math.max(0, (40 / (bass + 1)) - 0.3);
    const saturationAmount = 1 + (treble / 255);
    effect.domElement.style.filter = `blur(${blurAmount}px) saturate(${saturationAmount})`;

    const bassHit = bass > lastBassLevel + 25 && bass > 140;
    lastBassLevel = bass;

    if (bassHit) {
      effect.domElement.style.fontWeight = 'bold';
      // **FIX: Append shake to the current transform**
      const shakeX = (Math.random() - 0.5) * 15;
      const shakeY = (Math.random() - 0.5) * 15;
      currentTransform += ` translate(${shakeX}px, ${shakeY}px)`;
    } else {
      effect.domElement.style.fontWeight = 'normal';
    }

  } else {
    effect.domElement.style.fontWeight = 'normal';
    effect.domElement.style.filter = 'none';
  }

  // **FIX: Apply the combined transform at the end**
  effect.domElement.style.transform = currentTransform;

  if (useAscii) {
    effect.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }
}
animate();

// -- Window Resize Handling --
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