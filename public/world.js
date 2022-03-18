import {lerp} from './math.js';


import { drawBlockNonUnitScale, drawBlockText, getScreenCoordFromTileCoord, drawFullScreen, drawMoveArrow } from './game.js';
import { GameplayFlags, Tile } from './tile.js';
import { CommandTypes, ImpossibleCommand } from './command.js';
import { lerpToInt } from './math.js';

// NOTE: Neighbours in this case means; tiles that are different 
// in color (or id in case of black tiles) from the current tile.
export const Neighbours = {
    TOP:            (1 << 0),
    BOTTOM:         (1 << 1),
    LEFT:           (1 << 2),
    RIGHT:          (1 << 3),

    TOP_LEFT:       (1 << 4),
    TOP_RIGHT:      (1 << 5),
    BOTTOM_LEFT:    (1 << 6),
    BOTTOM_RIGHT:   (1 << 7),
};



class Piece {
    tiles = [];
    color = "";
}

export class World {

    dimensions = {
        w: 1,
        h: 1
    };
    grid = [];
    debug_grid = [];
    move_set = [];
    gravity_set = [];
    move_speed = 9.0;
    fall_speed = 16.0;
    color_set = new Set();

    canvas_shake_timeout;

    screen_flash_t;

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

    getPiece(row, col, grid) {
        const index = this.getIndex(row, col);
        return grid[index];
    }

    putInGrid(row, col, tile) {
        tile.world_pos.row = row;
        tile.world_pos.col = col;
        tile.target_pos.row = row;
        tile.target_pos.col = col;
        if (tile.gameplay_flags & GameplayFlags.MOVABLE) {
            if (tile.color === 'black') {
                this.color_set.add(`${tile.color}_${tile.id}`);
            }
            else {
                this.color_set.add(tile.color);
            }
        }
        const grid_index = this.getIndex(row, col);
        this.grid[grid_index] = tile;
    }


    setState(new_grid) {
        this.grid = [...new_grid];
        this.move_set.length = 0;
    }

    findMergeTiles(row, col, list, original, visited) {
        const tile = this.getTile(row, col);
        if (visited.includes(tile)) {
            return;
        }
        
        if ( 
            (tile.color === original.color && tile.gameplay_flags & GameplayFlags.MERGEABLE) ||
            ((tile.color === 'black' && original.id === tile.id))
         ) {
            visited.push(tile);
           
            list.push(tile);
            
            this.findMergeTiles(row+1, col+0, list, original, visited);
            this.findMergeTiles(row-1, col+0, list, original, visited);
            this.findMergeTiles(row+0, col+1, list, original, visited);
            this.findMergeTiles(row+0, col-1, list, original, visited);
        }
    }



    updateTile(tile, dt) {
        let start  = getScreenCoordFromTileCoord(tile.world_pos.row,  tile.world_pos.col);
        let target = getScreenCoordFromTileCoord(tile.target_pos.row, tile.target_pos.col);
        
        let x = lerpToInt(start.x, target.x, tile.move_t);
        let y = lerpToInt(start.y, target.y, tile.move_t);

        tile.visual_pos[0] = x;
        tile.visual_pos[1] = y;
    }
    
