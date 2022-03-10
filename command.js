export const MoveDirections = {
    LEFT:  [0, -1],
    RIGHT: [0, 1],
    DOWN:  [1, 0]
};

export const InstructionTypes = {
    MOVE: 0,
};

export class Instruction {
    constructor(type, direction) {
        this.type = type;
        this.direction = direction;
    }
    type      = InstructionTypes.MOVE;
    direction = MoveDirections.LEFT;
};

export class Command {
    constructor(id, instruction) {
        this.piece_id = id;
        this.instruction = instruction;        
    }
    piece_id;
    instruction;
}

