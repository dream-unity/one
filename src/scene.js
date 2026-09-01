import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const WORLD_DATA = {
  machine: {
    title: "DREAM MACHINE",
    subtitle: "PERCEIVE · MODEL · PREDICT",
    color: 0x4e91ef,
    accent: "#4e91ef",
    position: [-3.72, 1.72, 0.05],
    label: [-1.7, 0, 0]
  },
  maker: {
    title: "DREAM MAKER",
    subtitle: "INTEND · ACT · BECOME",
    color: 0x51cabd,
    accent: "#51cabd",
    position: [3.72, 1.72, 0.05],
    label: [1.7, 0, 0]
  },
  world: {
    title: "DREAM WORLD",
    subtitle: "MATTER · STRUCTURE · EMERGE",
    color: 0x9163ed,
    accent: "#9163ed",
    position: [0, -2.05, 0.42],
    label: [0, -1.28, 0]
  }
};

const TAU = Math.PI * 2;
const tempVector = new THREE.Vector3();

function seededRandom(seed = 0x51f15e) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.055, "rgba(255,255,255,.98)");
  gradient.addColorStop(0.16, "rgba(230,235,255,.74)");
  gradient.addColorStop(0.42, "rgba(188,179,255,.18)");
  gradient.addColorStop(1, "rgba(150,150,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeRayTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 512, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.4, "rgba(255,255,255,.08)");
  gradient.addColorStop(0.49, "rgba(255,255,255,.92)");
  gradient.addColorStop(0.51, "rgba(255,255,255,.92)");
  gradient.addColorStop(0.6, "rgba(255,255,255,.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  const vertical = context.createLinearGradient(0, 0, 0, 32);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 32);
  context.globalCompositeOperation = "destination-in";
  vertical.addColorStop(0, "rgba(255,255,255,0)");
  vertical.addColorStop(0.5, "rgba(255,255,255,1)");
  vertical.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = vertical;
  context.fillRect(0, 0, 512, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createVertexColors(geometry, baseColor, random, variation = 0.12) {
  const position = geometry.getAttribute("position");
  const colors = [];
  const base = new THREE.Color(baseColor);

  for (let index = 0; index < position.count; index += 3) {
    const tint = base.clone();
    tint.offsetHSL((random() - 0.5) * variation * 0.25, (random() - 0.5) * variation, (random() - 0.42) * variation);
    for (let vertex = 0; vertex < 3; vertex += 1) colors.push(tint.r, tint.g, tint.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
}

function createLineLoop(radiusX, radiusZ, height, material, segments = 260, phase = 0) {
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * TAU + phase;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radiusX,
      height + Math.sin(angle * 2.0 + phase) * 0.025,
      Math.sin(angle) * radiusZ
    ));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
}

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
}

export class DreamUnityScene {
  constructor(container) {
    this.container = container;
    this.random = seededRandom();
    this.clock = new THREE.Clock();
    this.portals = new Map();
    this.portalLabels = new Map();
    this.interactiveTargets = [];
    this.orbits = [];
    this.motionObjects = [];
    this.pointers = new Map();
    this.selectedWorld = null;
    this.targetRotation = new THREE.Vector2(0.02, 0);
    this.rotationVelocity = new THREE.Vector2();
    this.targetCameraZ = 12.1;
    this.baseCameraZ = 12.1;
    this.focusPoint = new THREE.Vector3(0, 0.15, 0);
    this.bloomPulse = 0;
    this.hasInteracted = false;
    this.dragDistance = 0;
    this.initialPinchDistance = 0;
    this.initialPinchZ = 0;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.maxPixelRatio = /Mobi|Android/i.test(navigator.userAgent) ? 1.35 : 1.85;
    this.frameSamples = [];
    this.lastFrameTime = performance.now();
    this.adapted = false;
    this.destroyed = false;

    this.#initialize();
  }

  #initialize() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f2f7);

    this.camera = new THREE.PerspectiveCamera(39, 1, 0.1, 80);
    this.camera.position.set(0, 0.28, this.targetCameraZ);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false
    });
    this.renderer.setClearColor(0xf0f2f7, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.domElement.setAttribute("aria-label", "Interactive Dream Unity three-world field");
    this.renderer.domElement.tabIndex = 0;
    this.container.append(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = "label-layer";
    this.container.append(this.labelRenderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.76, 0.62, 0.69);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.glowTexture = makeGlowTexture();
    this.rayTexture = makeRayTexture();
    this.#createEnvironment();
    this.#createLights();
    this.#createDistantWorld();

    this.unity = new THREE.Group();
    this.unity.name = "Dream Unity Field";
    this.scene.add(this.unity);

    this.#createUnityField();
    this.#createConstellationNetwork();
    this.#createPlatform();
    this.#createCentralCrystal();
    this.#createPortals();
    this.#createOrbitalSystem();
    this.#createFloatingFragments();
    this.#bindInteraction();
    this.#resize();

    requestAnimationFrame(() => this.#animate());
  }

  #createEnvironment() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#e9ebf4");
    gradient.addColorStop(0.42, "#ffffff");
    gradient.addColorStop(0.58, "#f8f4fb");
    gradient.addColorStop(1, "#cfd9e4");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1024, 512);

    const lights = [
      [160, 190, 150, "rgba(119,179,255,.38)"],
      [520, 150, 190, "rgba(255,255,255,.92)"],
      [820, 210, 170, "rgba(108,231,215,.34)"],
      [655, 350, 110, "rgba(168,123,255,.25)"]
    ];

    lights.forEach(([x, y, radius, color]) => {
      const light = context.createRadialGradient(x, y, 0, x, y, radius);
      light.addColorStop(0, color);
      light.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = light;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTexture = pmrem.fromEquirectangular(texture).texture;
    this.scene.environment = this.environmentTexture;
    texture.dispose();
    pmrem.dispose();
  }

  #createLights() {
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0xaab8cc, 2.15);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xfffbff, 3.0);
    key.position.set(-4, 8, 7);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd8f9ff, 1.8);
    fill.position.set(6, 3, 5);
    this.scene.add(fill);

    const violet = new THREE.PointLight(0x8965ff, 8.5, 12, 2);
    violet.position.set(0, 0.4, 2.1);
    this.scene.add(violet);
  }

  #createDistantWorld() {
    this.scenery = new THREE.Group();
    this.scenery.name = "Material Horizon";
    this.scene.add(this.scenery);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0xe8edf3,
        metalness: 0.42,
        roughness: 0.26,
        transparent: true,
        opacity: 0.74,
        envMapIntensity: 0.75
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -3.22, -3.5);
    this.scenery.add(floor);

    const mountainMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe8ecf2,
      roughness: 0.48,
      metalness: 0.08,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
      envMapIntensity: 0.6
    });

    const mountainData = [
      [-8.6, -2.25, -10, 3.0, 5.2, 1.2],
      [-5.7, -2.7, -11, 2.0, 3.7, 1.0],
      [6.2, -2.45, -11, 2.5, 4.5, 1.1],
      [9.0, -2.25, -10, 3.2, 5.4, 1.25],
      [0, -3.1, -14, 1.2, 2.6, 0.7]
    ];

    mountainData.forEach(([x, y, z, radius, height, depth], index) => {
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 6, 2), mountainMaterial);
      mountain.position.set(x, y, z);
      mountain.scale.z = depth;
      mountain.rotation.y = index * 0.63;
      this.scenery.add(mountain);
    });

    const spireMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdde5ef,
      metalness: 0.38,
      roughness: 0.08,
      transmission: 0.5,
      thickness: 1.3,
      ior: 1.62,
      transparent: true,
      opacity: 0.75,
      envMapIntensity: 1.4
    });

    const spires = [
      [-7.1, -1.85, -1.4, 0.48, 3.1],
      [7.4, -1.82, -1.8, 0.62, 3.5],
      [-6.0, -2.7, 1.0, 0.16, 0.85],
      [6.0, -2.72, 0.2, 0.18, 0.95]
    ];

    spires.forEach(([x, y, z, radius, height], index) => {
      const spire = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius, height * 0.68, 5), spireMaterial);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.62, height * 0.32, 5), spireMaterial);
      body.position.y = -height * 0.16;
      tip.position.y = height * 0.34;
      spire.add(body, tip);
      spire.position.set(x, y, z);
      spire.rotation.y = index * 0.57;
      this.scenery.add(spire);
    });
  }

  #createUnityField() {
    this.field = new THREE.Group();
    this.field.position.y = 0.18;
    this.unity.add(this.field);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(4.18, 64, 40),
      new THREE.MeshPhysicalMaterial({
        color: 0xf7f8ff,
        roughness: 0.08,
        metalness: 0.02,
        transmission: 0.18,
        thickness: 0.22,
        transparent: true,
        opacity: 0.055,
        side: THREE.BackSide,
        depthWrite: false,
        envMapIntensity: 1.1
      })
    );
    shell.renderOrder = -2;
    this.field.add(shell);

    const geodesic = new THREE.IcosahedronGeometry(4.2, 4);
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geodesic),
      new THREE.LineBasicMaterial({
        color: 0x9ca8cb,
        transparent: true,
        opacity: 0.055,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    wire.renderOrder = -1;
    this.field.add(wire);

    const fieldPoints = new THREE.Points(
      geodesic,
      new THREE.PointsMaterial({
        color: 0xc8c8e9,
        size: 0.018,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      })
    );
    this.field.add(fieldPoints);
    const longitudeMaterial = new THREE.LineBasicMaterial({
      color: 0xc2bddf,
      transparent: true,
      opacity: 0.065,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    for (let index = 0; index < 9; index += 1) {
      const loop = createLineLoop(4.23, 4.23, 0, longitudeMaterial, 220, index * 0.13);
      loop.rotation.x = Math.PI / 2;
      loop.rotation.y = (index / 9) * Math.PI;
      this.field.add(loop);
    }
  }

  #createConstellationNetwork() {
    const pointCount = 390;
    const points = [];
    const pointArray = [];
    const colors = [];
    const palette = [new THREE.Color(0x8ab6ef), new THREE.Color(0xb69bf1), new THREE.Color(0x8edbd1)];

    for (let index = 0; index < pointCount; index += 1) {
      const radius = Math.pow(this.random(), 0.72) * 4.0;
      const theta = this.random() * TAU;
      const phi = Math.acos(2 * this.random() - 1);
      const point = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      points.push(point);
      pointArray.push(point.x, point.y, point.z);
      const color = palette[index % palette.length].clone().lerp(new THREE.Color(0xffffff), this.random() * 0.42);
      colors.push(color.r, color.g, color.b);
    }

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(pointArray, 3));
    pointGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const stars = new THREE.Points(
      pointGeometry,
      new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.026,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      })
    );

    const segments = [];
    for (let index = 0; index < points.length; index += 1) {
      let nearest = null;
      let nearestDistance = 1.18;
      const searchLimit = Math.min(points.length, index + 24);
      for (let candidate = index + 1; candidate < searchLimit; candidate += 1) {
        const distance = points[index].distanceTo(points[candidate]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = points[candidate];
        }
      }
      if (nearest) segments.push(points[index].x, points[index].y, points[index].z, nearest.x, nearest.y, nearest.z);
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
    const connections = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({
        color: 0xa6abd1,
        transparent: true,
        opacity: 0.105,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );

    this.constellations = new THREE.Group();
    this.constellations.add(connections, stars);
    this.constellations.position.y = 0.16;
    this.unity.add(this.constellations);
  }

  #createCentralCrystal() {
    this.crystal = new THREE.Group();
    this.crystal.position.set(0, 0.55, 0.1);
    this.unity.add(this.crystal);

    const crystalGeometry = new THREE.OctahedronGeometry(1.52, 3).toNonIndexed();
    const position = crystalGeometry.getAttribute("position");
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const perturbation = 1 + Math.sin(x * 7.31 + y * 4.73 + z * 6.17) * 0.018;
      position.setXYZ(index, x * perturbation * 1.11, y * perturbation * 1.13, z * perturbation * 0.96);
    }
    crystalGeometry.computeVertexNormals();
    createVertexColors(crystalGeometry, 0x765ad3, this.random, 0.3);

    const shell = new THREE.Mesh(
      crystalGeometry,
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.06,
        metalness: 0.08,
        transmission: 0.34,
        thickness: 1.65,
        ior: 1.78,
        dispersion: 0.16,
        iridescence: 0.42,
        iridescenceIOR: 1.38,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        transparent: true,
        opacity: 0.91,
        envMapIntensity: 2.4,
        side: THREE.DoubleSide
      })
    );
    shell.name = "Unity Crystal";
    shell.renderOrder = 3;
    this.crystal.add(shell);

    const inner = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.92, 1),
      new THREE.MeshStandardMaterial({
        color: 0x6c4bc9,
        emissive: new THREE.Color().setRGB(0.64, 0.38, 1.36),
        emissiveIntensity: 2.35,
        roughness: 0.2,
        metalness: 0.08,
        flatShading: true,
        transparent: true,
        opacity: 0.66
      })
    );
    inner.scale.set(1.08, 1.12, 0.94);
    inner.rotation.set(0.18, 0.35, 0.08);
    this.crystal.add(inner);
    this.crystalInner = inner;

    const edgeGeometry = new THREE.WireframeGeometry(new THREE.OctahedronGeometry(1.24, 3));
    const edges = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        color: 0xd9d3ff,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    edges.scale.set(1.1, 1.14, 0.95);
    this.crystal.add(edges);
    this.crystalEdges = edges;

    const flare = this.#createFlare(0xa990ff, 2.75, true);
    flare.position.z = 1.1;
    this.crystal.add(flare);
    this.centralFlare = flare;

    const vertical = this.#createRay(0xb5a5ff, 0.12, 6.8);
    vertical.rotation.z = Math.PI / 2;
    vertical.position.z = 1.18;
    this.crystal.add(vertical);
    const horizontal = this.#createRay(0xc8c1ff, 0.08, 8.8);
    horizontal.position.z = 1.16;
    this.crystal.add(horizontal);

    const coreLight = new THREE.PointLight(0x8a63ff, 9, 8, 2);
    coreLight.position.set(0, 0, 1.4);
    this.crystal.add(coreLight);

    const axisMaterial = new THREE.LineBasicMaterial({
      color: 0xbbaeff,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const axis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -3.85, 0), new THREE.Vector3(0, 4.05, 0)]),
      axisMaterial
    );
    this.crystal.add(axis);

    for (let index = 0; index < 7; index += 1) {
      const bead = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.045 + index * 0.008, 0),
        new THREE.MeshBasicMaterial({
          color: index % 2 ? 0x8e73da : 0xe8e4ff,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      bead.position.y = 1.76 + index * 0.34;
      bead.position.z = 0.03;
      this.crystal.add(bead);
      this.motionObjects.push({ object: bead, baseY: bead.position.y, phase: index * 0.8, amplitude: 0.035 });
    }

    const title = document.querySelector(".intro");
    title?.addEventListener("click", () => this.resetFocus());
  }

  #createPortals() {
    Object.entries(WORLD_DATA).forEach(([key, data], index) => {
      const portal = this.#createPortal(key, data, index);
      portal.position.set(...data.position);
      portal.userData.baseY = data.position[1];
      portal.userData.phase = index * 1.9;
      this.unity.add(portal);
      this.portals.set(key, portal);
    });
  }

  #createPortal(key, data, index) {
    const group = new THREE.Group();
    group.name = data.title;
    group.userData.key = key;
    group.userData.targetScale = 1;

    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(0.83, 40, 28),
      new THREE.MeshPhysicalMaterial({
        color: data.color,
        roughness: 0.04,
        metalness: 0.03,
        transmission: 0.54,
        thickness: 0.78,
        ior: 1.47,
        iridescence: 0.24,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        transparent: true,
        opacity: 0.55,
        envMapIntensity: 2.0,
        depthWrite: false
      })
    );
    outer.renderOrder = 4;
    group.add(outer);

    const innerGeometry = new THREE.IcosahedronGeometry(0.65, 3).toNonIndexed();
    createVertexColors(innerGeometry, data.color, this.random, 0.3);
    const inner = new THREE.Mesh(
      innerGeometry,
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.11,
        metalness: 0.14,
        transmission: 0.14,
        thickness: 0.42,
        clearcoat: 0.8,
        transparent: true,
        opacity: 0.88,
        envMapIntensity: 1.8
      })
    );
    inner.userData.portal = key;
    group.add(inner);
    this.interactiveTargets.push(inner, outer);
    outer.userData.portal = key;

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.69, 2)),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(data.color).lerp(new THREE.Color(0xffffff), 0.62),
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    group.add(wire);

    for (let ringIndex = 0; ringIndex < 5; ringIndex += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.95 + ringIndex * 0.12, 0.006 + ringIndex * 0.0015, 5, 128),
        new THREE.MeshBasicMaterial({
          color: data.color,
          transparent: true,
          opacity: 0.28 - ringIndex * 0.035,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.set(
        (ringIndex - 2) * 0.17,
        (ringIndex % 2 ? 1 : -1) * (0.08 + ringIndex * 0.04),
        ringIndex * 0.13
      );
      ring.userData.spin = (ringIndex % 2 ? 1 : -1) * (0.08 + ringIndex * 0.025);
      group.add(ring);
      group.userData.rings ??= [];
      group.userData.rings.push(ring);
    }

    const flare = this.#createFlare(data.color, 1.76, false);
    flare.position.z = 0.78;
    group.add(flare);
    group.userData.flare = flare;

    const light = new THREE.PointLight(data.color, 5.2, 5.5, 2);
    light.position.z = 0.65;
    group.add(light);

    const label = this.#createPortalLabel(key, data);
    label.position.set(...data.label);
    group.add(label);
    group.userData.label = label;
    this.portalLabels.set(key, label.element);

    group.rotation.z = (index - 1) * 0.035;
    return group;
  }

  #createPortalLabel(key, data) {
    const wrapper = document.createElement("div");
    wrapper.className = `portal-label ${key}`;
    wrapper.innerHTML = `
      <span class="portal-thread" aria-hidden="true"></span>
      <button class="portal-card" type="button" aria-label="Focus ${data.title}">
        <span class="portal-glyph" aria-hidden="true"></span>
        <span class="portal-copy">
          <strong>${data.title}</strong>
          <small>${data.subtitle}</small>
        </span>
      </button>
    `;
    wrapper.querySelector("button").addEventListener("click", (event) => {
      event.stopPropagation();
      this.focusWorld(key);
    });
    return new CSS2DObject(wrapper);
  }

  #createPlatform() {
    this.platform = new THREE.Group();
    this.platform.position.y = -3.02;
    this.unity.add(this.platform);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(4.75, 4.94, 0.18, 128),
      new THREE.MeshPhysicalMaterial({
        color: 0xdce3ec,
        metalness: 0.7,
        roughness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.78,
        envMapIntensity: 1.55
      })
    );
    this.platform.add(base);

    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(4.48, 4.48, 0.055, 128),
      new THREE.MeshPhysicalMaterial({
        color: 0xf7f7ff,
        roughness: 0.04,
        metalness: 0.18,
        transmission: 0.48,
        thickness: 0.28,
        transparent: true,
        opacity: 0.62,
        envMapIntensity: 1.7,
        depthWrite: false
      })
    );
    glass.position.y = 0.12;
    this.platform.add(glass);

    const ringColors = [0xa6b8d6, 0xb09ae5, 0x7ec9d4, 0xd7cdee];
    for (let index = 0; index < 13; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.72 + index * 0.29, 0.008 + (index % 4 === 0 ? 0.008 : 0), 5, 160),
        new THREE.MeshBasicMaterial({
          color: ringColors[index % ringColors.length],
          transparent: true,
          opacity: index % 4 === 0 ? 0.37 : 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.17 + index * 0.001;
      this.platform.add(ring);
    }

    const radialPositions = [];
    for (let index = 0; index < 48; index += 1) {
      const angle = (index / 48) * TAU;
      radialPositions.push(
        Math.cos(angle) * 0.65, 0.18, Math.sin(angle) * 0.65,
        Math.cos(angle) * 4.28, 0.18, Math.sin(angle) * 4.28
      );
    }
    const radialGeometry = new THREE.BufferGeometry();
    radialGeometry.setAttribute("position", new THREE.Float32BufferAttribute(radialPositions, 3));
    this.platform.add(new THREE.LineSegments(
      radialGeometry,
      new THREE.LineBasicMaterial({
        color: 0xb8addb,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    ));

    const projection = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 1.38, 2.0, 64, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x9977eb,
        transparent: true,
        opacity: 0.035,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    projection.position.y = 1.14;
    this.platform.add(projection);
  }

  #createOrbitalSystem() {
    const paths = [
      {
        color: 0x4e92ef,
        speed: 0.028,
        phase: 0.02,
        points: [
          [-4.35, 1.65, 0.2], [-2.6, 3.12, -0.42], [0.1, 2.15, 0.8],
          [3.7, 0.25, 0.1], [1.45, -2.48, 0.68], [-2.92, -1.35, -0.18]
        ]
      },
      {
        color: 0x54cfc0,
        speed: -0.023,
        phase: 0.34,
        points: [
          [4.35, 1.67, 0.12], [2.5, 3.1, -0.3], [-0.15, 2.05, 0.82],
          [-3.6, 0.2, -0.08], [-1.48, -2.52, 0.78], [3.0, -1.28, -0.1]
        ]
      },
      {
        color: 0x9565ea,
        speed: 0.019,
        phase: 0.68,
        points: [
          [-3.62, 1.08, 0.9], [-2.4, -1.92, 0.26], [0, -2.48, 0.58],
          [2.5, -1.82, 0.16], [3.6, 1.04, 0.82], [0, 0.62, -1.05]
        ]
      }
    ];

    paths.forEach((path, index) => this.#createOrbit(path, index));

    const ringGroup = new THREE.Group();
    ringGroup.position.y = 0.26;
    ringGroup.rotation.set(0.08, 0.02, -0.025);
    this.unity.add(ringGroup);
    this.saturnRings = ringGroup;

    for (let index = 0; index < 19; index += 1) {
      const radius = 1.95 + index * 0.13;
      const line = createLineLoop(
        radius,
        radius * (0.31 + index * 0.004),
        (index - 9) * 0.012,
        new THREE.LineBasicMaterial({
          color: index % 3 === 0 ? 0xc2aaf1 : 0xd9d8e7,
          transparent: true,
          opacity: index % 3 === 0 ? 0.23 : 0.105,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        }),
        300,
        index * 0.07
      );
      ringGroup.add(line);
    }
  }

  #createOrbit(path, index) {
    const curve = new THREE.CatmullRomCurve3(
      path.points.map((point) => new THREE.Vector3(...point)),
      true,
      "centripetal",
      0.45
    );
    const group = new THREE.Group();
    group.name = `Causal Orbit ${index + 1}`;
    this.unity.add(group);

    const aura = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 360, 0.032, 6, true),
      new THREE.MeshBasicMaterial({
        color: path.color,
        transparent: true,
        opacity: 0.09,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    group.add(aura);

    const filament = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 360, 0.008, 5, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(path.color).lerp(new THREE.Color(0xffffff), 0.42),
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    group.add(filament);

    const particleCount = 94;
    const positions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    for (let particle = 0; particle < particleCount; particle += 1) {
      phases[particle] = (particle / particleCount + this.random() * 0.018) % 1;
      const point = curve.getPointAt(phases[particle]);
      positions.set([point.x, point.y, point.z], particle * 3);
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: new THREE.Color(path.color).lerp(new THREE.Color(0xffffff), 0.5),
        size: 0.042,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      })
    );
    group.add(particles);

    this.orbits.push({ curve, group, particles, phases, speed: path.speed, phase: path.phase });
  }

  #createFloatingFragments() {
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xdad7f0,
      roughness: 0.08,
      metalness: 0.22,
      transmission: 0.46,
      thickness: 0.35,
      transparent: true,
      opacity: 0.72,
      envMapIntensity: 1.4
    });

    const placements = [
      [-5.1, -1.9, 0.4, 0.14], [5.25, -2.05, -0.1, 0.11], [-4.75, 0.2, -2.2, 0.08],
      [4.85, 0.55, -2.4, 0.09], [-2.3, -2.62, 1.4, 0.12], [2.55, -2.61, 1.2, 0.09],
      [-1.82, 3.45, -0.3, 0.07], [1.96, 3.38, 0.2, 0.06]
    ];

    placements.forEach(([x, y, z, size], index) => {
      const fragment = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), material);
      fragment.scale.y = 1.65;
      fragment.position.set(x, y, z);
      fragment.rotation.set(index * 0.41, index * 0.73, index * 0.19);
      this.unity.add(fragment);
      this.motionObjects.push({
        object: fragment,
        baseY: y,
        phase: index * 0.71,
        amplitude: 0.045 + (index % 3) * 0.012,
        spin: 0.04 + index * 0.003
      });
    });
  }

  #createFlare(color, scale, strong) {
    const group = new THREE.Group();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color,
      transparent: true,
      opacity: strong ? 0.94 : 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    }));
    sprite.scale.set(scale, scale, 1);
    group.add(sprite);

    const rayX = this.#createRay(color, strong ? 0.11 : 0.065, scale * 3.1);
    rayX.position.z = 0.03;
    const rayY = this.#createRay(color, strong ? 0.1 : 0.052, scale * 2.25);
    rayY.rotation.z = Math.PI / 2;
    rayY.position.z = 0.02;
    group.add(rayX, rayY);
    return group;
  }

  #createRay(color, opacity, length) {
    const material = new THREE.SpriteMaterial({
      map: this.rayTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    });
    const ray = new THREE.Sprite(material);
    ray.scale.set(length, Math.max(0.05, length * 0.055), 1);
    return ray;
  }

  #bindInteraction() {
    this.onResize = () => this.#resize();
    this.onPointerDown = (event) => this.#pointerDown(event);
    this.onPointerMove = (event) => this.#pointerMove(event);
    this.onPointerUp = (event) => this.#pointerUp(event);
    this.onWheel = (event) => this.#wheel(event);
    this.onKeyDown = (event) => this.#keyDown(event);
    window.addEventListener("resize", this.onResize, { passive: true });
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.onPointerUp);
    this.renderer.domElement.addEventListener("wheel", this.onWheel, { passive: false });
    this.renderer.domElement.addEventListener("keydown", this.onKeyDown);
  }

  #pointerDown(event) {
    this.hasInteracted = true;
    this.dragDistance = 0;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
    this.container.classList.add("is-dragging");

    if (this.pointers.size === 2) {
      const pointers = [...this.pointers.values()];
      this.initialPinchDistance = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
      this.initialPinchZ = this.targetCameraZ;
    }
  }

  #pointerMove(event) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    this.dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

    if (this.pointers.size === 1) {
      this.targetRotation.y += deltaX * 0.0042;
      this.targetRotation.x = THREE.MathUtils.clamp(this.targetRotation.x + deltaY * 0.0024, -0.32, 0.32);
      this.rotationVelocity.set(deltaY * 0.0007, deltaX * 0.00115);
    } else if (this.pointers.size === 2) {
      const pointers = [...this.pointers.values()];
      const distance = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
      const ratio = this.initialPinchDistance / Math.max(distance, 1);
      this.targetCameraZ = THREE.MathUtils.clamp(this.initialPinchZ * ratio, this.baseCameraZ * 0.76, this.baseCameraZ * 1.32);
    }
  }

  #pointerUp(event) {
    const pointer = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 0) this.container.classList.remove("is-dragging");
    if (pointer && this.dragDistance < 8) this.#pick(event);
  }

  #pick(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hit = raycaster.intersectObjects(this.interactiveTargets, false)[0];
    if (hit?.object.userData.portal) this.focusWorld(hit.object.userData.portal);
  }

  #wheel(event) {
    event.preventDefault();
    this.hasInteracted = true;
    this.targetCameraZ = THREE.MathUtils.clamp(
      this.targetCameraZ + event.deltaY * 0.0045,
      this.baseCameraZ * 0.76,
      this.baseCameraZ * 1.32
    );
  }

  #keyDown(event) {
    const step = 0.13;
    if (event.key === "ArrowLeft") this.targetRotation.y -= step;
    if (event.key === "ArrowRight") this.targetRotation.y += step;
    if (event.key === "ArrowUp") this.targetRotation.x = Math.max(-0.32, this.targetRotation.x - step * 0.5);
    if (event.key === "ArrowDown") this.targetRotation.x = Math.min(0.32, this.targetRotation.x + step * 0.5);
    if (event.key === "Escape") this.resetFocus();
  }

  focusWorld(key) {
    if (!WORLD_DATA[key]) return;
    this.selectedWorld = key;
    this.bloomPulse = 1;
    this.hasInteracted = true;
    this.portals.forEach((portal, portalKey) => {
      portal.userData.targetScale = portalKey === key ? 1.19 : 0.92;
      this.portalLabels.get(portalKey)?.classList.toggle("is-active", portalKey === key);
    });
    window.dispatchEvent(new CustomEvent("dreamunity:worldfocus", { detail: { key, ...WORLD_DATA[key] } }));
  }

  resetFocus() {
    this.selectedWorld = null;
    this.bloomPulse = 0.38;
    this.portals.forEach((portal, key) => {
      portal.userData.targetScale = 1;
      this.portalLabels.get(key)?.classList.remove("is-active");
    });
    window.dispatchEvent(new CustomEvent("dreamunity:unityfocus"));
  }

  #resize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const aspect = width / height;
    this.baseCameraZ = aspect < 0.72 ? 15.7 : aspect < 1.0 ? 13.8 : aspect > 2 ? 12.8 : 12.1;
    if (!this.hasInteracted) this.targetCameraZ = this.baseCameraZ;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.72 ? 43 : 39;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio));
    this.composer.setSize(width, height);
    this.bloom.radius = aspect < 0.72 ? 0.5 : 0.62;

    const mobile = width < 650;
    const compact = width < 900;
    this.unity.scale.setScalar(mobile ? 0.77 : compact ? 0.9 : 1);
    Object.entries(WORLD_DATA).forEach(([key, data]) => {
      const label = this.portals.get(key)?.userData.label;
      if (!label) return;
      if (mobile && key === "machine") label.position.set(1.48, -0.2, 0);
      else if (mobile && key === "maker") label.position.set(-1.48, -0.2, 0);
      else if (mobile && key === "world") label.position.set(0, -1.18, 0);
      else label.position.set(...data.label);
    });
  }

  #adaptQuality(now) {
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    if (delta > 0 && delta < 120) this.frameSamples.push(delta);
    if (this.frameSamples.length < 150 || this.adapted) return;
    const average = this.frameSamples.reduce((sum, value) => sum + value, 0) / this.frameSamples.length;
    if (average > 24 && this.maxPixelRatio > 1.05) {
      this.maxPixelRatio = 1;
      this.#resize();
      document.getElementById("calibration-status")?.replaceChildren("ADAPTIVE");
    }
    this.adapted = true;
    this.frameSamples.length = 0;
  }

  #animate() {
    if (this.destroyed) return;
    requestAnimationFrame(() => this.#animate());
    const elapsed = this.clock.getElapsedTime();
    const now = performance.now();
    this.#adaptQuality(now);

    if (!this.hasInteracted && !this.reducedMotion) {
      this.targetRotation.y = Math.sin(elapsed * 0.105) * 0.075;
      this.targetRotation.x = 0.015 + Math.sin(elapsed * 0.071) * 0.018;
    } else if (this.pointers.size === 0) {
      this.targetRotation.x += this.rotationVelocity.x;
      this.targetRotation.y += this.rotationVelocity.y;
      this.rotationVelocity.multiplyScalar(0.94);
      this.targetRotation.x = THREE.MathUtils.clamp(this.targetRotation.x, -0.32, 0.32);
    }

    this.unity.rotation.x = THREE.MathUtils.lerp(this.unity.rotation.x, this.targetRotation.x, 0.045);
    this.unity.rotation.y = THREE.MathUtils.lerp(this.unity.rotation.y, this.targetRotation.y, 0.045);

    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this.targetCameraZ, 0.07);
    const desiredFocus = new THREE.Vector3(0, 0.14, 0);
    if (this.selectedWorld) {
      const portal = this.portals.get(this.selectedWorld);
      portal.getWorldPosition(tempVector);
      desiredFocus.x = tempVector.x * 0.1;
      desiredFocus.y = 0.14 + tempVector.y * 0.075;
    }
    this.focusPoint.lerp(desiredFocus, 0.045);
    this.camera.lookAt(this.focusPoint);

    if (!this.reducedMotion) {
      this.crystal.rotation.y += 0.0012;
      this.crystalInner.rotation.y -= 0.0032;
      this.crystalInner.rotation.x = 0.18 + Math.sin(elapsed * 0.31) * 0.035;
      this.crystalEdges.rotation.y += 0.0017;
      this.field.rotation.y += 0.00012;
      this.constellations.rotation.y -= 0.00018;
      this.saturnRings.rotation.y += 0.0002;
    }

    const corePulse = 1 + Math.sin(elapsed * 1.12) * 0.045;
    this.centralFlare.scale.setScalar(corePulse);

    this.portals.forEach((portal) => {
      const phase = portal.userData.phase;
      if (!this.reducedMotion) {
        portal.position.y = portal.userData.baseY + Math.sin(elapsed * 0.58 + phase) * 0.055;
        portal.rotation.y += 0.0017 + phase * 0.0001;
        portal.userData.rings.forEach((ring, index) => {
          ring.rotation.z += ring.userData.spin * 0.006;
          ring.rotation.x += Math.sin(elapsed * 0.21 + index) * 0.00035;
        });
      }
      const currentScale = portal.scale.x;
      const nextScale = THREE.MathUtils.lerp(currentScale, portal.userData.targetScale, 0.08);
      portal.scale.setScalar(nextScale);
      portal.userData.flare.scale.setScalar(1 + Math.sin(elapsed * 1.25 + phase) * 0.06);
    });

    this.orbits.forEach((orbit) => {
      const positions = orbit.particles.geometry.getAttribute("position");
      for (let particle = 0; particle < orbit.phases.length; particle += 1) {
        const phase = (orbit.phases[particle] + elapsed * orbit.speed + orbit.phase + 1) % 1;
        const point = orbit.curve.getPointAt(phase);
        positions.setXYZ(particle, point.x, point.y, point.z);
      }
      positions.needsUpdate = true;
    });

    this.motionObjects.forEach(({ object, baseY, phase, amplitude, spin }) => {
      if (!this.reducedMotion) {
        object.position.y = baseY + Math.sin(elapsed * 0.43 + phase) * amplitude;
        if (spin) object.rotation.y += spin * 0.01;
      }
    });

    this.bloomPulse *= 0.94;
    this.bloom.strength = 0.72 + Math.sin(elapsed * 0.72) * 0.045 + this.bloomPulse * 0.34;
    const harmony = Math.round(98 + Math.sin(elapsed * 0.33) * 2);
    const harmonyNode = document.getElementById("harmony-value");
    if (harmonyNode && harmonyNode.textContent !== `${harmony}%`) harmonyNode.textContent = `${harmony}%`;

    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);

    if (!this.firstFrameRendered) {
      this.firstFrameRendered = true;
      window.dispatchEvent(new CustomEvent("dreamunity:ready"));
    }
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointercancel", this.onPointerUp);
    this.renderer.domElement.removeEventListener("wheel", this.onWheel);
    this.renderer.domElement.removeEventListener("keydown", this.onKeyDown);
    disposeObject(this.scene);
    this.environmentTexture?.dispose();
    this.glowTexture?.dispose();
    this.rayTexture?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();
    this.container.replaceChildren();
  }
}

export { WORLD_DATA };
