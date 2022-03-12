import {lerp} from './math.js';


import { drawBlockNonUnitScale, drawBlockText, getScreenCoordFromTileCoord } from './game.js';
import { GameplayFlags, Tile } from './tile.js';


export class World {

    dimensions = {
        w: 1,
        h: 1
    };
    grid = [];
    move_speed = 10.0;

    constructor() {

    }


    setDimensions(w, h) {
        this.dimensions.w = w;
        this.dimensions.h = h;
        this.grid.length = w * h;
    }


    getIndex(row, col) {
        return row * this.dimensions.w + col;
    }

    getTile(row, col) {
        const index = this.getIndex(row, col);
        return this.grid[index];
    }

    putInGrid(row, col, tile) {
        tile.world_pos.row = row;
        tile.world_pos.col = col;
        const grid_index = this.getIndex(row, col);
        this.grid[grid_index] = tile;
    }


    updateTile(tile, dt) {
        
        if (tile.should_move) {

                tile.move_t += this.move_speed * dt;
                
                if (tile.move_t > 1) {
                    tile.move_t = 0;
                    tile.should_move = false;
    
                    let empty_tile = new Tile();
                    empty_tile.gameplay_flags |= GameplayFlags.EMPTY;
                    this.putInGrid(tile.world_pos.row, tile.world_pos.col, empty_tile);
    
                    tile.world_pos = tile.target_pos;
                    this.putInGrid(tile.world_pos.row, tile.world_pos.col, tile);
                }
            
        }
        let start  = getScreenCoordFromTileCoord(tile.world_pos.row, tile.world_pos.col);
        let target = getScreenCoordFromTileCoord(tile.target_pos.row, tile.target_pos.col);
        
        let x = lerp(start.x, target.x, tile.move_t);
        let y = lerp(start.y, target.y, tile.move_t);

        tile.visual_pos[0] = x;
        tile.visual_pos[1] = y;
        
    }
    



    forEachCell = (cb) => {
        for (let row = 0; row < this.dimensions.h; row++) {
            for (let col = 0; col < this.dimensions.w; col++) {
                const index = row * this.dimensions.w + col;
                cb(row, col, index);
            }
        }
    };

    

    update(dt) {
        this.forEachCell((row, col, index) => {
            this.updateTile(this.grid[index], dt);
        })
    }


    debugRenderCells() {
        this.forEachCell((row, col, index) => {
            const text = this.getTile(row, col).gameplay_flags;
            drawBlockText(row, col, text, "red" )
        });
    }
 
    render() {

        // Draw level
        this.forEachCell((row, col, index) => {
            const tile = this.grid[index];
            if (!(tile.gameplay_flags & GameplayFlags.EMPTY)) {
                const [x, y] = tile.visual_pos;
                drawBlockNonUnitScale(x, y, tile.color);
            }

        });

        

    }


};