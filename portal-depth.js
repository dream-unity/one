// Keep the HTML panel decoration behind the live WebGL silhouettes. The
// renderer supplies the matrices; no second renderer or Three.js copy is needed.
const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

export function portalFramePaths(kind, width, height) {
  const inset = 1.5;
  const left = kind !== "maker";
  const right = kind !== "machine";
  const bevel = Math.min(13, width / 8, height / 3);
  const x0 = inset;
  const x1 = width - inset;
  const y0 = inset;
  const y1 = height - inset;
  const start = left ? bevel + inset : x0;
  const end = right ? width - bevel - inset : x1;
  const points = [
    [start, y0], [end, y0],
    ...(right ? [[x1, height / 2], [end, y1]] : [[x1, y1]]),
    [start, y1], ...(left ? [[x0, height / 2]] : [])
  ];
  return {
    outline: `M${points.map((point) => point.join(",")).join("L")}Z`,
    light: `M${start + 2},${y0 + 1.5}H${end - 2}`,
    accent: `M${width * 0.36},${y1 - 3}H${width * 0.64}`
  };
}

function initializePortalFrames() {
  const frames = [...document.querySelectorAll(".portal-frame")];
  const update = (frame) => {
    const { width, height } = frame.parentElement.getBoundingClientRect();
    if (width < 30 || height < 12) return;
    const paths = portalFramePaths(frame.closest("[data-portal]").dataset.portal, width, height);
    frame.setAttribute("viewBox", `0 0 ${width} ${height}`);
    for (const [name, d] of Object.entries(paths)) {
      frame.querySelector(`.portal-frame-${name}`).setAttribute("d", d);
    }
  };
  frames.forEach(update);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver((entries) => {
      entries.forEach(({ target }) => update(target.querySelector(".portal-frame")));
    });
    frames.forEach((frame) => observer.observe(frame.parentElement));
  } else {
    window.addEventListener("resize", () => frames.forEach(update), { passive: true });
  }
}

export function convexHull(points) {
  if (points.length < 3) return points;
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (ordered) => {
    const result = [];
    for (const point of ordered) {
      while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
      result.push(point);
    }
    return result;
  };
  const lower = half(points);
  const upper = half([...points].reverse());
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function meshPoints(mesh, vector) {
  const positions = mesh.geometry.getAttribute("position");
  const unique = new Map();
  for (let index = 0; index < positions.count; index += 1) {
    const point = vector.clone().fromBufferAttribute(positions, index);
    const key = `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`;
    if (!unique.has(key)) unique.set(key, point);
  }
  return { mesh, points: [...unique.values()] };
}

export function attachPortalDepth(unity) {
  const surfaces = [...document.querySelectorAll(".portal-surface, .portal-thread")];
  if (!surfaces.length || unity.scene.userData.portalDepth) return;
  const vector = unity.camera.position.clone();
  const bodies = [unity.core, ...unity.portals.values()].map((body) => ({
    // Include the portal shells and rings, and both crystal surfaces and wire.
    // Their shared silhouette keeps the whole local halo clear of panel lines.
    meshes: body.children.filter((object) => object.isMesh || object.isLineSegments)
      .map((mesh) => meshPoints(mesh, vector)),
    path: svgElement("path", { fill: "black", stroke: "black", "stroke-width": "2", "stroke-linejoin": "round" })
  }));
  const svg = svgElement("svg", { class: "portal-depth-defs", "aria-hidden": "true", focusable: "false" });
  const defs = svgElement("defs");
  const silhouettes = svgElement("g", { id: "portal-depth-shapes" });
  bodies.forEach(({ path }) => silhouettes.append(path));
  defs.append(silhouettes);
  const masks = surfaces.map((element, index) => {
    const id = `portal-depth-${index}`;
    const mask = svgElement("mask", {
      id, maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse",
      x: "0", y: "0", "mask-type": "luminance"
    });
    const background = svgElement("rect", { fill: "white" });
    const use = svgElement("use", { href: "#portal-depth-shapes" });
    mask.append(background, use);
    defs.append(mask);
    return { element, id, mask, background, use };
  });
  svg.append(defs);
  document.body.append(svg);

  const update = () => {
    // Read all layout before any DOM writes. CSS-pixel coordinates keep the
    // cut-outs aligned during zoom, resize, hover lift and adaptive GPU scaling.
    const canvas = unity.renderer.domElement.getBoundingClientRect();
    const rectangles = masks.map(({ element }) => element.getBoundingClientRect());
    for (const body of bodies) {
      const projected = [];
      for (const { mesh, points } of body.meshes) {
        if (!mesh.visible) continue;
        for (const point of points) {
          vector.copy(point).applyMatrix4(mesh.matrixWorld).project(unity.camera);
          if (vector.z < -1 || vector.z > 1) continue;
          projected.push({
            x: canvas.left + (vector.x + 1) * canvas.width / 2,
            y: canvas.top + (1 - vector.y) * canvas.height / 2
          });
        }
      }
      const hull = convexHull(projected);
      const d = hull.length < 3 ? "" : `M${hull.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join("L")}Z`;
      if (body.path.getAttribute("d") !== d) body.path.setAttribute("d", d);
    }
    masks.forEach(({ element, id, mask, background, use }, index) => {
      const rect = rectangles[index];
      const dimensions = `${rect.width},${rect.height},${rect.left},${rect.top}`;
      if (mask.dataset.bounds !== dimensions) {
        mask.setAttribute("width", rect.width);
        mask.setAttribute("height", rect.height);
        background.setAttribute("width", rect.width);
        background.setAttribute("height", rect.height);
        use.setAttribute("transform", `translate(${-rect.left} ${-rect.top})`);
        mask.dataset.bounds = dimensions;
      }
      if (!element.style.maskImage) {
        element.style.maskImage = `url(#${id})`;
        element.style.webkitMaskImage = `url(#${id})`;
      }
    });
  };

  // Scene.onAfterRender runs in the same frame, after world matrices update.
  // It also covers resize/context recovery and respects the existing pause loop.
  const previous = unity.scene.onAfterRender;
  const remove = () => {
    unity.scene.onAfterRender = previous;
    delete unity.scene.userData.portalDepth;
    masks.forEach(({ element }) => {
      element.style.removeProperty("mask-image");
      element.style.removeProperty("-webkit-mask-image");
    });
    svg.remove();
  };
  const refresh = () => {
    try {
      update();
    } catch (error) {
      // A decoration failure must never interrupt the 3D renderer or controls.
      remove();
      console.warn("Dream Unity panel depth unavailable:", error);
    }
  };
  unity.scene.onAfterRender = function (...args) {
    previous.apply(this, args);
    refresh();
  };
  unity.scene.userData.portalDepth = true;
  refresh();
  return remove;
}

if (typeof window !== "undefined") {
  // Panel outlines remain available even when the WebGL scene cannot start.
  initializePortalFrames();
  const start = () => {
    const unity = window.__DREAM_UNITY__?.scene;
    if (unity) attachPortalDepth(unity);
  };
  window.addEventListener("dreamunity:ready", start, { once: true });
  start();
}
