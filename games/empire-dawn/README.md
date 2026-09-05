# Build a village

**Build a village** (the existing Empire Dawn game) is a self-contained, original browser real-time strategy game inspired by the foundational loop of late-1990s historical RTS games. It does not include or redistribute any original *Age of Empires* code, art, audio, maps, writing, or trademarks.

## Play

Serve this folder with any static web server, then open `index.html`. No build step or external assets are required.

```bash
python3 -m http.server 4174
```

## Core systems

- 64 × 64 isometric world with terrain, shoreline, resources, exploration and fog of war
- Four-resource economy: food, wood, stone and gold
- Villager gathering, carrying, drop-off, building, repairing and emergency combat
- Town Centres, houses, economic buildings, military buildings, farms and watch towers
- Clubmen, bowmen and mounted scouts with melee, ranged combat and projectiles
- Stone, Tool and Bronze Ages with age requirements and technologies
- Rival AI economy, production, expansion and escalating attack waves
- A* pathfinding, formation orders, attack-move, rally points and control groups
- Minimap navigation, camera edge-scroll/WASD, zoom, pause and four game speeds
- Local manual save, load and 30-second autosave
- Procedural original interface audio generated with the Web Audio API

## Controls

| Control | Action |
| --- | --- |
| Tap a person, then tap a place | Choose and send; workers gather from food or trees |
| Drag on touch | Choose a group of people |
| Home / Map / Clear / Cancel | Find the Main house, look around, clear a choice, cancel an action |
| + / − | Zoom in or out |
| Left-click | Select a unit, building or resource |
| Drag left mouse | Box-select units |
| Shift + click | Add or remove selection |
| Right-click | Context order: move, gather, build, repair or attack |
| WASD / arrow keys | Move camera |
| Mouse at screen edge | Edge-scroll camera |
| Mouse wheel | Zoom |
| B | Open Villager build menu |
| S | Stop selected units |
| Ctrl + 1–5 | Create a control group |
| 1–5 | Recall a control group |
| Space | Centre the current selection |
| P | Pause / resume |
| Escape | Cancel command mode or close overlays |

## Preview mode

Append `?preview=1` to open an advanced skirmish staged for screenshots and demonstrations.

## Interface

The player-facing menus use plain names and larger text, with pale silver and violet panels matching Dream Unity. Team and difficulty settings sit behind an optional disclosure, so Play remains the first action. The scrolling command list keeps its position and preserves keyboard focus during ordinary HUD refreshes.

Touch input sends the same orders as mouse input; it does not change the simulation. The map, goals and help open on request. Save version 1 and the existing storage key are retained. Old saved goal text is displayed through the current label map.
