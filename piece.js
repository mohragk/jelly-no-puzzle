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
    top_index = 1;
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


    get(index) {
        this.list[index];
    }

    remove(index) {
        const last = this.list[this.top_index];
        this.list[index] = last;
        this.top_index--;
        if (this.top_index < 1) {
            this.top_index = 1;
        }
    }

    forEach(cb) {
        for (let i = 0 ; i < this.top_index; i++) {
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