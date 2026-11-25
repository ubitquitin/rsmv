import { canvasToImageFile } from "../imgutils";
import { MapRect, tiledimensions, TileGridSource, TileProps } from "../3d/mapsquare";


export function drawCollision(grids: TileGridSource[], rect: MapRect, maplevel: number, pxpertile: number, wallpx: number, format = "png" as "png" | "webp") {
	let cnv = document.createElement("canvas");
	let ctx = cnv.getContext("2d", { willReadFrequently: true })!;
	cnv.width = rect.xsize * pxpertile;
	cnv.height = rect.zsize * pxpertile;
	ctx.scale(1, -1);
	ctx.translate(0, -rect.zsize * pxpertile);
	ctx.translate(-rect.x * pxpertile, -rect.z * pxpertile);

	let wallcol = "red";
	let walkcol = "orange";

	let colcheck = (tiles: TileProps[], index: number, lowx: boolean, lowz: boolean, highx: boolean, highz: boolean) => {
		let walk = false;
		let sight = false;
		for (let tile of tiles) {
			walk ||= !!tile.effectiveCollision && tile.effectiveCollision.walk[index];
			sight ||= !!tile.effectiveCollision && tile.effectiveCollision.sight[index];
		}

		if (walk) {
			ctx.fillStyle = (sight ? wallcol : walkcol);
			ctx.fillRect(
				tiles[0].x / tiledimensions * pxpertile + (lowx ? 0 : pxpertile - wallpx),
				tiles[0].z / tiledimensions * pxpertile + (lowz ? 0 : pxpertile - wallpx),
				(lowx && highx ? pxpertile : wallpx),
				(lowz && highz ? pxpertile : wallpx)
			);
		}
	}

	for (let z = rect.z; z < rect.z + rect.zsize; z++) {
		for (let x = rect.x; x < rect.x + rect.xsize; x++) {
			//some collision might spill over from neighbouring chunks
			//check for the tile on every grid and OR them together
			let tiles: TileProps[] = [];
			for (let grid of grids) {
				let tile = grid.getTile(x, z, maplevel);
				if (tile) { tiles.push(tile); }
			}
			if (tiles.length == 0) { continue; }
			//center
			colcheck(tiles, 0, true, true, true, true);

			//walls
			colcheck(tiles, 1, true, true, false, true);
			colcheck(tiles, 2, true, false, true, true);
			colcheck(tiles, 3, false, true, true, true);
			colcheck(tiles, 4, true, true, true, false);

			//corners
			colcheck(tiles, 5, true, false, false, true);
			colcheck(tiles, 6, false, false, true, true);
			colcheck(tiles, 7, false, true, true, false);
			colcheck(tiles, 8, true, true, false, false);
		}
	}

	return canvasToImageFile(cnv, format, 1);
}



export function exportCollisionLua(
    grids: TileGridSource[],
    rect: MapRect,
    plane: number
) {
    const collisionRows: string[] = [];
    const floorRows: string[] = [];
    const settingsRows: string[] = [];

    for (let z = rect.z; z < rect.z + rect.zsize; z++) {
        const collisionValues: string[] = [];
        const floorValues: string[] = [];
        const settingsValues: string[] = [];

        for (let x = rect.x; x < rect.x + rect.xsize; x++) {
            let flags = 0;
            let foundCollision = false;
            let foundTile = false;
            let floorMask = 0;
            let terrainSettings = 0;

            for (const grid of grids) {
                const tile = grid.getTile(x, z, plane);
                if (!tile) continue;

                foundTile = true;

                if (tile.underlayVisible) floorMask |= 1;
                if (tile.overlayVisible) floorMask |= 2;
                if (tile.rawUnderlay != null) floorMask |= 4;
                if (tile.rawOverlay != null) floorMask |= 8;
                if (tile.waterProps != null) floorMask |= 16;

                terrainSettings |= tile.settings ?? 0;

                const col = tile.effectiveCollision;
                if (!col) continue;

                foundCollision = true;

                for (let i = 0; i < 9; i++) {
                    if (col.walk[i]) {
                        flags |= (1 << i);
                    }
                }
            }

            collisionValues.push(
                foundCollision ? String(flags) : "-1"
            );

            floorValues.push(
                foundTile ? String(floorMask) : "-1"
            );

            settingsValues.push(
                foundTile ? String(terrainSettings) : "-1"
            );
        }

        collisionRows.push(
            "    {" + collisionValues.join(",") + "}"
        );

        floorRows.push(
            "    {" + floorValues.join(",") + "}"
        );

        settingsRows.push(
            "    {" + settingsValues.join(",") + "}"
        );
    }

    return [
        "return {",
        `  originX = ${rect.x},`,
        `  originZ = ${rect.z},`,
        `  plane = ${plane},`,
        "  tiles = {",
        collisionRows.join(",\n"),
        "  },",
        "  floor = {",
        floorRows.join(",\n"),
        "  },",
        "  terrainSettings = {",
        settingsRows.join(",\n"),
        "  }",
        "}"
    ].join("\n");
}

