export const MoveDirections = {
    LEFT:  -1,
    RIGHT: 1,
    DOWN:  10
};

export const CommandTypes = {
    MOVE: 0
};

export class MoveCommand {
    constructor(coord, direction) {
        this.coord = coord;
        this.direction = direction;        
    }
    coord;
    direction;
    type = CommandTypes.MOVE;
}


// NOTE: Essentially a ringbuffer for storing commands. 
export class CommandBuffer {

    constructor(max_count = 8) {
        this.max = max_count;
        this.commands.length = this.max;
    }

    add(command) {
        this.commands[this.end++] = command;
        this.end %= this.max;
        this.count++;
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