    moveTile(tile, dt) {    
        
        let delta_row = tile.target_pos.row - tile.world_pos.row;
        if (delta_row) {
            tile.move_t += (this.fall_speed * dt);
        }
        else {
            tile.move_t += this.move_speed * dt;
        }
        
        // NOTE: shouldn't this be > 1 ?
        let fall_dist = tile.target_pos.row - tile.world_pos.row;
        if( fall_dist > 1 ) {
        }
        else {
        }
          
        if (tile.move_t > 1) {
            tile.move_t = 0;
            tile.should_move = false;

            const canvas = document.getElementById("grid_canvas");
            if (delta_row >= 1) {
                const name =  "add_gravity_shake_mild";
                canvas.classList.add(name);
                window.setTimeout(() => {canvas.classList.remove(name);}, 350)
            }
            
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

    

    update(command_buffer, dt, game_state, recorder) {

        // Create pieces
        const pieces = [];
        const pieces_grid = [];
        const static_pieces = [];
        {
            const visited = [];
            this.forEachCell( (row, col, index) => {
                const tile = this.getTile(row, col);
                if (visited.includes(tile)) return 

                if (tile.gameplay_flags & GameplayFlags.MOVABLE) {
                    const piece = new Piece();
                    piece.color = tile.color;
    
                    if (tile.gameplay_flags & GameplayFlags.MERGED) {
                        const merged_tiles = [];
                        this.findMergeTiles(tile.world_pos.row, tile.world_pos.col, merged_tiles, tile, visited);
                        piece.tiles = [...merged_tiles];
                    }
                    else {
                        piece.tiles.push(tile);
                        visited.push(tile);
                    }
                    pieces.push(piece);

                }
                else if (tile.gameplay_flags & GameplayFlags.STATIC && tile.gameplay_flags & GameplayFlags.MERGEABLE) {
                    const piece = new Piece();
                    piece.color = tile.color;
    
                    if (tile.gameplay_flags & GameplayFlags.MERGED) {
                        const merged_tiles = [];
                        this.findMergeTiles(tile.world_pos.row, tile.world_pos.col, merged_tiles, tile, visited);
                        piece.tiles = [...merged_tiles];
                    }
                    else {
                        piece.tiles.push(tile);
                        visited.push(tile);
                    }

                    static_pieces.push(piece);
                }
            });

            // Fill pieces grid
            pieces.forEach( (piece, index) => {
                for (let tile of piece.tiles) {
                    const grid_index = this.getIndex(tile.world_pos.row, tile.world_pos.col);
                    pieces_grid[grid_index] = index;
                }
            });
        }


        

        
        
        if (command_buffer.hasCommands()) {
            const c = command_buffer.pop();

           
            const { coord, direction }  = c;
            const {row, col} = coord;

            if (c.type === CommandTypes.MOVE) {

                const piece_index = this.getPiece(row, col, pieces_grid);
                const piece = pieces[piece_index];
               
                
                this.move_set = [];
                this.move_set.push(piece);
    
                let can_move = true;
                moveset_outer: for (let p of this.move_set) {
                    for (let tile of p.tiles) {
                        let r = tile.world_pos.row;
                        let c = tile.world_pos.col;
                        c += direction;
                        const other = this.getTile(r, c);
                        if (other.gameplay_flags & GameplayFlags.STATIC) {
                            can_move = false;
                            this.move_set.length = 0;
                            break moveset_outer;
                        }
                        if (other.gameplay_flags & GameplayFlags.MOVABLE) {
                            const other_piece_index = this.getPiece(other.world_pos.row, other.world_pos.col, pieces_grid);
                            const other_piece = pieces[other_piece_index];
                            if (!this.move_set.includes(other_piece)) {
                                this.move_set.push(other_piece);
                            }
                        }
                    }
                }
               
    
                if (can_move) {
                    
                    recorder.add(this.grid);
    
                    for (let piece of this.move_set) {
                        for (let tile of piece.tiles) {
                            if (!tile.should_move) {
                                tile.should_move = true;
                                tile.move_t = 0;
                                tile.target_pos.col = tile.world_pos.col + direction;
                            }
                        }
                    }
                }
                else {
                    const c = new ImpossibleCommand(coord);
                    command_buffer.add(c);
                }    
            }

            if (c.type === CommandTypes.IMPOSSIBLE) {
                drawFullScreen("white")
                const canvas = document.getElementById("grid_canvas");
                
                canvas.classList.add("add_shake")
                this.canvas_shake_timeout = window.setTimeout(() => canvas.classList.remove("add_shake"), 250)

            }
        }
        

        if (this.move_set.length) {
            for (let piece of this.move_set) {
                for (let tile of piece.tiles) {
                    this.moveTile(tile, dt);
                }
            }
        }
        let done = true;
        for (let piece of this.move_set) {
            for (let tile of piece.tiles) {
                if (tile.should_move) {
                    done = false;
                }
            }
        }

        if (done) {
            // Clear grid
            for (let piece of this.move_set) {
                for (let tile of piece.tiles) {
                    const index = this.getIndex(tile.world_pos.row, tile.world_pos.col); 
                    this.grid[index] = new Tile();
                }

            }

            // Fill in grid
            for (let piece of this.move_set) { 
                for (let tile of piece.tiles) {
                    tile.world_pos.row = tile.target_pos.row;
                    tile.world_pos.col = tile.target_pos.col;
                    const cur_index = this.getIndex(tile.target_pos.row, tile.target_pos.col);
                    this.grid[cur_index] = tile;
                }
            }
            
            this.move_set.length = 0;
        }
        

        
        // Check and apply gravity
        if (!this.move_set.length) {
            // To check whether pieces should move, recursively fill out a 
            // temporary grid by checking a piece for mobility and paint in all 
            // pieces that are static. All the leftover pieces are movable and 
            // should have gravity applied to them.
            const staticised_grid = JSON.parse(JSON.stringify(this.grid));
            const movables = [...pieces];
            let changed = true;
            while (changed) {
                // Go through array in reverse to handle removal
                let piece_changed = false;
                movables.forEach((piece, i) => {
                    let can_move = true;
                    for (let tile of piece.tiles) {
                        const {row, col} = tile.world_pos;
                        const other_index = this.getIndex(row+1, col);
                        const other = staticised_grid[other_index];
                        
                        if (other.gameplay_flags & GameplayFlags.STATIC) {
                            can_move = false;
                            break;
                        }
                    }
                    
                    if (!can_move) {
                        // Update staticised grid
                        for (let tile of piece.tiles) {
                            const {row, col} = tile.world_pos;
                            const index = this.getIndex(row, col);
                            staticised_grid[index].gameplay_flags |= GameplayFlags.STATIC;
                            staticised_grid[index].gameplay_flags &= ~GameplayFlags.MOVABLE;
                        }
                        movables.splice(i, 1);
                        piece_changed = true;
                    }
                
                })
                    
                changed = piece_changed;
            }

            if (movables.length) {
                for (let piece of movables) {
                    // pre pass to get maximum travel distance
                    let max_travel = this.dimensions.h * 2;
                    for (let tile of piece.tiles) {
                        let r = tile.world_pos.row;
                        let c = tile.world_pos.col;
                        let distance = 1;
                        
                        
                        
                        max_travel = Math.min(distance, max_travel);
                    }

                    
                    // Apply travel distance
                    for (let tile of piece.tiles) {
                        tile.target_pos.row += max_travel;
                        tile.should_move = true;
                        tile.move_t = 0;
                    }
                    this.move_set.push(piece);
                }
            }


        }
        
        
        
        
        // Check and apply merge
        if (!this.move_set.length) {
            const visited = [];
            this.forEachCell((row, col, index) => {
                const tile = this.getTile(row, col);
                
                if ( (tile.gameplay_flags & GameplayFlags.MERGEABLE)) {
                    const merge_list = [];
                    this.findMergeTiles(row, col, merge_list, tile, visited);

                    const is_static = merge_list.filter(t => t.gameplay_flags & GameplayFlags.STATIC).length > 0;


                    if (merge_list.length > 1) {
                        for (let t of merge_list) {
                            t.gameplay_flags |= GameplayFlags.MERGED;
                            if (is_static) {
                                t.gameplay_flags &= ~(GameplayFlags.MOVABLE);
                                t.gameplay_flags |= GameplayFlags.STATIC;
                            }
                        }
                    }
                }
            })
        }

        this.forEachCell((row, col, index) => {
            this.updateTile(this.grid[index], dt);
        })

        
        // HANDLE WIN CONDITION
        if (pieces.length + static_pieces.length === this.color_set.size) {
            game_state.running = false;
            game_state.has_won = true;
        }
    }


    debugRender() {
        this.debug_grid.forEach((tile) => {
            const text = tile.gameplay_flags & GameplayFlags.STATIC;
            const {row, col} = tile.world_pos;
            drawBlockText(text, row, col, "blue");
        })
    }
 

    render(game_state) {

        // Draw level
        this.forEachCell((row_, col_, index) => {
            const tile = this.grid[index];
            if ((tile.gameplay_flags > 0)) {
                const [x, y] = tile.visual_pos;
                const {row, col} = tile.world_pos;

                let neighbours = 0;

                if (tile.gameplay_flags & GameplayFlags.MOVABLE) {
                    const addNeigbour = (row, col, placement) => {
                        let t = this.getTile(row, col);
                        if (t) {
                            if (t.color !== tile.color || t.id !== tile.id) {
                                neighbours |= placement;
                            }
                        }
                    }

                    addNeigbour(row-1, col, Neighbours.TOP);
                    addNeigbour(row+1, col, Neighbours.BOTTOM);
                    addNeigbour(row, col-1, Neighbours.LEFT);
                    addNeigbour(row, col+1, Neighbours.RIGHT);

                    addNeigbour(row-1, col-1, Neighbours.TOP_LEFT);
                    addNeigbour(row+1, col-1, Neighbours.BOTTOM_LEFT);
                    addNeigbour(row-1, col+1, Neighbours.TOP_RIGHT);
                    addNeigbour(row+1, col+1, Neighbours.BOTTOM_RIGHT);
                }

                drawBlockNonUnitScale(x, y, tile.color, neighbours);

                // For unified mouse click mode
                if (tile.gameplay_flags & GameplayFlags.MOVABLE && this.move_set.length < 1) {
                    let {x, y} = game_state.mouse.screen_coord;
                    const top_left = getScreenCoordFromTileCoord(row, col);
                    const bottom_right = {
                        x: top_left.x + top_left.tile_size, 
                        y: top_left.y + top_left.tile_size
                    };
                    
                    // Check whether mouse is within cell
                    if ( (x >= top_left.x && x < bottom_right.x) && (y >= top_left.y && y < bottom_right.y) ) {
                        drawMoveArrow(row, col, x, y);
                    }
                }
            }

        });
    }
};