import { 
    getTileCoordFromScreenCoord, 
    getTileSize, 
    getScreenCoordFromTileCoord, 
} from './game.js';
import { AnchorPoints, GameplayFlags, Tile } from './tile.js';
import { CommandTypes, MoveDirections } from './command.js';
import { lerp } from './math.js';
import { EventManager, Events } from './events.js';

// NOTE: Neighbours in this case means; tiles that are different 
// in color (or id in case of black tiles) from the current tile.
export const Neighbours = {
    TOP:            (1 << 0),
    BOTTOM:         (1 << 1),
    LEFT:           (1 << 2),
    RIGHT:          (1 << 3),

    TOP_LEFT:       (1 << 4),
    BOTTOM_LEFT:    (1 << 5),
    TOP_RIGHT:      (1 << 6),
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
    move_set = [];
    gravity_set = [];
   
    color_set = new Set();

    // DEBUGGING
    debug_pieces = [];

    event_manager = new EventManager();
    
    debug_grid = [];

    initialized = false;

    setDimensions(w, h) {
        this.dimensions.w = w;
        this.dimensions.h = h;
        this.grid.length = w * h;
    }

    addListener(listener) {
        this.event_manager.addListener(listener);
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
        tile.opengl_visual_pos[0] = col;
        tile.opengl_visual_pos[1] = row;

        // NOTE: this assumes STATIC tiles have one or more corresponding MOVABLE tiles.
        if (tile.gameplay_flags & GameplayFlags.MOVABLE) {
            if (tile.color !== 'black') {
                this.color_set.add(tile.color);
            }
        }
        const grid_index = this.getIndex(row, col);
        this.grid[grid_index] = tile;
    }


    setState(new_grid) {
        if (new_grid) {
            this.grid = [...new_grid];
            this.move_set.length = 0;
        }
    }


    findMergeableWithAnchoredTiles(row, col, list, original, visited, info, ids_to_include) {
        const tile = this.getTile(row, col);

        if (visited.includes(tile)) {
            return;
        }

        if (  tile.color === original.color && tile.gameplay_flags & GameplayFlags.MERGEABLE ) {
                
            if ( tile.id !== original.id ) {
                info.found_candidate = true;
            }
            visited.push(tile);
           
            list.push(tile);
            
            this.findMergeableWithAnchoredTiles(row+1, col+0, list, original, visited, info);
            this.findMergeableWithAnchoredTiles(row-1, col+0, list, original, visited, info);
            this.findMergeableWithAnchoredTiles(row+0, col+1, list, original, visited, info);
            this.findMergeableWithAnchoredTiles(row+0, col-1, list, original, visited, info);
        }
    }


    findMergeableTiles(row, col, list, original, visited, info) {
        const tile = this.getTile(row, col);

        if (visited.includes(tile)) {
            return;
        }

        if (  tile.color === original.color && tile.gameplay_flags & GameplayFlags.MERGEABLE ) {
                
            if ( tile.id !== original.id ) {
                info.found_candidate = true;
            }
            visited.push(tile);
           
            list.push(tile);
            
            this.findMergeableTiles(row+1, col+0, list, original, visited, info);
            this.findMergeableTiles(row-1, col+0, list, original, visited, info);
            this.findMergeableTiles(row+0, col+1, list, original, visited, info);
            this.findMergeableTiles(row+0, col-1, list, original, visited, info);
        }
    }

   

    findMergedTiles(row, col, list, original, visited) {
        const tile = this.getTile(row, col);
        if (!tile) return;

        if (visited.includes(tile)) {
            return;
        }
        
        if ( tile.id === original.id) {
            visited.push(tile);
           
            list.push(tile);
            
            this.findMergedTiles(row+1, col+0, list, original, visited);
            this.findMergedTiles(row-1, col+0, list, original, visited);
            this.findMergedTiles(row+0, col+1, list, original, visited);
            this.findMergedTiles(row+0, col-1, list, original, visited);
        }
    }

    


    updateTile(tile) {
       
        let opengl_x = lerp(tile.world_pos.col, tile.target_pos.col, tile.move_t);
        let opengl_y = lerp(tile.world_pos.row, tile.target_pos.row, tile.move_t);
        tile.opengl_visual_pos[0] = opengl_x;
        tile.opengl_visual_pos[1] = opengl_y; 

    }

    updateAllTiles() {
        this.forEachCell((row, col, index) => {
            this.updateTile(this.grid[index]);
        });
    }
    
    moveTile(tile, game_state, dt) {    
        if (!tile.should_move)  return;

        let delta_row = tile.target_pos.row - tile.world_pos.row;
        if (delta_row) {
            tile.move_t += (game_state.fall_speed * dt);
        }
        else {
            tile.move_t += game_state.move_speed * dt;
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

    handleCommands(command_buffer, undo_recorder, pieces, pieces_grid) {
      
        if (!command_buffer.hasCommands()) {
            return;
        }
        

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
                this.event_manager.pushEvent(Events.MOVE)

                undo_recorder.add(this.grid);
                
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
                this.event_manager.pushEvent(Events.IMPOSSIBLE)
            }    
        }
    }

    createPieces(pieces, pieces_grid) {

        // Find all movable pieces
        const visited = [];
        this.forEachCell( (row, col) => {
            const tile = this.getTile(row, col);
            if (visited.includes(tile)) return 
            
            if (tile.gameplay_flags & GameplayFlags.MOVABLE) {
                const piece = new Piece();
                piece.color = tile.color;
                
                const merged_tiles = [];
                
                this.findMergedTiles(tile.world_pos.row, tile.world_pos.col, merged_tiles, tile, visited);
                
                piece.tiles = [...merged_tiles];

                pieces.push(piece);
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


    // NOTE: We clear and update the grid AFTER we're done with moving
    // all the tiles in the move_set. Otherwise, a tile could clear
    // a tile but, that tile is actually part of the move_set. 
    // Doing it in 2 passes solves this issue, although there might be a better
    // solution for this.
    updateMoveset(game_state, dt) {
        let done = true;
        for (let piece of this.move_set) {
            for (let tile of piece.tiles) {
                this.moveTile(tile, game_state, dt);
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
    }


    // To check whether pieces should move, recursively fill out a 
    // temporary grid by checking a piece for mobility and paint in all 
    // pieces that are static. All the leftover pieces _are_ movable and 
    // should have gravity applied to them.
    applyGravity(pieces) {
        const flags_grid = this.grid.map(t => t.gameplay_flags); 
        const movables = [...pieces];
        let changed = true;
        let has_gravity_tiles = false;
        while (changed) {
            let piece_changed = false;
            movables.forEach((piece, i) => {
                let can_move = true;
                for (let tile of piece.tiles) {
                    const {row, col} = tile.world_pos;
                    const other_index = this.getIndex(row+1, col);
                    const flags = flags_grid[other_index];
                    
                    if (flags & GameplayFlags.STATIC) {
                        can_move = false;
                        break;
                    }
                }
                if (!can_move) {
                    // Update flags_grid grid
                    for (let tile of piece.tiles) {
                        const {row, col} = tile.world_pos;
                        const index = this.getIndex(row, col);
                        flags_grid[index] = GameplayFlags.STATIC;
                    }
                    movables.splice(i, 1);
                    piece_changed = true;
                }
            })
            
            changed = piece_changed;
        }
        
        
        if (movables.length) {
            has_gravity_tiles = true;
                      
            this.event_manager.pushEvent(Events.BEGIN_FALL);

            for (let piece of movables) 
            {
               for (let tile of piece.tiles) {
                    tile.target_pos.row += 1;
                    tile.should_move = true;
                    tile.move_t = 0;
                }
                this.move_set.push(piece);
            }
        }

        return has_gravity_tiles;
    }


    findAndApplyMerges(skip_event = false) {
        //const visited = [];
        this.forEachCell((row, col, index) => {
            const tile = this.getTile(row, col);
            if ( (tile.gameplay_flags & GameplayFlags.MERGEABLE) ) {
                let merge_list = [];
                let merge_info = {
                    found_candidate: false
                };
                this.findMergeableTiles(row, col, merge_list, tile, [], merge_info);
                if (merge_info.found_candidate && !skip_event) {
                    this.event_manager.pushEvent(Events.BEGIN_MERGE)
                }

                const is_static = merge_list.filter(t => t.gameplay_flags & GameplayFlags.STATIC).length > 0;
                
                if (merge_list.length > 1) {
                    for (let t of merge_list) {
                        t.id = tile.id;
                        if (is_static) {
                            t.gameplay_flags |= GameplayFlags.STATIC;
                            t.gameplay_flags &= ~(GameplayFlags.MOVABLE);
                        }
                    }
                }
            }
        })



        // FIND AND APPLY ANCHORED MERGES 
        {
            const getTileForAnchorPoint = (row, col, anchor) => {
                if (anchor & AnchorPoints.N) {
                    return this.getTile(row-1, col);
                }
                if (anchor & AnchorPoints.S) {
                    return this.getTile(row+1, col);
                }
                if (anchor & AnchorPoints.E) {
                    return this.getTile(row, col+1);
                }
                if (anchor & AnchorPoints.W) {
                    return this.getTile(row, col-1);
                }
            };
            const getPieceForAnchorPoint = (row, col, anchor) => {
                let result;
                const tile = getTileForAnchorPoint(row, col, anchor);

                if (!tile) return;
                
                if (tile.gameplay_flags) 
                {
                    const piece = new Piece();
                    piece.color = tile.color;
                    
                    const merged_tiles = [];
                    this.findMergedTiles(tile.world_pos.row, tile.world_pos.col, merged_tiles, tile, []);
                    piece.tiles = [...merged_tiles];

                    result = piece;
                }

                return result;
            }

            this.forEachCell( (r, c, index) => {
                const tile = this.getTile(r,c);
                if (!tile.gameplay_flags) return;
                
                const dominant_id = tile.id;

                if (tile.anchor_points) {
                    const other_piece = getPieceForAnchorPoint(r,c, tile.anchor_points);
                    if (other_piece && other_piece.tiles.length) {

                        if (other_piece.tiles[0].id === tile.id) {
                            return 
                        }

                        // Force dominant_id unto other piece
                        for (let t of other_piece.tiles) {
                            t.id = dominant_id;
                        }

                        const is_static = other_piece.tiles.filter(t => t.gameplay_flags & GameplayFlags.STATIC).length > 0 || tile.gameplay_flags & GameplayFlags.STATIC;
                        if (is_static) {
                            tile.gameplay_flags |= GameplayFlags.STATIC;
                            tile.gameplay_flags &= ~(GameplayFlags.MOVABLE);

                            for (let t of other_piece.tiles) {
                               
                                t.gameplay_flags |= GameplayFlags.STATIC;
                                t.gameplay_flags &= ~(GameplayFlags.MOVABLE);
                            }
                        }   
                    }
                }
            });
        }
    }

    // NOTE: this is only in column axis, above and below are not checked
    findClosestMovable(row, col, mouse_x) {
        let min_distance_pixels_sq = 10000000;
        let candidate;

        let r = row;
        for (let c = col-1; c <= col+1; c++) {
            const t = this.getTile(r, c);
            if (t) {
                if (t.gameplay_flags & GameplayFlags.MOVABLE) {
                    const {x, tile_size} = getScreenCoordFromTileCoord(r, c);
                    const center_x = lerp(x, x + tile_size, 0.5);
                    const diff_x = Math.abs(center_x - mouse_x);
                    if (diff_x < min_distance_pixels_sq) {
                        min_distance_pixels_sq = diff_x;
                        candidate = t;
                    }
                }
            }
        }

        return candidate;
    }

    findSameTilesInRow(row, col, id, list) {
        const tile = this.getTile(row, col);
        if (list.includes(tile)) return

        if (tile.id === id) {
            list.push(tile);
            this.findSameTilesInRow(row, col+1, id, list);
            this.findSameTilesInRow(row, col-1, id, list);
        }
    }

    selectTiles(row, col, mouse_x) {
        const closest = this.findClosestMovable(row, col, mouse_x);
        let selected = [];
        if (closest) {
            this.findSameTilesInRow(closest.world_pos.row, closest.world_pos.col, closest.id, selected);
        }

        return {closest, selected};
    }


    handleInput(game_state)  {
        const mouse_x = game_state.mouse.screen_coord.x;
        const mouse_y = game_state.mouse.screen_coord.y;

        const {row, col} = getTileCoordFromScreenCoord(mouse_x, mouse_y);
        const {selected} = this.selectTiles(row, col, mouse_x);

            if (selected.length) {
                selected.sort((a, b) => {
                    if (a.world_pos.col < b.world_pos.col) return -1;
                    if (a.world_pos.col > b.world_pos.col) return 1;
                    return 0;
                })
                const count = selected.length;
                const first_pos = selected[0].world_pos;
                const left = getScreenCoordFromTileCoord(first_pos.row, first_pos.col);
                const right_x = left.x + ((count) * getTileSize());
                const center_x = lerp(left.x, right_x, 0.5); 

                // define which edge tile we select
                const dir = mouse_x < center_x ?  MoveDirections.RIGHT : MoveDirections.LEFT;
                game_state.selected_tiles = selected;
                game_state.selected_move_dir = dir;
            }
            else {
                game_state.selected_tiles.length = 0;
                game_state.selected_move_dir = null;
            }
    }

    drawMouseCursor(game_state, renderer) {
        if (!game_state.show_cursor) return;

        const getWorldPosForScreenPos = (screen_coord) => {
            const tile_size_pixels = renderer.canvas.width / this.dimensions.w;
            const col = screen_coord.x / tile_size_pixels;
            const row = screen_coord.y / tile_size_pixels;
            return [col-0.5 , row-0.5];
        };
        
        const [x, y] = getWorldPosForScreenPos(global_mouse_pos);
        const dir = ( game_state.has_won || input_mode === InputModes.CLASSIC) ? false : game_state.selected_move_dir;
        renderer.pushCursorQuad("white", [x, y, -1.0], dir, 2.2);
    }


    drawSelectedTileOverlays(game_state, renderer) {
        if (game_state.has_won || input_mode === InputModes.CLASSIC) return;

        const tiles = game_state.selected_tiles;
        for (let tile of tiles) {
            const position = tile.opengl_visual_pos;
            renderer.pushCircleQuad("white", [...position, -1.0], 0.15);
        }
    }



    update(command_buffer, dt, game_state, undo_recorder) {
        
        this.handleInput(game_state);
        
        const is_moving = this.move_set.length;
        if (!is_moving) {
            const pieces_grid = [];
            const movable_pieces = [];
            this.createPieces(movable_pieces, pieces_grid);
            
            const cancel_merge = this.applyGravity(movable_pieces);
            if (!cancel_merge) {
                this.findAndApplyMerges();
            }
      
            this.handleCommands(command_buffer, undo_recorder, movable_pieces, pieces_grid);
        }
        
        this.updateMoveset(game_state, dt);
        this.updateAllTiles();


        // CHECK WIN CONDITION
        if (!game_state.halt_input) {
            // @SPEED: maybe there's a more efficient way to do this,
            // but for now, just create pieces and see if it exceeds the color_set
            // size.

            let pieces_count = 0;
            const visited = [];
            this.forEachCell((row, col) => {
                const tile = this.getTile(row, col);
                if (visited.includes(tile)) return
                
                if ( (tile.gameplay_flags & GameplayFlags.MERGEABLE) ) {
                    this.findMergeableTiles(row, col, [], tile, visited, {});
                    pieces_count += 1;                    
                }
            })
            
            let succes = pieces_count === this.color_set.size;
            if (succes) {
                game_state.has_won = true;
            }
        }

    }



    drawAnchors(renderer) {
        this.forEachCell( (row, col, index) => {
            const tile = this.getTile(row, col);
            if (tile) {
                this.drawAnchorsForTile(renderer, tile);
            }
        });
    }

   

    drawAnchorsForTile(renderer, tile) {
        const [vx, vy] = tile.opengl_visual_pos;
        const color = tile.color;

        const tile_size = 1.0;
        const half_dim = tile_size /2;
       
        const anchor_size = tile_size / 4;
        
        const positions = tile.anchor_points;
        let x = vx;
        let y = vy;
        
        if (positions & AnchorPoints.N) {
            renderer.pushColoredQuad(color, [x, y-half_dim, -1], anchor_size);
        }
        if (positions & AnchorPoints.S) {
            renderer.pushColoredQuad(color, [x, y+half_dim, -1], anchor_size);
        }
        if (positions & AnchorPoints.E) {
            renderer.pushColoredQuad(color, [x+half_dim, y, -1], anchor_size);
        }
        if (positions & AnchorPoints.W) {
            renderer.pushColoredQuad(color, [x-half_dim, y, -1], anchor_size);
        }
    }

    shouldAddNeigbour = (row, col, tile) => {
        let t = this.getTile(row, col);
        if (t) {
            return (t.id !== tile.id)
        }
        return false;
    };

    drawMovables(renderer) {

        this.forEachCell((row_, col_, index) => {
            const tile = this.grid[index];
            if ((tile.gameplay_flags > 0)) {
                const {row, col} = tile.world_pos;
                
               
                let neighbours = 0;
                
                neighbours |= this.shouldAddNeigbour(row-1, col, tile) ? Neighbours.TOP    : 0;
                neighbours |= this.shouldAddNeigbour(row+1, col, tile) ? Neighbours.BOTTOM : 0; 
                neighbours |= this.shouldAddNeigbour(row, col-1, tile) ? Neighbours.LEFT   : 0; 
                neighbours |= this.shouldAddNeigbour(row, col+1, tile) ? Neighbours.RIGHT  : 0; 
                
                neighbours |= this.shouldAddNeigbour(row-1, col-1, tile) ? Neighbours.TOP_LEFT     : 0;
                neighbours |= this.shouldAddNeigbour(row+1, col-1, tile) ? Neighbours.BOTTOM_LEFT  : 0;
                neighbours |= this.shouldAddNeigbour(row-1, col+1, tile) ? Neighbours.TOP_RIGHT    : 0;
                neighbours |= this.shouldAddNeigbour(row+1, col+1, tile) ? Neighbours.BOTTOM_RIGHT : 0;
                
                if (tile.gameplay_flags & GameplayFlags.MOVABLE) {
                    renderer.pushTile( tile.color, tile.opengl_visual_pos, neighbours, false );
                }
                else if (tile.color !== "gray") {
                    renderer.pushTile( tile.color, tile.opengl_visual_pos, neighbours, true );
                }
               
            }
        });

    }
 

    render(renderer, game_state) {
        
        
        // DRAW MOVABLES
        {
            this.drawMovables(renderer);
        }    
        
        // DRAW ANCHORS
        {
            this.drawAnchors(renderer);
        }

        this.drawSelectedTileOverlays(game_state, renderer);
        this.drawMouseCursor(game_state, renderer);

        // PRE-DRAW BACKGROUND ELEMENTS TO TEXTURE
        if (!this.initialized) {
            this.initialized = true;
            this.forEachCell((row, col, index) => {
                const tile = this.grid[index];
                if ((tile.gameplay_flags > 0 ) && tile.color === "gray" ) {

                    const addNeigbour = (row, col, placement) => {
                        let t = this.getTile(row, col);
                        if (t) {
                            if (t.color !== "gray" ) {
                                neighbours |= placement;
                            }
                            if (t.id === tile.id) {
                                neighbours &= ~(placement);
                            }
                        }
                    };
                    let neighbours = 0;
                    
                    addNeigbour(row-1, col, Neighbours.TOP);
                    addNeigbour(row+1, col, Neighbours.BOTTOM);
                    addNeigbour(row, col-1, Neighbours.LEFT);
                    addNeigbour(row, col+1, Neighbours.RIGHT);
                    
                    addNeigbour(row-1, col-1, Neighbours.TOP_LEFT);
                    addNeigbour(row+1, col-1, Neighbours.BOTTOM_LEFT);
                    addNeigbour(row-1, col+1, Neighbours.TOP_RIGHT);
                    addNeigbour(row+1, col+1, Neighbours.BOTTOM_RIGHT);
                    renderer.pushEnvironmentQuad(tile.color, tile.opengl_visual_pos, 1.0, neighbours);
                
                }
            });
        }
    }
    
};