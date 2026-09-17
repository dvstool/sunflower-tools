# Side panel structure

The side panel is being migrated from one legacy script to focused browser
scripts. The license and bootstrap boundary uses native ES modules; remaining
legacy feature scripts still load in declaration order during this incremental
migration, without introducing a build step.

- `core/`: shared DOM/UI primitives and state-independent helpers.
- `features/cards/`: HTML markup for a resource-card family.
- `features/renderers/`: views that compose cards into tabs and scan results.
- `features/state/`: local state reconciliation after a successful game action.
- `features/schedulers/`: timers, polling and browser notifications.
- `features/navigation/`: tab selection and cross-tab navigation flows.
- `features/actions/`: game interactions that are not part of a scanner or renderer.
- `sidepanel.js`: composition root only: DOM references, shared runtime state,
  constants, and global panel error reporting.
- `bootstrap.js`: starts the panel after every feature has registered.

Current feature ownership:

- `features/renderers/map-renderers.js`: map scan-result rendering coordination.
- `features/schedulers/ready-notifications.js`: ready-countdown notifications.
- `features/schedulers/pet-scheduler.js`: Pet awake/sleep rescan schedule.
- `features/schedulers/countdown-controller.js`: countdown updates and ready-state promotion.
- `features/state/composter-state.js`: Composter state transitions after actions.
- `features/state/resource-state.js`: Crop, Mining, Salt, Fruit and Composter state reconciliation after actions.
- `features/state/tree-state.js`: Tree DOM reconciliation and refresh scheduling.
- `features/state/profession-scan-state.js`: merge scoped map scans and reset their countdown cache.
- `features/navigation/tabs.js`: panel tabs and navigation history.
- `features/actions/connection-actions.js`: explicit connection, tab-load waiting and panel reload actions.

- `features/scanners/inventory-scanner.js`: bag opening and fertiliser-inventory scanner.
- `features/scanners/map-dom-scanner.js`: map DOM scan implementation and the
  Map scan button interaction.
- `features/renderers/overview-renderer.js`: overview composition and card
  transition effects.
  seed purchasing interactions.
- `features/actions/resource-actions.js`: Tree, Mining and Salt interactions.
- `features/actions/crop-harvest-actions.js`: Crop harvesting and Tree action
  handling.
- `features/actions/farm-actions.js`: Mushroom, Pet, Composter and Fruit
  interactions.
- `features/actions/overview-actions.js`: fertilising, scoped scans and the
  remaining overview-card actions.
- `features/actions/map-card-highlight.js`: temporary game-map highlight when
  the pointer hovers a panel resource card.
  dialogs as their panel tabs are entered or left, and highlights their map
  buildings on tab hover.
- `features/cards/crop-cards.js`: Crop soil, growing and ready card markup.
- `features/cards/resource-cards.js`: Mining, Salt, Foraging, Pet and Composter card markup.
- `features/cards/fruit-cards.js`: Fruit soil and tree card markup.
- `core/connection.js`: Sunflower tab discovery and injected-script boundary.

New behaviour must be added under `features/` (or `core/` when shared), never
appended to `sidepanel.js`. Keep a game interaction and its click handler in
the same feature file where practical; injected game-page logic belongs beside
the action that invokes it.
