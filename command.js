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


export class CommandBuffer {

    constructor() {
        this.commands.length = this.max;
    }

    add(command) {
        this.commands[this.end++] = command;
        this.end %= this.max;
        this.count++;
    }

    get() {
        let c = this.commands[this.start];
        return c;
    }

    pop() {
        let c = this.commands[this.start++];
        this.start %= this.max;
        this.count--;
        return c;
    }

    hasCommands() {
        return this.count > 0;
    }

    clear() {
        this.count = 0;
        this.start = 0;
        this.end = 0;
        this.commands = [];
        this.commands.length = this.max;
    }
   

    commands = [];
    max = 8;
    
    count = 0;
    end = 0;
    start = 0;
}
