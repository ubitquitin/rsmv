# Collision Data Export

This fork of [rsmv](https://github.com/skillbert/rsmv) adds collision data extraction and packing utilities for the [Dive Overlay](https://github.com/ubitquitin/dive_overlay) RuneScape plugin.

## Changes from upstream

- Added `exportcollision` to export static collision data from the RuneScape cache as Lua mapsquares.
- Added `exportblockinglocs` to extract Loc IDs with the `blocks_movement` cache property set to `true`.
- Added Python scripts to compress collision data into lightweight Lua files for use within the plugin.

## Setup

Requires Node.js, npm, Python 3, and access to the RuneScape cache.

From the root of this repository, install dependencies and build:

```bash
npm ci
npm run build
```

## 1. Static Collision Data

Export static collision flags for all available mapsquares and planes:

```bash
node dist/cli exportcollision --source cache --out ./collision --overwrite
```

This generates individual `collision_X_Z_PLANE.lua` files containing 64×64 tile grids with directional and central collision flags.

Pack the exported mapsquares into indexed Lua shards:

```bash
python pack_maps_collision_only.py ./collision ./maps --max-mb 50
```

The packing script encodes collision flags using 9 bits per tile and Base64 encoding, preserving missing collision cells where necessary.

Copy the generated `index.lua` and `maps_*.lua` files into the Dive Overlay `maps/` directory, replacing the previous collision dataset.

## 2. Blocking Loc Data

Extract all Loc IDs whose `blocks_movement` cache property is set to `true`:

```bash
node dist/cli exportblockinglocs --source cache --out ./blocking_locs
```

This generates:

- `blocking_locs.json` — list of blocking Loc IDs.
- `blocking_locs.lua` — uncompressed Lua lookup table.
- `blocking_locs_stats.json` — extraction statistics.

Run the packing script from the generated `blocking_locs/` directory:

```bash
cd blocking_locs
python ../pack_blocking_locs.py
```

The packing script compresses the Loc IDs into a hexadecimal-encoded bitset, allowing constant-time membership checks with minimal memory overhead.

Copy the packed `blocking_locs.lua` into the Dive Overlay repository as `data/blocked_locs.lua`.

This dataset supplements the plugin's existing dynamic collision heuristics rather than replacing them.

## Reproducibility

This fork is included as a pinned Git submodule in the Dive Overlay repository. Use the same RuneScape cache snapshot for both exports to ensure consistent collision data.

The extraction tools are development dependencies only and are not required to run the plugin.

## Credits

Original rsmv project by [Skillbert](https://github.com/skillbert). Cache extraction and packing utilities were added for Dive Overlay.