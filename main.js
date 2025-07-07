import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// -- Basic Scene Setup --
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

// -- Post-Processing Setup --
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
composer.addPass(bloomPass);


// -- ASCII Effect Setup --
const effect = new AsciiEffect(renderer, ' .:-+*=%@#', { invert: true });
effect.setSize(window.innerWidth, window.innerHeight);
effect.domElement.style.color = 'white';
effect.domElement.style.backgroundColor = 'black';
effect.domElement.style.position = 'absolute';
effect.domElement.style.top = '50%';
effect.domElement.style.left = '50%';
effect.domElement.style.transform = 'translate(-50%, -50%)';
document.body.appendChild(effect.domElement);

// -- Environment & Lighting --
const rgbeLoader = new RGBELoader();
rgbeLoader.load('/hdr/background.hdr', function (texture) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.background = new THREE.Color(0x111111);
});
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// -- Controls Setup --
let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false; // Disables camera inertia

// -- Audio Setup --
let audioCtx, analyser, sourceNode, frequencyData, audio;
let isPlaying = false;

const fileInputElement = document.getElementById('audio-file-input');
fileInputElement.addEventListener('change', handleFileUpload);

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (audio) audio.pause();
  
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

// -- Model Loading & Reactivity Prep --
let object, originalPositions, materials = [];
const gltfLoader = new GLTFLoader();
gltfLoader.load('/models/model.glb', (gltf) => {
    object = gltf.scene;
    object.traverse((child) => {
        if (child.isMesh) {
            originalPositions = child.geometry.attributes.position.clone();
            materials.push(child.material);
            if (!child.material.emissive) {
                child.material.emissive = new THREE.Color(0x000000);
            }
            child.material.emissiveIntensity = 1.0;
        }
    });
    scene.add(object);
}, undefined, (err) => console.error("Error loading .glb file:", err));

// -- GUI Setup & Toggle Functions --
const gui = new GUI();

const renderSettings = { useAscii: false };

function toggleAsciiRender() {
    renderSettings.useAscii = !renderSettings.useAscii;
    
    renderer.domElement.style.display = renderSettings.useAscii ? 'none' : 'block';
    effect.domElement.style.display = renderSettings.useAscii ? 'block' : 'none';
    
    controls.dispose();
    controls = new OrbitControls(camera, renderSettings.useAscii ? effect.domElement : renderer.domElement);
    controls.enableDamping = false;
    
    gui.controllers[0].updateDisplay();
}

gui.add(renderSettings, 'useAscii').name('Enable ASCII Render').onChange(toggleAsciiRender);

const globalSettings = { multiplier: 1.0 };
gui.add(globalSettings, 'multiplier', 0, 3, 0.05).name('Global Intensity');

const audioControls = {
  upload: () => fileInputElement.click(),
  playPause: function() {
    if (!audio) { console.warn("No audio loaded."); return; }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isPlaying = !isPlaying;
    if (isPlaying) audio.play(); else audio.pause();
    this['Play/Pause'] = isPlaying ? 'Pause' : 'Play';
    audioFolder.controllers[1].updateDisplay();
  }
};
audioControls['Play/Pause'] = 'Play';
const audioFolder = gui.addFolder('Audio Controls');
audioFolder.add(audioControls, 'upload').name('Upload Audio');
audioFolder.add(audioControls, 'playPause').name('Play/Pause');

const modelReactivitySettings = {
    bassGrowthMultiplier: 1.0,
    pulseColor1: '#ff0055',
    pulseColor2: '#00ffff',
};
const modelReactivityFolder = gui.addFolder('Visual Controls');
modelReactivityFolder.add(modelReactivitySettings, 'bassGrowthMultiplier', 0, 3, 0.1).name('Bass Growth Multiplier');
modelReactivityFolder.addColor(modelReactivitySettings, 'pulseColor1').name('Gradient Color 1');
modelReactivityFolder.addColor(modelReactivitySettings, 'pulseColor2').name('Gradient Color 2');

const postProcessingSettings = {
    bloomStrength: 1.5,
    cameraWobble: 0.2,
};
const postProcessingFolder = gui.addFolder('Post-Processing');
postProcessingFolder.add(postProcessingSettings, 'bloomStrength', 0, 5, 0.1).name('Bloom Strength');
postProcessingFolder.add(postProcessingSettings, 'cameraWobble', 0, 1, 0.05).name('Camera Wobble');

const asciiReactivitySettings = {
    blurIntensity: 0.5,
    saturationIntensity: 1.0,
    enableShake: true,
};
const asciiReactivityFolder = gui.addFolder('ASCII Reactivity');
asciiReactivityFolder.add(asciiReactivitySettings, 'blurIntensity', 0, 5, 0.1).name('Blur Intensity');
asciiReactivityFolder.add(asciiReactivitySettings, 'saturationIntensity', 0, 3, 0.1).name('Saturation');
const shakeController = asciiReactivityFolder.add(asciiReactivitySettings, 'enableShake').name('Enable Shake');

