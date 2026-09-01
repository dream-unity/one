# Dream Unity

An original, real-time three-dimensional front page for the Dream Unity project.

Dream Unity models the circulation through which possibility becomes reality and returns transformed:

- **Dream Machine** — Perceive · Model · Predict
- **Dream Maker** — Intend · Act · Become
- **Dream World** — Matter · Structure · Emerge

## Experience

The visualization is rendered as a genuine interactive scene: drag to orbit the unified field, scroll or pinch to zoom, and select any portal to focus its causal role. The faceted Unity crystal, three world bodies, geodesic possibility field, orbital flows, crystalline landscape, interface and optional ambient sound are generated in the browser.

No image or remote 3D asset is used to imitate the central visualization.

## Rendering architecture

- Direct WebGL rendering with deterministic faceted materials and additive light sprites
- Device-aware geometry, antialiasing and pixel-ratio limits
- Automatic resolution and particle adaptation if sustained frame rate falls
- Refresh-rate-independent motion, visibility pausing and WebGL context recovery
- A lightweight vector depth scaffold that preserves the composition during GPU startup or recovery

The runtime deliberately avoids costly transmission materials, environment-map generation and full-screen bloom passes. Visual richness comes from composition, geometry, color and layered light rather than unstable post-processing.

## Run locally

```bash
npm install
npm run vendor
npm run build
npm run dev
```

Open the local address printed by Vite.

## Verify

```bash
npm run check
```

The root is deployment-ready for GitHub Pages. The tree-shaken production runtime is delivered as integrity-checked 64 KB segments, reconstructed locally, and executed only after every byte is verified. This avoids large-response truncation without a JavaScript CDN or build server.

## Controls

- Drag: orbit the Dream Unity field
- Wheel or pinch: zoom
- Tap/click a portal: focus a world
- Arrow keys: orbit from the keyboard
- Escape: return to Unity
- Music: toggle the generated ambient harmonic field

## License

Project-specific source and visual design are copyright Dream Unity. Three.js is distributed under the MIT license included in `vendor/three/LICENSE`.
