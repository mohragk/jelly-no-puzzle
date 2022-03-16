import {lerp} from './math.js';


import { drawBlockNonUnitScale, Neighbours, drawBlockText, getScreenCoordFromTileCoord, drawFullScreen, drawMoveArrow } from './game.js';
import { GameplayFlags, Tile } from './tile.js';
import { CommandTypes, ImpossibleCommand } from './command.js';




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
    move_set = [];
    gravity_set = [];
    move_speed = 9.0;
    fall_speed = 9.0;
    color_set = new Set();

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

        
        if (tile.color === original.color && tile.gameplay_flags & GameplayFlags.MERGEABLE) {
            visited.push(tile);
           
            list.push(tile);
            
            this.findMergeTiles(row+1, col+0, list, original, visited);
            this.findMergeTiles(row-1, col+0, list, original, visited);
            this.findMergeTiles(row+0, col+1, list, original, visited);
            this.findMergeTiles(row+0, col-1, list, original, visited);
        }
        if (tile.color === 'black' && original.id === tile.id) {
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
        
        let x = lerp(start.x, target.x, tile.move_t);
        let y = lerp(start.y, target.y, tile.move_t);

        tile.visual_pos[0] = x;
        tile.visual_pos[1] = y;
    }
    
    moveTile(tile, dt) {    
        let fall_dist = tile.target_pos.row - tile.world_pos.row;

        if( fall_dist > 0 ) {
            tile.move_t += (this.fall_speed * dt);
        }
        else {
            tile.move_t += this.move_speed * dt;
        }
          
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

    

    update(command_buffer, dt, game_state, recorder) {

        // Create pieces
        const pieces = [];
        const pieces_grid = [];
        const static_pieces = [];
        const black_pieces = [];
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
            
            for (let piece of pieces) {
                let can_move = true;
               

                outer: for (let tile of piece.tiles) {
                    let r = tile.world_pos.row + 1;
                    let c = tile.world_pos.col;
                    const other_tile = this.getTile(r, c);

                    if (piece.tiles.includes(other_tile)) {
                        continue;
                    }
                    
                    if (other_tile.gameplay_flags) {
                        can_move = false;
                        break outer;
                    }
                    

                }
                if (can_move) {
                    // Pre-pass to get travel distance
                    let max_distance = Infinity;
                    for (let tile of piece.tiles) {
                        let distance = 0;

                        let r = tile.world_pos.row;
                        let c = tile.world_pos.col;

                        while (1) {
                            const next = this.getTile(++r, c);
                            if (piece.tiles.includes(next)) {
                                continue;
                            }
                            if (next.gameplay_flags) {
                                break;
                            }
                            distance += 1;
                        }
                        max_distance = Math.min(max_distance, distance);
                    }

                    // Apply travel distance
                    for (let tile of piece.tiles) {
                        tile.should_move = true;
                        tile.move_t  = 0;
                        tile.target_pos.row += max_distance;
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


    debugRenderCells() {
        this.forEachCell((row, col, index) => {
            const text = this.getTile(row, col).gameplay_flags;
            drawBlockText(row, col, text, "red" )
        });
    }
 
    updateFlash(dt) {
        this.screen_flash_t -= 0.3;

        if (this.screen_flash_t < 0) {
            this.screen_flash_t = 0;
        }
    }

    drawFlash() {
        if (this.screen_flash_t) {
            const alpha = 255 * this.screen_flash_t;
            console.log(alpha)
            drawFullScreen(`rgba(120, 120, 120, ${alpha})`);
        }
    }

    render(game_state) {

        // Draw level
        this.forEachCell((row, col, index) => {
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
                    addNeigbour(row-1, col+1, Neighbours.BOTTOM_RIGHT);

                }



                drawBlockNonUnitScale(x, y, tile.color, neighbours);

                // Check whether mouse is within cell
                if (tile.gameplay_flags & GameplayFlags.MOVABLE && this.move_set.length < 1) {
                    let {x, y} = game_state.mouse.screen_coord;
                    const top_left = getScreenCoordFromTileCoord(row, col);
                    const bottom_right = {
                        x: top_left.x + top_left.tile_size, 
                        y: top_left.y + top_left.tile_size
                    };

                    if ( (x >= top_left.x && x < bottom_right.x) && (y >= top_left.y && y < bottom_right.y) ) {

                        drawMoveArrow(row, col, x, y);
                    }

                }
            }

        });

    }


};