// Camera View Snapping
const cameraViews = {
    front: () => snapToView('front'),
    top: () => snapToView('top'),
    side: () => snapToView('side'),
};
const cameraFolder = gui.addFolder('Camera Views');
cameraFolder.add(cameraViews, 'front').name('Front');
cameraFolder.add(cameraViews, 'top').name('Top');
cameraFolder.add(cameraViews, 'side').name('Side');

function snapToView(view) {
    controls.reset();
    controls.target.set(0, 0, 0);
    const distance = 5;

    switch(view) {
        case 'front':
            camera.position.set(0, 0, distance);
            camera.up.set(0, 1, 0);
            break;
        case 'top':
            camera.position.set(0, distance, 0);
            camera.up.set(0, 0, -1);
            break;
        case 'side':
            camera.position.set(distance, 0, 0);
            camera.up.set(0, 1, 0);
            break;
    }
    camera.lookAt(scene.position);
}

// -- Gamepad Setup --
let gamepad = null;
const buttonState = {
    dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
    triangle: false, circle: false
};
const spherical = new THREE.Spherical();
const offset = new THREE.Vector3();

window.addEventListener("gamepadconnected", (event) => {
  console.log("Gamepad connected:", event.gamepad.id);
  gamepad = event.gamepad;
});

window.addEventListener("gamepaddisconnected", (event) => {
  console.log("Gamepad disconnected:", event.gamepad.id);
  gamepad = null;
});

function handleGamepadInput() {
    if (!gamepad) {
        return;
    }

    gamepad = navigator.getGamepads()[gamepad.index];
    if (!gamepad) return;

    const deadZone = 0.2;
    let cameraNeedsUpdate = false;

    // --- Button Toggles ---
    // Triangle (Button 3) to toggle ASCII Render
    if (gamepad.buttons[3].pressed && !buttonState.triangle) {
        toggleAsciiRender();
        buttonState.triangle = true;
    } else if (!gamepad.buttons[3].pressed) {
        buttonState.triangle = false;
    }

    // Circle (Button 1) to toggle ASCII Shake
    if (gamepad.buttons[1].pressed && !buttonState.circle) {
        asciiReactivitySettings.enableShake = !asciiReactivitySettings.enableShake;
        shakeController.updateDisplay();
        buttonState.circle = true;
    } else if (!gamepad.buttons[1].pressed) {
        buttonState.circle = false;
    }


    // Get current camera state for manipulation
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);

    // --- Triggers for Zoom (L2/R2) ---
    const l2 = gamepad.buttons[6];
    const r2 = gamepad.buttons[7];
    if (l2.pressed) {
        spherical.radius *= 1.05;
        cameraNeedsUpdate = true;
    }
    if (r2.pressed) {
        spherical.radius *= 0.95;
        cameraNeedsUpdate = true;
    }

    // --- Left Joystick for Rotation ---
    const leftStickX = Math.abs(gamepad.axes[0]) > deadZone ? gamepad.axes[0] : 0;
    const leftStickY = Math.abs(gamepad.axes[1]) > deadZone ? gamepad.axes[1] : 0;
    if (leftStickX !== 0 || leftStickY !== 0) {
        // Increased sensitivity from 0.02 to 0.04
        spherical.theta -= leftStickX * 0.04;
        spherical.phi -= leftStickY * 0.04;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        cameraNeedsUpdate = true;
    }

    // Apply camera changes if any
    if (cameraNeedsUpdate) {
        offset.setFromSpherical(spherical);
        camera.position.copy(controls.target).add(offset);
    }
    
    // --- Right Joystick for Bloom & Intensity ---
    const rightStickX = Math.abs(gamepad.axes[2]) > deadZone ? gamepad.axes[2] : 0;
    const rightStickY = Math.abs(gamepad.axes[3]) > deadZone ? gamepad.axes[3] : 0;
    if (rightStickY !== 0) {
        postProcessingSettings.bloomStrength -= rightStickY * 0.1;
        postProcessingSettings.bloomStrength = Math.max(0, Math.min(5, postProcessingSettings.bloomStrength));
        postProcessingFolder.controllers[0].updateDisplay();
    }
    if (rightStickX !== 0) {
        globalSettings.multiplier += rightStickX * 0.05;
        globalSettings.multiplier = Math.max(0, Math.min(3, globalSettings.multiplier));
        gui.controllers[1].updateDisplay();
    }
    
    // --- D-Pad for Snapping ---
    if (gamepad.buttons[12].pressed && !buttonState.dpadUp) {
        snapToView('top');
        buttonState.dpadUp = true;
    } else if (!gamepad.buttons[12].pressed) {
        buttonState.dpadUp = false;
    }
    if (gamepad.buttons[13].pressed && !buttonState.dpadDown) {
        snapToView('front');
        buttonState.dpadDown = true;
    } else if (!gamepad.buttons[13].pressed) {
        buttonState.dpadDown = false;
    }
    if (gamepad.buttons[14].pressed && !buttonState.dpadLeft) {
        snapToView('side');
        buttonState.dpadLeft = true;
    } else if (!gamepad.buttons[14].pressed) {
        buttonState.dpadLeft = false;
    }
    if (gamepad.buttons[15].pressed && !buttonState.dpadRight) {
        snapToView('side');
        buttonState.dpadRight = true;
    } else if (!gamepad.buttons[15].pressed) {
        buttonState.dpadRight = false;
    }
}

