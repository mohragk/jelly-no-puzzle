export const MoveDirections = {
    LEFT:  -1,
    RIGHT: 1,
    DOWN:  10
};

export class MoveCommand {
    constructor(coord, direction) {
        this.coord = coord;
        this.direction = direction;        
    }
    coord;
    direction;
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
    max = 32;
    
    count = 0;
    end = 0;
    start = 0;
}
