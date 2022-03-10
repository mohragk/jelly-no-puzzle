
import { Piece, PieceList,  PieceTypes } from './piece.js';
import { Command, Instruction, InstructionTypes, MoveDirections } from './command.js';
import { TileTypes } from './tile.js'

import { drawBlock, getColorForTileType, MouseButtons } from './game.js';




export class World {

    grid = [];
    dimensions = {
        w: 1,
        h: 1
    };
    piece_list;

    // fixed
    empty_id = 0;
    wall_id  = 1;

    constructor() {
        this.piece_list = new PieceList();
    }
   

    setDimensions(w, h) {
        this.dimensions.w = w;
        this.dimensions.h = h;
        this.grid.length = w * h;
    }
    

    getIndex(row, col) {
        return  row * this.dimensions.w + col;
    }


  
    addWallOrEmpty(row, col, type) {
        let id = type === TileTypes.WALL ? this.wall_id : this.empty_id;
        let p = this.piece_list.get(id);
        if (!p) {
            p = new Piece(type);
        }
        const piece_type = type === TileTypes.WALL ? PieceTypes.STATIC : PieceTypes.PASSTHROUGH;
        p.type = type;
        p.id = id;
        p.piece_type = piece_type;
        p.blocks.push({row, col});
        this.piece_list.list[id] = p;
        const index = this.getIndex(row, col);
        this.grid[index] = id;
    
    }

    

    addPiece(row, col, type) {
        if (type === TileTypes.WALL || type === TileTypes.EMPTY) {
            this.addWallOrEmpty(row, col, type);
        }
        else {
            
            const p = new Piece(type);
            const ID = this.piece_list.top_index;
            p.id = ID;
            p.type = PieceTypes.MOVABLE;
            p.blocks.push({row, col})
            const id = this.piece_list.add(p);
            const index = this.getIndex(row, col);
            this.grid[index] = id;
        }
    }


    getPiece(row, col) {
        const id = this.getPieceID(row, col);
        const p = this.piece_list.get(id);
        p.id = id;
        return p;
    }


    getPieceID(row, col) {
        const index = this.getIndex(row, col);
        const id = this.grid[index];
        return id;
    }

    handleClick(button, row, col, command_buffer, recorder) {
        const p = this.getPiece(row, col);
        if (p.type === PieceTypes.MOVABLE) {
            if (button === MouseButtons.LEFT || button === MouseButtons.RIGHT) {
                const dir = button === MouseButtons.LEFT ? MoveDirections.LEFT : MoveDirections.RIGHT;
                let command = new Command(p.id, new Instruction(InstructionTypes.MOVE, dir));
                command_buffer.add(command);

                recorder.add( this.getState() );
            }
        }
    }
  

    forEachTile = (cb) => {
        for (let row = 0; row < this.dimensions.h; row++ ) {
            for (let col = 0; col < this.dimensions.w; col++) {
                const index = row * this.dimensions.w + col;
                cb(row, col, index);
            }
        }
    };

    getState() {
        return {
            dimensions: this.dimensions,
            grid: this.grid,
            piece_list_list: this.piece_list.list,
            empty_id: this.empty_id,
            wall_id: this.wall_id,
            block_id: this.block_id
        }
    }


    setState(s) {
        const state = JSON.parse(JSON.stringify(s));
        this.grid = state.grid;
        this.dimensions = state.dimensions;
        this.piece_list.list = state.piece_list_list;
        this.empty_id = state.empty_id;
        this.wall_id = state.wall_id;
        this.block_id = state.block_id;
    }