// -- Animation Loop --
const clock = new THREE.Clock();
const targetScale = new THREE.Vector3(1, 1, 1);
const pulseColor = new THREE.Color();
const color1 = new THREE.Color();
const color2 = new THREE.Color();
let tempoTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  let tempoRatio = 0;
  let asciiTransform = 'translate(-50%, -50%)';

  handleGamepadInput();

  if (isPlaying && analyser) {
    analyser.getByteFrequencyData(frequencyData);
    const bass = frequencyData.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const mids = frequencyData.slice(6, 40).reduce((a, b) => a + b, 0) / 34;
    const treble = frequencyData.slice(41, 100).reduce((a, b) => a + b, 0) / 59;
    
    const bassRatio = Math.pow(bass / 255, 2);
    tempoRatio = mids / 255;
    const trebleRatio = treble / 255;
    const globalMultiplier = globalSettings.multiplier;

    color1.set(modelReactivitySettings.pulseColor1);
    color2.set(modelReactivitySettings.pulseColor2);
    pulseColor.copy(color1).lerp(color2, tempoRatio);

    if (object) {
        const pulse = 1 + bassRatio * modelReactivitySettings.bassGrowthMultiplier * globalMultiplier;
        targetScale.set(pulse, pulse, pulse);
        object.scale.lerp(targetScale, deltaTime * 10);

        materials.forEach(mat => {
            if (mat.emissive) {
                mat.emissive.copy(pulseColor);
                mat.emissiveIntensity = 1.0 + bassRatio * 8.0 * globalMultiplier;
            }
        });
        directionalLight.color.lerp(pulseColor, 0.1);

        if (originalPositions) {
            const deformIntensity = 0.3;
            tempoTime += tempoRatio * 2.0 * deltaTime;
            const positionAttribute = object.children[0].geometry.attributes.position;
            for (let i = 0; i < positionAttribute.count; i++) {
                const x = originalPositions.getX(i);
                const y = originalPositions.getY(i);
                const z = originalPositions.getZ(i);
                const displacement = Math.sin(y * 2.0 + tempoTime * 10.0) * bassRatio * deformIntensity * globalMultiplier;
                positionAttribute.setXYZ(i, x + displacement, y, z + displacement);
            }
            positionAttribute.needsUpdate = true;
        }
    }
    
    if (!renderSettings.useAscii) {
        bloomPass.strength = trebleRatio * postProcessingSettings.bloomStrength * globalMultiplier;
        const trebleHit = treble > 150;
        if (trebleHit) {
            // Wobble the controls target for a stable shake
            const wobbleAmount = postProcessingSettings.cameraWobble * 0.1 * globalMultiplier;
            controls.target.x += (Math.random() - 0.5) * wobbleAmount;
            controls.target.y += (Math.random() - 0.5) * wobbleAmount;
        }
    }


    if (renderSettings.useAscii) {
        const gradientCss = `linear-gradient(45deg, ${modelReactivitySettings.pulseColor1}, ${modelReactivitySettings.pulseColor2})`;
        effect.domElement.style.background = gradientCss;
        effect.domElement.style.webkitBackgroundClip = 'text';
        effect.domElement.style.backgroundClip = 'text';
        effect.domElement.style.color = 'transparent';
        
        const bassHit = bass > 140;
        if (bassHit) {
            effect.domElement.style.fontWeight = 'bold';
            if (asciiReactivitySettings.enableShake) {
                const shakeX = (Math.random() - 0.5) * 15 * globalMultiplier;
                const shakeY = (Math.random() - 0.5) * 15 * globalMultiplier;
                asciiTransform += ` translate(${shakeX}px, ${shakeY}px)`;
            }
        } else {
            effect.domElement.style.fontWeight = 'normal';
        }
    }

  } else {
    if (object) {
        targetScale.set(1, 1, 1);
        object.scale.lerp(targetScale, deltaTime * 5);
        materials.forEach(mat => {
            if (mat.emissive) mat.emissive.lerp(new THREE.Color(0x000000), deltaTime * 5);
        });
        directionalLight.color.lerp(new THREE.Color(0xffffff), 0.1);
        if (originalPositions) {
            object.children[0].geometry.attributes.position.copy(originalPositions);
            object.children[0].geometry.attributes.position.needsUpdate = true;
        }
    }
    bloomPass.strength = 0;
    effect.domElement.style.fontWeight = 'normal';
    effect.domElement.style.background = 'none';
    effect.domElement.style.webkitBackgroundClip = 'unset';
    effect.domElement.style.backgroundClip = 'unset';
    effect.domElement.style.color = 'white';
  }

  
  controls.update();
  
  // Smoothly return the target to the center
  controls.target.lerp(new THREE.Vector3(0, 0, 0), deltaTime * 5);


  effect.domElement.style.transform = asciiTransform;

  if (renderSettings.useAscii) {
    effect.render(scene, camera);
  } else {
    composer.render();
  }
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    effect.setSize(window.innerWidth, window.innerHeight);
});