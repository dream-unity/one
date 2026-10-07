# Dream University

A clean four-portal foundation for the forthcoming imagination programme.

The original parchment, ink drawing, three portal positions and animated rings are preserved. Dream Unity is a fourth connected portal, with an ink ring drawn from the same artwork. The four native links work with keyboard, touch and JavaScript disabled.

- Dream Machine — `/dream-machine/`
- Dream World — `/dream-world/`
- Dream Maker — `/dream-maker/`
- Dream Unity — `/dream-unity/`

All four destinations are deliberately in preparation. The programme and games have not yet been divided between them. Dream Unity will concern the relationships between the worlds: meaning, equilibrium, stability and expansion.

The previous prototype, manifesto, activities, games, Earth integration, old portal system, compiled runtime and unused assets have been removed from the current source and publication. Earlier revisions remain in Git history.

## Development and publication

The site is static HTML, CSS and JavaScript. The original Three.js runtime is vendored locally, with a lightweight animated-ink fallback for small screens and devices without WebGL. Reduced-motion preferences keep the illustration still. No account, API key, external application or backend is required.

`npm test` checks the foundation. `npm run build` stages the explicit public allowlist into `.public-site/`. GitHub Pages publishes that directory using the existing Pages source selection and current-revision safeguards. The published `build-info.json` identifies its source commit.

`CNAME` retains the existing domain `dreamunity.one`. No domain or Pages source settings are changed by this preparation.

## License

Project-specific source and visual design are copyright Dream Unity. Three.js retains its MIT license in `vendor/three/LICENSE`.
