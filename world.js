import {lerp} from './math.js';


import { drawBlockNonUnitScale, drawBlockText, getScreenCoordFromTileCoord } from './game.js';
import { GameplayFlags, Tile } from './tile.js';


export class World {

    dimensions = {
        w: 1,
        h: 1
    };
    grid = [];
    move_set = [];
    move_speed = 8.0;
    is_animating = false;

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
        tile.target_pos.row = row;
        tile.target_pos.col = col;
        const grid_index = this.getIndex(row, col);
        this.grid[grid_index] = tile;
    }


    findMovableTiles(row, col, list, grid, dir /* row-axis */) {
        const tile = this.getTile(row, col);

        if (tile.gameplay_flags & GameplayFlags.STATIC) {
            list.length = 0;
            return false;
        }

        const movable = tile.gameplay_flags & GameplayFlags.MOVABLE;
        const merged = tile.gameplay_flags & GameplayFlags.MERGED;
        if (movable) {
            list.push(tile);

            if (merged) {
                this.findMovableTiles(row+0, col+1, list, grid, dir); 
                this.findMovableTiles(row+0, col-1, list, grid, dir); 
                this.findMovableTiles(row+1, col+0, list, grid, dir); 
                this.findMovableTiles(row-1, col+0, list, grid, dir); 
            }
            else  {
                this.findMovableTiles(row, col+dir, list, grid, dir); 
            }
        }
    }

    updateTile(tile, dt) {
        let start  = getScreenCoordFromTileCoord(tile.world_pos.row, tile.world_pos.col);
        let target = getScreenCoordFromTileCoord(tile.target_pos.row, tile.target_pos.col);
        
        let x = lerp(start.x, target.x, tile.move_t);
        let y = lerp(start.y, target.y, tile.move_t);

        tile.visual_pos[0] = x;
        tile.visual_pos[1] = y;
    }
    
    moveTile(tile, dt) {      
        
        tile.move_t += this.move_speed * dt;
        if (tile.move_t > 1) {
            tile.move_t = 0;
            tile.should_move = false;
        }        
    }


    forEachCell = (cb) => {
        for (let row = 0; row < this.dimensions.h; row++) {
            for (let col = 0; col < this.dimensions.w; col++) {
                const index = row * this.dimensions.w + col;
                cb(row, col, index);
            }
        }
    };

    

    update(command_buffer, dt) {

        if (command_buffer.hasCommands()) {
            const c = command_buffer.pop();
            const { coord, direction }  = c;
            const {row, col} = coord;

            let t = this.getTile(coord.row, coord.col);
            this.move_set = [t];

            const grid = [];

            this.findMovableTiles(row, col+direction, this.move_set, grid, direction);

            for (let tile of this.move_set) {
                if (!tile.should_move) {
                    tile.should_move = true;
                    tile.move_t = 0;
                    tile.target_pos.col = tile.world_pos.col + direction;
                }
            }
        }

        
        if (this.move_set.length) {
            for (let tile of this.move_set) {
                if (tile.should_move) {
                    this.moveTile(tile, dt);
                }
            }
        }
        const done = this.move_set.filter(t => !t.should_move).length > 0;
        if (done) {
            // Update in grid
            for (let tile of this.move_set) {
                const index = this.getIndex(tile.world_pos.row, tile.world_pos.col); 
                this.grid[index] = new Tile();

            }

            for (let tile of this.move_set) {

    
                tile.world_pos.row = tile.target_pos.row;
                tile.world_pos.col = tile.target_pos.col;
                const cur_index = this.getIndex(tile.target_pos.row, tile.target_pos.col);
                this.grid[cur_index] = tile;
            }

            this.move_set.length = 0;
        }


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
            if ((tile.gameplay_flags > 0)) {
                const [x, y] = tile.visual_pos;
                drawBlockNonUnitScale(x, y, tile.color);
            }

        });

        

    }


};