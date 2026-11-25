import * as fs from "fs/promises";
import * as path from "path";
import { EngineCache } from "../3d/modeltothree";
import { parseMapsquare, rs2ChunkSize, squareLevels, TileGridSource } from "../3d/mapsquare";
import { cacheMajors, cacheMapFiles } from "../constants";
import { unpackMapsquare } from "../utils";
import { exportCollisionLua } from "../map/collisionimage";
import type { CacheFileSource } from "../cache";

export type CollisionExportOptions = {
    outputDir: string;
    minX?: number;
    maxX?: number;
    minZ?: number;
    maxZ?: number;
    overwrite?: boolean;
};

export async function exportAllCollisionLua(source: CacheFileSource, options: CollisionExportOptions) {
    const engine = await EngineCache.create(source);
    if (engine.classicData || engine.getBuildNr() < 759) {
        throw new Error("This exporter currently supports RS3 caches build 759+ only.");
    }

    const index = await engine.getCacheIndex(cacheMajors.mapsquares);
    const valid = new Set<string>();
    const coords: { x: number; z: number }[] = [];
    const key = (x: number, z: number) => `${x},${z}`;

    for (let id = 0; id < index.length; id++) {
        const entry = index[id];
        if (!entry || !entry.subindices.includes(cacheMapFiles.squares)) continue;
        const { x, z } = unpackMapsquare(id);
        valid.add(key(x, z));
        if ((options.minX == null || x >= options.minX)
            && (options.maxX == null || x <= options.maxX)
            && (options.minZ == null || z >= options.minZ)
            && (options.maxZ == null || z <= options.maxZ)) {
            coords.push({ x, z });
        }
    }

    await fs.mkdir(options.outputDir, { recursive: true });
    console.log(`Found ${valid.size} mapsquares; selected ${coords.length} for export.`);

    let exported = 0, skipped = 0, failed = 0;
    for (let i = 0; i < coords.length; i++) {
        const { x, z } = coords[i];
        const paths = Array.from({ length: squareLevels }, (_, plane) =>
            path.join(options.outputDir, `collision_${x}_${z}_${plane}.lua`));

        if (!options.overwrite && (await Promise.all(paths.map(async p =>
            fs.access(p).then(() => true, () => false)))).every(Boolean)) {
            skipped++;
            continue;
        }

        try {
            // Decode the target and all 8 neighbors. Neighboring location
            // objects can contribute collision to tiles inside the target.
            const grids: TileGridSource[] = [];
            let targetPresent = false;
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx, nz = z + dz;
                    if (!valid.has(key(nx, nz))) continue;
                    const parsed = await parseMapsquare(engine, nx, nz, { collision: true });
                    if (!parsed.chunk) continue;
                    if (dx === 0 && dz === 0) targetPresent = true;
                    grids.push(parsed.grid);
                }
            }
            if (!targetPresent) { skipped++; continue; }

            const rect = {
                x: x * rs2ChunkSize,
                z: z * rs2ChunkSize,
                xsize: rs2ChunkSize,
                zsize: rs2ChunkSize
            };
            for (let plane = 0; plane < squareLevels; plane++) {
                if (!options.overwrite) {
                    const exists = await fs.access(paths[plane]).then(() => true, () => false);
                    if (exists) continue;
                }
                const lua = exportCollisionLua(grids, rect, plane);
                await fs.writeFile(paths[plane], lua, "utf8");
            }
            exported++;
            console.log(`[${i + 1}/${coords.length}] Exported ${x},${z}`);
        } catch (err) {
            failed++;
            console.error(`[${i + 1}/${coords.length}] FAILED ${x},${z}:`, err);
        }
    }
    console.log(`Done. Exported ${exported}, skipped ${skipped}, failed ${failed}.`);
    return { exported, skipped, failed };
}