    update(command_buffer) {


        
        
        // Check and apply gravity
        if (!command_buffer.hasCommands()) {

            this.piece_list.forEach( (piece, i) => {
                
                if (piece.type !== PieceTypes.MOVABLE) return;

                

                let should_move = true;
    
                for (let block of piece.blocks) { 
                    let {row, col} = block;
                    row++;
                    const p = this.getPiece(row, col);
                    if (p.type !== PieceTypes.PASSTHROUGH) {
                        should_move = false;
                        break;
                    }
                }
    
                if (should_move) {
                    const c = new Command(i, new Instruction(InstructionTypes.MOVE, MoveDirections.DOWN));
                    command_buffer.add(c);
                }
            }); 
        }

        // Check and apply merging of pieces!
        if (!command_buffer.hasCommands()) {
            let matching_pairs = [];


            this.piece_list.forEach( piece => {

                // remove self from lookup
                const lookup_grid = [...this.grid];

                for (let {row, col} of piece.blocks) {
                    const index = this.getIndex(row, col);
                    lookup_grid[index] = this.empty_id;
                }
 
                blocklabel: for (let {row, col} of piece.blocks) {
                    
                    
                    // Check all neighbours of block
                    const checkNeighbour = (row, col) => {
                        const index = this.getIndex(row, col);
                        const id = lookup_grid[index];
                        const other = this.piece_list.get(id);
                        if (other.tile_type === piece.tile_type) {
                            matching_pairs.push([piece.id, other.id])
                            return true;
                        }

                        return false;
                    };

                    {
                        
                        if ( checkNeighbour(row + 1, col) ) break blocklabel;
                        if ( checkNeighbour(row - 1, col) ) break blocklabel;
                        if ( checkNeighbour(row, col + 1) ) break blocklabel;
                        if ( checkNeighbour(row, col - 1) ) break blocklabel;
                    }
                }
            });

            if (matching_pairs.length) {
                // Only bother with 1 pair
                const [f, s] = matching_pairs[0];
                
                const first = this.piece_list.get(f);
                const second = this.piece_list.get(s);

                // Remove other from grid
                for (let {row, col} of second.blocks) {
                    const index = this.getIndex(row, col);
                    this.grid[index] = this.empty_id;
                }
                
                // Copy blocks over
                for (let block of second.blocks) {
                    first.blocks.push(block);
                }
                second.blocks.length = 0;

                // Remove second from list
                this.piece_list.remove(s);

                // Update grid
                for (let {row, col} of first.blocks) {
                    const index = this.getIndex(row, col);
                    this.grid[index] = first.id;
                }

                console.log(this.piece_list)
            }                

        }
        

        if (command_buffer.hasCommands()) {
            let command = command_buffer.pop();
            const {piece_id, instruction} = command;
            const p = this.piece_list.get(piece_id);


       
            if (instruction.type == InstructionTypes.MOVE) {
                
                p.should_move = true;
                p.move_direction = instruction.direction;

                let move_pieces = [p];

                let can_move = true;


               
                
                outer: for (let piece of move_pieces) {
                    
                    // CHECK TO SEE IF WE AND OTHER PIECES CAN MOVE
                    for (let block of piece.blocks) {
                        let {row, col} = block;
                        let [dir_row, dir_col] = piece.move_direction;
                        col += dir_col;
                        row += dir_row;
                        const other = this.getPiece(row, col);
                        if (other.type === PieceTypes.STATIC) {
                            can_move = false;
                            move_pieces.length = 0;
                            break outer;
                        }
                        if (other.type === PieceTypes.MOVABLE) {
                            if (other.id !== piece.id) {
                                other.should_move = true;
                                other.move_direction = piece.move_direction;
                                move_pieces.push(other);
                            }
                        }
                    }
                }
                    
                if (can_move) {
                    const tmp_grid = [...this.grid];
                    for (let piece of move_pieces) {

                        // clear movable blocks from grid state
                        for (let block of piece.blocks) {
                            let {row, col} = block;
                            let index = this.getIndex(row, col);
                            tmp_grid[index] = this.empty_id;
                        }
    
                    }
                    
                    for (let piece of move_pieces) {
                        for (let block of piece.blocks) {
                            let [dir_row, dir_col] = piece.move_direction;
                            block.col += dir_col;
                            block.row += dir_row;
                                    
                            let index = this.getIndex(block.row, block.col);
                            tmp_grid[index] = piece.id;
                        }
                        piece.should_move = false;
                    }


                    this.grid = [...tmp_grid];
                }
               
            }
        }
    }


    

    render() {
        
        
        this.forEachTile( (row, col, index) => {
            const ID = this.grid[index];
            const p = this.piece_list.get(ID);
            if (!p) {
                console.log(index)
                console.log(ID)
                console.log(p)
                console.log(this)
            }
            const type = p.tile_type;
            drawBlock(row, col, getColorForTileType(type));
        });
    }

   
};