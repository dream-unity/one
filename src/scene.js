import * as THREE from "three";

const TAU = Math.PI * 2;

const WORLD_DATA = {
  machine: {
    title: "DREAM MACHINE",
    subtitle: "PERCEIVE · MODEL · PREDICT",
    color: 0x3f8fe8,
    position: [-4.35, 1.67, 0.05]
  },
  maker: {
    title: "DREAM MAKER",
    subtitle: "INTEND · ACT · BECOME",
    color: 0x45c7b7,
    position: [4.35, 1.67, 0.05]
  },
  world: {
    title: "DREAM WORLD",
    subtitle: "MATTER · STRUCTURE · EMERGE",
    color: 0x8859e8,
    position: [0, -2.38, 0.34]
  }
};

function randomGenerator(seed = 0x44d2b1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function detectProfile() {
  const mobile = matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const constrained = mobile || memory <= 4 || cores <= 4;

  return {
    name: constrained ? "balanced" : "high",
    mobile,
    antialias: !constrained,
    pixelRatio: constrained ? 1 : 1.35,
    fieldDetail: constrained ? 2 : 3,
    facetDetail: constrained ? 1 : 2,
    portalDetail: constrained ? 1 : 2,
    curveSegments: constrained ? 84 : 128,
    constellationPoints: constrained ? 135 : 220,
    orbitParticles: constrained ? 34 : 58,
    platformSegments: constrained ? 48 : 72
  };
}

function createGlowTexture(size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.06, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(247,245,255,.85)");
  gradient.addColorStop(0.42, "rgba(188,176,255,.28)");
  gradient.addColorStop(1, "rgba(135,142,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRayTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  const horizontal = context.createLinearGradient(0, 0, 256, 0);
  horizontal.addColorStop(0, "rgba(255,255,255,0)");
  horizontal.addColorStop(0.42, "rgba(255,255,255,.12)");
  horizontal.addColorStop(0.5, "rgba(255,255,255,1)");
  horizontal.addColorStop(0.58, "rgba(255,255,255,.12)");
  horizontal.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = horizontal;
  context.fillRect(0, 0, 256, 16);
  context.globalCompositeOperation = "destination-in";
  const vertical = context.createLinearGradient(0, 0, 0, 16);
  vertical.addColorStop(0, "rgba(255,255,255,0)");
  vertical.addColorStop(0.5, "rgba(255,255,255,1)");
  vertical.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = vertical;
  context.fillRect(0, 0, 256, 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function applyFacetColors(geometry, baseColor, random, spread = 0.24) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute("position");
  const colors = [];
  const base = new THREE.Color(baseColor);
  const white = new THREE.Color(0xf7f4ff);
  const navy = new THREE.Color(0x271a67);

  for (let index = 0; index < position.count; index += 3) {
    const selector = random();
    const faceColor = base.clone();
    if (selector > 0.78) faceColor.lerp(white, 0.35 + random() * 0.35);
    else if (selector < 0.2) faceColor.lerp(navy, 0.28 + random() * 0.32);
    else faceColor.offsetHSL((random() - 0.5) * 0.045, (random() - 0.5) * spread, (random() - 0.5) * spread);
    for (let vertex = 0; vertex < 3; vertex += 1) colors.push(faceColor.r, faceColor.g, faceColor.b);
  }

  source.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  source.computeVertexNormals();
  return source;
}

function createSegmentsFromLoops(loopDefinitions, segments) {
  const positions = [];
  const colors = [];
  loopDefinitions.forEach(({ radiusX, radiusZ, y = 0, color = 0xffffff, tilt = 0, phase = 0 }) => {
    const tint = new THREE.Color(color);
    for (let index = 0; index < segments; index += 1) {
      const a = phase + (index / segments) * TAU;
      const b = phase + ((index + 1) / segments) * TAU;
      const point = (angle) => {
        const x = Math.cos(angle) * radiusX;
        const z = Math.sin(angle) * radiusZ;
        return [x, y + z * Math.sin(tilt), z * Math.cos(tilt)];
      };
      positions.push(...point(a), ...point(b));
      for (let vertex = 0; vertex < 2; vertex += 1) colors.push(tint.r, tint.g, tint.b);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function disposeTree(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
}

export class DreamUnityScene {
  constructor(container) {
    this.container = container;
    this.profile = detectProfile();
    this.random = randomGenerator();
    this.clock = new THREE.Clock();
    this.portals = new Map();
    this.interactive = [];
    this.orbits = [];
    this.floaters = [];
    this.pointers = new Map();
    this.targetRotation = new THREE.Vector2(0.015, 0);
    this.targetScale = 1;
    this.baseScale = 1;
    this.selectedWorld = null;
    this.dragDistance = 0;
    this.pinchDistance = 0;
    this.pinchScale = 1;
    this.lastInteraction = performance.now();
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.paused = false;
    this.destroyed = false;
    this.frame = 0;
    this.lastMetricTime = performance.now();
    this.metricFrames = 0;
    this.fps = 60;
    this.adapted = false;
    this.lowFpsSamples = 0;
    this.animateOrbitParticles = true;

    this.#initialize();
  }

  #initialize() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    this.cameraTarget = new THREE.Vector3(0, -0.42, 0);
    this.camera.position.set(0, 1.2, 12.8);
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: this.profile.antialias,
      powerPreference: "high-performance",
      precision: "mediump",
      stencil: false,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false
    });
    this.renderer.setClearColor(0xf5f6fa, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.profile.pixelRatio));
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute("aria-label", "Interactive Dream Unity three-world field");
    this.container.append(this.renderer.domElement);

    this.glowTexture = createGlowTexture();
    this.rayTexture = createRayTexture();

    this.#createLights();
    this.#createScenery();

    this.system = new THREE.Group();
    this.system.name = "Dream Unity System";
    this.scene.add(this.system);

    this.#createField();
    this.#createConstellations();
    this.#createPlatform();
    this.#createCore();
    this.#createPortals();
    this.#createOrbits();
    this.#createFragments();
    this.#bindInteraction();
    this.#resize();
    this.#render();
    this.animationFrame = requestAnimationFrame((time) => this.#animate(time));
  }

  #createLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.65));

    const key = new THREE.DirectionalLight(0xffffff, 2.7);
    key.position.set(-4, 7, 8);
    this.scene.add(key);

    const cool = new THREE.DirectionalLight(0xbfeaff, 1.5);
    cool.position.set(6, 2, 5);
    this.scene.add(cool);

    const violet = new THREE.PointLight(0x8761ff, 3.4, 9, 2);
    violet.position.set(0, 0.65, 2.4);
    this.scene.add(violet);
  }

  #createScenery() {
    this.scenery = new THREE.Group();
    this.scene.add(this.scenery);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 24),
      new THREE.MeshLambertMaterial({ color: 0xe9edf4, transparent: true, opacity: 0.78 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -3.18, -4.2);
    this.scenery.add(floor);

    const mountainMaterial = new THREE.MeshLambertMaterial({
      color: 0xe1e6ee,
      transparent: true,
      opacity: 0.78,
      flatShading: true
    });
    const mountains = [
      [-8.6, -2.3, -10, 3.0, 4.8], [-5.9, -2.65, -11, 2.1, 3.4],
      [6.1, -2.55, -11, 2.3, 3.8], [8.9, -2.25, -10, 3.1, 5.1]
    ];
    mountains.forEach(([x, y, z, radius, height], index) => {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5, 1), mountainMaterial);
      mesh.position.set(x, y, z);
      mesh.scale.z = 0.72;
      mesh.rotation.y = index * 0.61;
      this.scenery.add(mesh);
    });

    const crystalMaterial = new THREE.MeshPhongMaterial({
      color: 0xc9d5e7,
      specular: 0xffffff,
      shininess: 110,
      transparent: true,
      opacity: 0.68,
      flatShading: true
    });
    const spires = [[-7.15, -1.85, -1.8, 0.43, 3.1], [7.25, -1.72, -2.0, 0.56, 3.55], [-5.8, -2.6, 0.3, 0.15, 0.9], [5.95, -2.6, 0.2, 0.18, 1.0]];
    spires.forEach(([x, y, z, radius, height], index) => {
      const spire = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), crystalMaterial);
      spire.position.set(x, y, z);
      spire.rotation.y = index * 0.72;
      this.scenery.add(spire);
    });
  }

  #createField() {
    this.field = new THREE.Group();
    this.field.position.y = 0.2;
    this.system.add(this.field);

    const fieldGeometry = new THREE.IcosahedronGeometry(4.22, this.profile.fieldDetail);
    const fieldWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(fieldGeometry),
      new THREE.LineBasicMaterial({
        color: 0xa8acd1,
        transparent: true,
        opacity: 0.11,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.field.add(fieldWire);

    const fieldDots = new THREE.Points(
      fieldGeometry,
      new THREE.PointsMaterial({
        color: 0xb5b9db,
        size: 0.026,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.field.add(fieldDots);

    const longitudeLoops = [];
    for (let index = 0; index < 7; index += 1) {
      longitudeLoops.push({
        radiusX: 4.23,
        radiusZ: 4.23,
        y: 0,
        tilt: Math.PI / 2,
        phase: index * 0.19,
        color: index % 2 ? 0xc9c3df : 0xb5c4dc
      });
    }
    const longitudes = new THREE.LineSegments(
      createSegmentsFromLoops(longitudeLoops, this.profile.mobile ? 56 : 88),
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.field.add(longitudes);

    const halo = this.#glowSprite(0xc8c5ed, 9.2, 0.16);
    halo.position.z = -1.5;
    this.field.add(halo);
  }

  #createConstellations() {
    const points = [];
    const colors = [];
    const connections = [];
    const palette = [new THREE.Color(0x6da6eb), new THREE.Color(0x9a77e7), new THREE.Color(0x6fcbbf)];

    for (let index = 0; index < this.profile.constellationPoints; index += 1) {
      const radius = Math.pow(this.random(), 0.65) * 3.92;
      const theta = this.random() * TAU;
      const phi = Math.acos(this.random() * 2 - 1);
      const point = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi) + 0.2,
        radius * Math.sin(phi) * Math.sin(theta)
      );
      points.push(point);
      const tint = palette[index % palette.length].clone().lerp(new THREE.Color(0xffffff), 0.25 + this.random() * 0.3);
      colors.push(tint.r, tint.g, tint.b);
    }

    for (let index = 0; index < points.length; index += 1) {
      let closest = null;
      let distance = 1.22;
      for (let candidate = index + 1; candidate < Math.min(points.length, index + 13); candidate += 1) {
        const candidateDistance = points[index].distanceTo(points[candidate]);
        if (candidateDistance < distance) {
          closest = points[candidate];
          distance = candidateDistance;
        }
      }
      if (closest) connections.push(points[index].x, points[index].y, points[index].z, closest.x, closest.y, closest.z);
    }

    const pointsGeometry = new THREE.BufferGeometry().setFromPoints(points);
    pointsGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.constellations = new THREE.Points(
      pointsGeometry,
      new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.035,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.system.add(this.constellations);

    const connectionGeometry = new THREE.BufferGeometry();
    connectionGeometry.setAttribute("position", new THREE.Float32BufferAttribute(connections, 3));
    this.system.add(new THREE.LineSegments(
      connectionGeometry,
      new THREE.LineBasicMaterial({ color: 0x929ac4, transparent: true, opacity: 0.16, depthWrite: false })
    ));
  }

  #createPlatform() {
    this.platform = new THREE.Group();
    this.platform.position.y = -3.0;
    this.system.add(this.platform);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(4.62, 4.87, 0.18, this.profile.platformSegments),
      new THREE.MeshPhongMaterial({ color: 0xd5dce9, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.88 })
    );
    this.platform.add(base);

    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(4.36, 4.45, 0.045, this.profile.platformSegments),
      new THREE.MeshBasicMaterial({ color: 0xf7f4ff, transparent: true, opacity: 0.35, depthWrite: false })
    );
    glass.position.y = 0.12;
    this.platform.add(glass);

    const loops = [];
    for (let index = 0; index < 13; index += 1) {
      loops.push({
        radiusX: 0.68 + index * 0.29,
        radiusZ: 0.68 + index * 0.29,
        y: 0.17,
        color: index % 3 === 0 ? 0x9679de : index % 3 === 1 ? 0x74b7df : 0x82c9c2
      });
    }
    const ringGeometry = createSegmentsFromLoops(loops, this.profile.mobile ? 56 : 88);
    const radialPositions = [];
    const radialColors = [];
    for (let index = 0; index < 36; index += 1) {
      const angle = (index / 36) * TAU;
      radialPositions.push(Math.cos(angle) * 0.55, 0.175, Math.sin(angle) * 0.55, Math.cos(angle) * 4.18, 0.175, Math.sin(angle) * 4.18);
      for (let vertex = 0; vertex < 2; vertex += 1) radialColors.push(0.62, 0.59, 0.81);
    }
    const existingPosition = Array.from(ringGeometry.getAttribute("position").array);
    const existingColors = Array.from(ringGeometry.getAttribute("color").array);
    ringGeometry.setAttribute("position", new THREE.Float32BufferAttribute([...existingPosition, ...radialPositions], 3));
    ringGeometry.setAttribute("color", new THREE.Float32BufferAttribute([...existingColors, ...radialColors], 3));
    this.platform.add(new THREE.LineSegments(
      ringGeometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false })
    ));

    const platformGlow = new THREE.Mesh(
      new THREE.CircleGeometry(4.18, this.profile.platformSegments),
      new THREE.MeshBasicMaterial({
        color: 0xa489f0,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    platformGlow.rotation.x = -Math.PI / 2;
    platformGlow.position.y = 0.15;
    this.platform.add(platformGlow);
  }

  #createCore() {
    this.core = new THREE.Group();
    this.core.position.set(0, 0.58, 0.18);
    this.system.add(this.core);

    const outerGeometry = applyFacetColors(
      new THREE.OctahedronGeometry(1.66, this.profile.facetDetail),
      0x6942c7,
      this.random,
      0.34
    );
    const outer = new THREE.Mesh(
      outerGeometry,
      new THREE.MeshPhongMaterial({
        vertexColors: true,
        flatShading: true,
        specular: 0xffffff,
        shininess: 120,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
      })
    );
    outer.scale.set(1.12, 1.09, 0.93);
    outer.name = "Unity Crystal";
    this.core.add(outer);

    const inner = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.18, 0),
      new THREE.MeshPhongMaterial({
        color: 0x44208f,
        emissive: 0x2d106c,
        emissiveIntensity: 0.95,
        specular: 0xe5d9ff,
        shininess: 100,
        flatShading: true,
        transparent: true,
        opacity: 0.94
      })
    );
    inner.scale.set(1.13, 1.12, 0.9);
    inner.rotation.set(0.13, 0.29, 0.05);
    this.core.add(inner);
    this.coreInner = inner;

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.OctahedronGeometry(1.7, this.profile.facetDetail)),
      new THREE.LineBasicMaterial({ color: 0xe6dfff, transparent: true, opacity: 0.44, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    wire.scale.set(1.12, 1.09, 0.93);
    this.core.add(wire);
    this.coreWire = wire;

    const glow = this.#glowSprite(0x9a78ff, 4.7, 0.9);
    glow.position.z = 0.75;
    this.core.add(glow);
    this.coreGlow = glow;
    this.core.add(this.#raySprite(0xc5b6ff, 7.4, 0.13, false));
    this.core.add(this.#raySprite(0xc5b6ff, 5.8, 0.11, true));

    const axisGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -3.7, 0.05), new THREE.Vector3(0, 3.8, 0.05)]);
    this.core.add(new THREE.Line(axisGeometry, new THREE.LineBasicMaterial({ color: 0xac95ed, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending })));

    for (let index = 0; index < 6; index += 1) {
      const bead = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.045 + index * 0.006, 0),
        new THREE.MeshBasicMaterial({ color: index % 2 ? 0xffffff : 0x9a79e2, transparent: true, opacity: 0.88 })
      );
      bead.position.y = 1.85 + index * 0.35;
      bead.userData.baseY = bead.position.y;
      this.core.add(bead);
      this.floaters.push({ object: bead, phase: index * 0.8, amplitude: 0.035 });
    }
  }

  #createPortals() {
    Object.entries(WORLD_DATA).forEach(([key, data], index) => {
      const portal = new THREE.Group();
      portal.name = data.title;
      portal.position.set(...data.position);
      portal.userData.baseY = data.position[1];
      portal.userData.phase = index * 2.1;
      portal.userData.targetScale = 1;

      const geometry = applyFacetColors(
        new THREE.IcosahedronGeometry(0.73, this.profile.portalDetail),
        data.color,
        this.random,
        0.28
      );
      const sphere = new THREE.Mesh(
        geometry,
        new THREE.MeshPhongMaterial({
          vertexColors: true,
          flatShading: true,
          specular: 0xffffff,
          shininess: 105,
          transparent: true,
          opacity: 0.96
        })
      );
      sphere.userData.world = key;
      portal.add(sphere);
      this.interactive.push(sphere);

      const inner = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.52, 1),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(data.color).multiplyScalar(0.55), transparent: true, opacity: 0.68, wireframe: true })
      );
      inner.rotation.set(0.2, 0.3, 0.1);
      portal.add(inner);

      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.86, this.profile.mobile ? 18 : 26, this.profile.mobile ? 12 : 18),
        new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      shell.userData.world = key;
      portal.add(shell);
      this.interactive.push(shell);

      const rings = [];
      for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.96 + ringIndex * 0.12, 0.009, 4, this.profile.mobile ? 54 : 80),
          new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.46 - ringIndex * 0.1, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.rotation.set((ringIndex - 1) * 0.2, (ringIndex % 2 ? 1 : -1) * 0.12, ringIndex * 0.15);
        ring.userData.speed = (ringIndex % 2 ? 1 : -1) * (0.15 + ringIndex * 0.05);
        ring.userData.baseRotationZ = ring.rotation.z;
        rings.push(ring);
        portal.add(ring);
      }
      portal.userData.rings = rings;

      const glow = this.#glowSprite(data.color, 2.55, 0.78);
      glow.position.z = 0.65;
      portal.add(glow);
      portal.userData.glow = glow;
      portal.add(this.#raySprite(data.color, 3.7, 0.1, false));
      portal.add(this.#raySprite(data.color, 2.8, 0.075, true));

      this.portals.set(key, portal);
      this.system.add(portal);
    });
  }

  #createOrbits() {
    const definitions = [
      {
        color: 0x438ee9,
        speed: 0.026,
        points: [[-4.15, 1.6, 0.1], [-2.5, 3.02, -0.35], [0, 2.0, 0.72], [3.55, 0.18, 0.1], [1.45, -2.45, 0.56], [-2.9, -1.28, -0.12]]
      },
      {
        color: 0x45c8ba,
        speed: -0.022,
        points: [[4.15, 1.62, 0.1], [2.45, 3.0, -0.28], [0, 2.03, 0.78], [-3.55, 0.2, 0.05], [-1.42, -2.46, 0.62], [2.95, -1.22, -0.08]]
      },
      {
        color: 0x8859e8,
        speed: 0.018,
        points: [[-3.58, 1.06, 0.7], [-2.34, -1.75, 0.18], [0, -2.48, 0.48], [2.38, -1.74, 0.16], [3.58, 1.08, 0.68], [0, 0.54, -0.92]]
      }
    ];

    definitions.forEach((definition, orbitIndex) => {
      const curve = new THREE.CatmullRomCurve3(
        definition.points.map((point) => new THREE.Vector3(...point)),
        true,
        "centripetal",
        0.42
      );
      const group = new THREE.Group();
      group.name = `Possibility Orbit ${orbitIndex + 1}`;

      const aura = new THREE.Mesh(
        new THREE.TubeGeometry(curve, this.profile.curveSegments, 0.045, 3, true),
        new THREE.MeshBasicMaterial({ color: definition.color, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      group.add(aura);

      const filament = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(this.profile.curveSegments * 2)),
        new THREE.LineBasicMaterial({ color: new THREE.Color(definition.color).lerp(new THREE.Color(0xffffff), 0.35), transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      group.add(filament);

      const positions = new Float32Array(this.profile.orbitParticles * 3);
      const phases = new Float32Array(this.profile.orbitParticles);
      for (let index = 0; index < phases.length; index += 1) {
        phases[index] = index / phases.length;
        const point = curve.getPointAt(phases[index]);
        positions.set([point.x, point.y, point.z], index * 3);
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const particles = new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({ color: 0xffffff, size: this.profile.mobile ? 0.045 : 0.055, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      group.add(particles);
      this.orbits.push({ curve, particles, phases, speed: definition.speed, offset: orbitIndex * 0.31 });
      this.system.add(group);
    });

    const ringDefinitions = [];
    for (let index = 0; index < 14; index += 1) {
      ringDefinitions.push({
        radiusX: 1.95 + index * 0.14,
        radiusZ: (1.95 + index * 0.14) * 0.35,
        y: 0.63 + (index - 7) * 0.012,
        tilt: 0.09,
        phase: index * 0.09,
        color: index % 3 === 0 ? 0xb190e8 : index % 3 === 1 ? 0x9cc2e1 : 0xd2cadf
      });
    }
    this.saturnRings = new THREE.LineSegments(
      createSegmentsFromLoops(ringDefinitions, this.profile.mobile ? 58 : 92),
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.system.add(this.saturnRings);
  }

  #createFragments() {
    const material = new THREE.MeshPhongMaterial({ color: 0xd4d6ec, specular: 0xffffff, shininess: 100, transparent: true, opacity: 0.82, flatShading: true });
    const placements = [[-5.0, -1.85, 0.2, 0.13], [5.05, -1.9, 0.1, 0.12], [-4.72, 0.1, -1.7, 0.08], [4.82, 0.3, -1.8, 0.08], [-2.3, -2.62, 1.0, 0.11], [2.45, -2.61, 1.1, 0.09]];
    placements.forEach(([x, y, z, size], index) => {
      const fragment = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), material);
      fragment.position.set(x, y, z);
      fragment.scale.y = 1.6;
      fragment.userData.baseY = y;
      fragment.rotation.set(index * 0.4, index * 0.7, index * 0.2);
      fragment.userData.baseRotationY = fragment.rotation.y;
      this.system.add(fragment);
      this.floaters.push({ object: fragment, phase: index * 0.75, amplitude: 0.045, spin: 0.08 });
    });
  }

  #glowSprite(color, scale, opacity) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    }));
    sprite.scale.set(scale, scale, 1);
    sprite.userData.baseScale = scale;
    return sprite;
  }

  #raySprite(color, length, opacity, vertical) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.rayTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    }));
    sprite.scale.set(length, Math.max(0.06, length * 0.055), 1);
    sprite.material.rotation = vertical ? Math.PI / 2 : 0;
    sprite.position.z = 0.86;
    return sprite;
  }

  #bindInteraction() {
    this.onResize = () => this.#resize();
    this.onVisibility = () => {
      this.paused = document.hidden;
      if (!this.paused) this.clock.getDelta();
    };
    this.onPointerDown = (event) => this.#pointerDown(event);
    this.onPointerMove = (event) => this.#pointerMove(event);
    this.onPointerUp = (event) => this.#pointerUp(event);
    this.onWheel = (event) => this.#wheel(event);
    this.onKeyDown = (event) => this.#keyDown(event);
    this.onContextLost = (event) => {
      event.preventDefault();
      this.paused = true;
      window.dispatchEvent(new CustomEvent("dreamunity:contextlost"));
    };
    this.onContextRestored = () => {
      this.paused = false;
      this.#render();
      window.dispatchEvent(new CustomEvent("dreamunity:contextrestored"));
    };

    window.addEventListener("resize", this.onResize, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility, { passive: true });
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
  }

  #pointerDown(event) {
    this.dragDistance = 0;
    this.lastInteraction = performance.now();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
    this.container.classList.add("is-dragging");
    document.body.classList.add("is-orbiting");
    if (this.pointers.size === 2) {
      const pointers = [...this.pointers.values()];
      this.pinchDistance = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
      this.pinchScale = this.targetScale;
    }
  }

  #pointerMove(event) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    this.dragDistance += Math.abs(dx) + Math.abs(dy);
    this.lastInteraction = performance.now();

    if (this.pointers.size === 1) {
      this.targetRotation.y = THREE.MathUtils.clamp(this.targetRotation.y + dx * 0.0035, -0.58, 0.58);
      this.targetRotation.x = THREE.MathUtils.clamp(this.targetRotation.x + dy * 0.0021, -0.24, 0.24);
    } else if (this.pointers.size === 2) {
      const pointers = [...this.pointers.values()];
      const distance = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
      this.targetScale = THREE.MathUtils.clamp(this.pinchScale * (distance / Math.max(this.pinchDistance, 1)), this.baseScale * 0.84, this.baseScale * 1.13);
    }
  }

  #pointerUp(event) {
    const shouldPick = this.dragDistance < 8;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 0) {
      this.container.classList.remove("is-dragging");
      window.setTimeout(() => document.body.classList.remove("is-orbiting"), 450);
    }
    if (shouldPick) this.#pick(event);
  }

  #pick(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hit = raycaster.intersectObjects(this.interactive, false)[0];
    if (hit?.object.userData.world) this.focusWorld(hit.object.userData.world);
  }

  #wheel(event) {
    event.preventDefault();
    this.lastInteraction = performance.now();
    this.targetScale = THREE.MathUtils.clamp(this.targetScale - event.deltaY * 0.00045, this.baseScale * 0.84, this.baseScale * 1.13);
  }

  #keyDown(event) {
    if (event.key === "ArrowLeft") this.targetRotation.y -= 0.1;
    if (event.key === "ArrowRight") this.targetRotation.y += 0.1;
    if (event.key === "ArrowUp") this.targetRotation.x -= 0.06;
    if (event.key === "ArrowDown") this.targetRotation.x += 0.06;
    if (event.key === "Escape") this.resetFocus();
    this.targetRotation.x = THREE.MathUtils.clamp(this.targetRotation.x, -0.24, 0.24);
    this.targetRotation.y = THREE.MathUtils.clamp(this.targetRotation.y, -0.58, 0.58);
    this.lastInteraction = performance.now();
  }

  focusWorld(key) {
    if (!WORLD_DATA[key]) return;
    this.selectedWorld = key;
    this.lastInteraction = performance.now();
    this.portals.forEach((portal, portalKey) => {
      portal.userData.targetScale = portalKey === key ? 1.18 : 0.92;
    });
    this.targetRotation.y = key === "machine" ? 0.08 : key === "maker" ? -0.08 : 0;
    this.targetRotation.x = key === "world" ? -0.04 : 0.025;
    window.dispatchEvent(new CustomEvent("dreamunity:worldfocus", { detail: { key, ...WORLD_DATA[key] } }));
  }

  resetFocus() {
    this.selectedWorld = null;
    this.portals.forEach((portal) => { portal.userData.targetScale = 1; });
    this.targetRotation.set(0.015, 0);
    this.targetScale = this.baseScale;
    window.dispatchEvent(new CustomEvent("dreamunity:unityfocus"));
  }

  #resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.68 ? 44 : aspect < 1 ? 41 : 38;
    this.camera.position.y = aspect < 0.68 ? 1.35 : 1.2;
    this.camera.position.z = aspect < 0.68 ? 16.1 : aspect < 1 ? 14.4 : aspect > 2 ? 13.15 : 12.8;
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.profile.pixelRatio));
    this.renderer.setSize(width, height, false);
    this.baseScale = width < 650 ? 0.75 : width < 950 ? 0.89 : 1;
    if (!this.selectedWorld && Math.abs(this.targetScale - 1) < 0.2) this.targetScale = this.baseScale;
    this.system.scale.setScalar(this.baseScale);
    this.#render();
  }

  #updateMetrics(time) {
    this.metricFrames += 1;
    const duration = time - this.lastMetricTime;
    if (duration < 1000) return;
    this.fps = Math.round((this.metricFrames * 1000) / duration);
    this.metricFrames = 0;
    this.lastMetricTime = time;

    this.lowFpsSamples = this.fps < 43 ? this.lowFpsSamples + 1 : Math.max(0, this.lowFpsSamples - 1);
    if (this.lowFpsSamples >= 2 && this.profile.pixelRatio > 1) {
      this.profile.pixelRatio = 1;
      this.adapted = true;
      this.#resize();
    } else if (this.lowFpsSamples >= 4 && this.animateOrbitParticles) {
      this.animateOrbitParticles = false;
      this.adapted = true;
    } else if (this.lowFpsSamples >= 6 && this.profile.pixelRatio > 0.86) {
      this.profile.pixelRatio = 0.86;
      this.adapted = true;
      this.#resize();
    }

    const info = this.renderer.info.render;
    window.dispatchEvent(new CustomEvent("dreamunity:metrics", {
      detail: { fps: this.fps, calls: info.calls, triangles: info.triangles, profile: this.profile.name }
    }));
  }

  #animate(time) {
    if (this.destroyed) return;
    this.animationFrame = requestAnimationFrame((nextTime) => this.#animate(nextTime));
    if (this.paused) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.frame += 1;

    if (!this.selectedWorld && performance.now() - this.lastInteraction > 1800) {
      this.targetRotation.x = THREE.MathUtils.damp(this.targetRotation.x, 0.015, 1.1, delta);
      this.targetRotation.y = THREE.MathUtils.damp(this.targetRotation.y, 0, 1.1, delta);
      this.targetScale = THREE.MathUtils.damp(this.targetScale, this.baseScale, 1.1, delta);
    }

    this.system.rotation.x = THREE.MathUtils.damp(this.system.rotation.x, this.targetRotation.x, 5.1, delta);
    this.system.rotation.y = THREE.MathUtils.damp(this.system.rotation.y, this.targetRotation.y, 5.1, delta);
    const scale = THREE.MathUtils.damp(this.system.scale.x, this.targetScale, 5.1, delta);
    this.system.scale.setScalar(scale);

    if (!this.reducedMotion) {
      this.core.rotation.y = elapsed * 0.084;
      this.coreInner.rotation.y = 0.29 - elapsed * 0.162;
      this.coreWire.rotation.y = elapsed * 0.108;
      this.field.rotation.y = elapsed * 0.0078;
      this.constellations.rotation.y = -elapsed * 0.0096;
      this.saturnRings.rotation.y = elapsed * 0.0102;
      const coreGlowScale = this.coreGlow.userData.baseScale * (1 + Math.sin(elapsed * 1.3) * 0.045);
      this.coreGlow.scale.set(coreGlowScale, coreGlowScale, 1);

      this.portals.forEach((portal) => {
        portal.position.y = portal.userData.baseY + Math.sin(elapsed * 0.7 + portal.userData.phase) * 0.045;
        portal.rotation.y = elapsed * 0.09 + portal.userData.phase * 0.045;
        const portalScale = THREE.MathUtils.damp(portal.scale.x, portal.userData.targetScale, 6.4, delta);
        portal.scale.setScalar(portalScale);
        const glowScale = portal.userData.glow.userData.baseScale * (1 + Math.sin(elapsed * 1.2 + portal.userData.phase) * 0.055);
        portal.userData.glow.scale.set(glowScale, glowScale, 1);
        portal.userData.rings.forEach((ring) => {
          ring.rotation.z = ring.userData.baseRotationZ + elapsed * ring.userData.speed * 0.36;
        });
      });

      if (this.animateOrbitParticles && (!this.profile.mobile || this.frame % 2 === 0)) {
        this.orbits.forEach((orbit) => {
          const positions = orbit.particles.geometry.getAttribute("position");
          for (let index = 0; index < orbit.phases.length; index += 1) {
            const phase = (orbit.phases[index] + elapsed * orbit.speed + orbit.offset + 1) % 1;
            const point = orbit.curve.getPointAt(phase);
            positions.setXYZ(index, point.x, point.y, point.z);
          }
          positions.needsUpdate = true;
        });
      }

      this.floaters.forEach(({ object, phase, amplitude, spin = 0 }) => {
        object.position.y = object.userData.baseY + Math.sin(elapsed * 0.55 + phase) * amplitude;
        object.rotation.y = (object.userData.baseRotationY || 0) + elapsed * spin * 0.6;
      });
    }

    this.#render();
    this.#updateMetrics(time);
  }

  #render() {
    try {
      this.renderer.render(this.scene, this.camera);
      if (!this.firstFrameRendered) {
        this.firstFrameRendered = true;
        requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("dreamunity:ready")));
      }
    } catch (error) {
      this.paused = true;
      window.dispatchEvent(new CustomEvent("dreamunity:rendererror", { detail: { message: error.message } }));
    }
  }

  getMetrics() {
    const info = this.renderer.info.render;
    return {
      fps: this.fps,
      calls: info.calls,
      triangles: info.triangles,
      points: info.points,
      profile: this.profile.name,
      pixelRatio: this.profile.pixelRatio,
      adapted: this.adapted
    };
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("wheel", this.onWheel);
    canvas.removeEventListener("keydown", this.onKeyDown);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    disposeTree(this.scene);
    this.glowTexture.dispose();
    this.rayTexture.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
  }
}

export { WORLD_DATA };
