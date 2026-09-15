# The Kerala Story: exploration game plan

Planning baseline, 14 September 2026. No game implementation has started.

Build a browser-based, third-person anime adventure where a player creates a local explorer profile and journeys continuously from Kodassery Peaks through Kadambode and Kurumali Puzha to Kodaly harbor. Exploration, atmosphere, movement, an accurate map, and a readable HUD are the first release.

## Read and hand off

1. [Product and delivery plan](docs/01-product-plan.md): scope, player journey, region layout, milestones, completion gates.
2. [Art and interface bible](docs/02-design-bible.md): reusable visual, avatar, environment, map, HUD, and asset rules.
3. [Architecture and contracts](docs/03-architecture.md): stack, coordinates, module ownership, data boundaries, performance, persistence.
4. [Task backlog](docs/04-task-backlog.md): dependency-ordered tasks, Luna candidates, acceptance checks, and a copyable handoff prompt.
5. [Validation and expansion](docs/05-validation.md): playtest route, release checks, risks, and rules for adding regions and quests.

The supplied image is a composition reference, not a survey or a playable heightmap. Its labels do not create gameplay requirements: the pictured toll does not mean a toll must exist in the exploration release. The user's written request governs scope.

## Recommended defaults

- Desktop keyboard/mouse first; responsive menus, touch gameplay deferred.
- Single player with a local name, avatar preset, appearance colors, and saved position. This is a local profile, not online authentication. Accounts, cloud saves, and multiplayer are separate later decisions.
- React + TypeScript + Vite for the application; Three.js through React Three Fiber for 3D; Rapier for collision and character movement.
- First prove a polished Kodassery trail, canopy bridge, and waterfall overlook. Then complete a traversable four-region blockout before dressing every region.
- Shared zone data drives both the scene and navigational map. Use a separate illustrated atlas treatment for atmosphere.
- No quests, combat, inventory, stamina, paid assets, or backend in the initial scope.

Start with **F01 → F02/F03 → C01 → C02 → C03** in the backlog. Do not delegate whole regions or the movement system as small Luna tasks. Implementing a task requires a separate handoff; this planning package does not dispatch work.
