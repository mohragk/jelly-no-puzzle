import { TileTypes } from './tile.js'


export class Piece {
    
    constructor(type) {
        this.tile_type = type;
    }
    
    addBlock(block) {
        this.blocks.push(block);
    }
    type = PieceTypes.PASSTHROUGH;
    tile_type = TileTypes.EMPTY;
    should_move = false;
    move_direction = 0;
    blocks = [];
    
}

export class PieceList {
    list = [];
    non_world_start = 2;
    top_index = this.non_world_start;
    max = 16;

    constructor() {
        this.list.length = this.max;
    }

    add(piece) {
        if (this.top_index >= this.list.length) {
            this.max *= 2;
            this.list.length = this.max;
        }

        this.list[this.top_index++] = piece;

        return this.top_index - 1;
    }

    cloneState() {
        return {
            list: [...this.list],
            non_world_start: this.non_world_start,
            top_index: this.top_index,
            max: this.max
        }
    }

    remake(state) {
        this.list.length = state.max;
        this.list = [...state.list];
        this.max = state.max;
        this.top_index = state.top_index;
        this.non_world_start = state.non_world_start;
    }


    get(index) {
        return this.list[index];
    }

    remove(index) {
        if (index < this.top_index - 1) {
            const last = this.list[this.top_index - 1];
            this.list[index] = last;
        }
        this.top_index -= 1;
        if (this.top_index < this.non_world_start) {
            this.top_index = this.non_world_start;
        }
    }

    forEach(cb) {
        for (let i = this.non_world_start ; i < this.top_index; i++) {
            const p = this.list[i];
            cb(p, i);
        }
    } 
}



export const PieceTypes = {
    PASSTHROUGH: 0,
    STATIC: 1,
    MOVABLE: 2
};