import {levels}  from './levels2.js';

let canvas, ctx;


class Recorder {
    history = [];
    count = 0;
    max = 16;

    constructor() {
        this.history.length = this.max;
    }

    add(world) {
        if (this.count >= this.history.length) {
            this.max *= 2;
            this.history.length = this.max;
        }
        this.history[this.count] = world;
        this.count++;
    }

    getPrevious() {
        this.count --;
        if (this.count < 0) {
            this.count = 0;
        }
        return this.history[this.count];
    }
}

let recorder = new Recorder();


class CommandBuffer {

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

   

    commands = [];
    max = 64;
    
    count = 0;
    end = 0;
    start = 0;
}

let command_buffer = new CommandBuffer();


let game_state = {
    running: false,
    level_colors: new Set(),
    has_won: false,
    mouse: {row: 0, col: 0}
};

let DEBUG_RENDER_WALLS = false;
const DEFAULT_GAMESTATE = {...game_state};



function reset(level) {
    game_state = {...DEFAULT_GAMESTATE};
    game_state.level_colors = new Set();
    world = new World(1, 1);
    recorder = new Recorder();
    command_buffer = new CommandBuffer();
   
    const level_index = level - 1;
    loadLevel(level_index, levels, world);
    
    game_state.running = true;
    mainLoop();
}


function getColorForTileType (type) {
    switch (type) {
        case TileTypes.EMPTY: return "lightblue";
        case TileTypes.WALL: return "gray";

        case TileTypes.RED_BLOCK: return "red";
        case TileTypes.BLUE_BLOCK: return "blue";
        case TileTypes.GREEN_BLOCK: return "green";
        default: return "black"
    }
}



const MoveDirections = {
    LEFT:  [0, -1],
    RIGHT: [0, 1],
    DOWN:  [1, 0]
};

const InstructionTypes = {
    MOVE: 0,
    CHECK_GRAVITY: 1
};

class Instruction {
    constructor(type, direction) {
        this.type = type;
        this.direction = direction;
    }
    type      = InstructionTypes.MOVE;
    direction = MoveDirections.LEFT;
};

class Command {
    constructor(id, instruction) {
        this.piece_id = id;
        this.instruction = instruction;        
    }
    piece_id;
    instruction;
}


const TileTypes = {
    EMPTY: 0,
    WALL: 1,

    RED_BLOCK: 10,
    BLUE_BLOCK: 11,
    GREEN_BLOCK: 12,

    BLACK_BLOCK: 20,
};

const PieceTypes = {
    PASSTHROUGH: 0,
    STATIC: 1,
    MOVABLE: 2
};

class World {

    grid = [];
    dimensions = {
        w: 1,
        h: 1
    };
    pieces = [];

    // fixed
    empty_id = 0;
    wall_id  = 1;
    block_id = 2;


    

    getIndex(row, col) {
        return col + row * this.dimensions.w;
    }


    addWall(row, col) {
        const id = this.wall_id;
        let p = this.pieces[id];
        if (!p) {
            p = new Piece(id, TileTypes.WALL);
        }
        
        this.pieces[id] = p;
        p.type = PieceTypes.STATIC;
        p.blocks.push({row, col});
        const index = this.getIndex(row, col);
        this.grid[index] = id;
    }

    addEmpty(row, col) {
        const id = this.empty_id;
        let p = this.pieces[id];
        if (!p) {
            p = new Piece(id, TileTypes.EMPTY);
        }
        
        this.pieces[id] = p;
        p.type = PieceTypes.PASSTHROUGH;
        p.blocks.push({row, col});
        const index = this.getIndex(row, col);
        this.grid[index] = id;
    }

    addPiece(row, col, type) {
        if (type === TileTypes.WALL) {
            this.addWall(row, col);
        }
        else if (type === TileTypes.EMPTY) {
            this.addEmpty(row, col);
        }
        else {
            let id = this.block_id++;
            const p = new Piece(id, type);
            p.type = PieceTypes.MOVABLE;
            p.blocks.push({row, col})
            this.pieces.push(p);
            const index = this.getIndex(row, col);
            this.grid[index] = id;
        }
    }

    getPiece(row, col) {
        const index = this.getIndex(row, col);
        const id = this.grid[index];
        return this.pieces[id];
    }


    handleClick(button, row, col) {
        const p = this.getPiece(row, col);
        if (p.type === PieceTypes.MOVABLE) {
            if (button === MouseButtons.LEFT || button === MouseButtons.RIGHT) {
                const dir = button === MouseButtons.LEFT ? MoveDirections.LEFT : MoveDirections.RIGHT;
                let command = new Command(p.id, new Instruction(InstructionTypes.MOVE, dir));
                command_buffer.add(command);

                recorder.add( JSON.parse(JSON.stringify( this.getState() )) );
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
            pieces: this.pieces,
            empty_id: this.empty_id,
            wall_id: this.wall_id,
            block_id: this.block_id
        }
    }


    setState(s) {
        const state = JSON.parse(JSON.stringify(s))
        this.grid = state.grid;
        this.dimensions = state.dimensions;
        this.pieces = state.pieces;
        this.empty_id = state.empty_id;
        this.wall_id = state.wall_id;
        this.block_id = state.block_id;
    
    }

    update() {

        if (!command_buffer.hasCommands()) {

            // Check and apply merge
            for (let piece of this.pieces) {
                const tmp_grid = [...this.grid];
                // Remove self from grid
                for (let {row, col} of piece.blocks) {
                    const index = this.getIndex(row, col);
                    tmp_grid[index] = this.empty_id;
                }
            }


            // Apply gravity
            for (let piece of this.pieces) {
                let can_move = true;

                for (let block of piece.blocks) {

                }
            }
        }


        while (command_buffer.hasCommands()) {
            let command = command_buffer.pop();
            const {piece_id, instruction} = command;
            const p = this.pieces[piece_id];

            console.log(command)
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
                            break outer;
                        }
                        if (other.type === PieceTypes.MOVABLE) {
                            other.should_move = true;
                            other.move_direction = piece.move_direction;
                            move_pieces.push(other);
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
        this.update();
        
        this.forEachTile( (row, col, index) => {
            const ID = this.grid[index];
            const p = this.pieces[ID];
            const type = p.tile_type;
            drawBlock(row, col, getColorForTileType(type));
        });
    }

   
};

let world = new World();

class Piece {
    
    constructor(id, type) {
        this.id = id;
        this.tile_type = type;
    }
    
    addBlock(block) {
        this.blocks.push(block);
    }

    id;
    type = PieceTypes.PASSTHROUGH;
    tile_type = TileTypes.EMPTY;
    should_move = false;
    move_direction = 0;
    blocks = [];
}



const MouseButtons = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
    BACK: 3,
    FORWARD: 4
};


window.addEventListener("load", main());
function main() {
    canvas = document.getElementById("grid_canvas");
    ctx = canvas.getContext("2d");
    
    canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };
    
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);
    document.addEventListener("keypress", e => {
        if (e.key === 'z') {
            const prev = recorder.getPrevious();
            console.log(prev)
            if (prev) {
                world.setState(prev);
            }
            //world = [...prev];
        }

        if (e.key === 'd') { 
            DEBUG_RENDER_WALLS = !DEBUG_RENDER_WALLS;
        }
    })

    function onMouseDown(e) {
        e.preventDefault();
    };

    function onMouseUp(e) {
        const {offsetX, offsetY} = e;
        const {row, col} = getTileCoordFromScreenCoord(offsetX, offsetY);
        
        if (row < world.dimensions.h && col < world.dimensions.w) {

            const button = e.button;
            world.handleClick(button, row, col);
            
        }
        
    };

    function onMouseMove (e) {
        let {offsetX, offsetY} = e;
        game_state.mouse.x = offsetX;
        game_state.mouse.y = offsetY;
    };
    
   

    // Check level selection
    const select = document.getElementById("level-select");
    for (let i = 0; i < levels.length; i++) {
        let option = document.createElement("option");
        let val = `${i+1}`;
        option.value = val;
        option.text = val;
        select.add(option);
    }
    select.onchange = function(e) {
        const t = e.target.value;
        reset(t)
    }




   reset(1);
}


function loadLevel(index, levels, world) {
    const getTileTypeFromChar = (c) => {
        switch (c) {
            case ' ': return TileTypes.EMPTY;
            case 'x': return TileTypes.WALL;
            case 'r': return TileTypes.RED_BLOCK;
            case 'g': return TileTypes.GREEN_BLOCK;
            case 'b': return TileTypes.BLUE_BLOCK;
        }
    };
    const level = levels[index];

    console.log(world)

    // Pre-pass to get world dimensions...
    
    world.dimensions.h = level.length;
    world.dimensions.w = level[0].length;


    // Actually load level...
    let row = 0;
    let col = 0;

    for (let line of level) {
        for (let c of line) {
           
            const type = getTileTypeFromChar(c);
            world.addPiece(row, col, type);

            col++;
        }
        col = 0;
        row++;
    }

    const cell_size = 72;
    canvas.width  = cell_size * world.dimensions.w;
    canvas.height = cell_size * world.dimensions.h;

}

function mainLoop(time) {
    if (game_state.has_won) {
        alert("You won!")
    }

    if (game_state.running) {
        updateAndRender(world);
        requestAnimationFrame(mainLoop);
    }
}

function clearBG(color) {
    ctx.fillStyle = color;
    ctx.fillRect(0,0,  canvas.width, canvas.height);
}

function drawBlock(row, col, color) {
    const {x, y, tile_size} = getScreenCoordFromTileCoord(row, col);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, tile_size, tile_size);
}

function drawWall(row, col) {
    drawBlock(row, col, "grey");
}

function drawEmpty (row, col) {
    drawBlock(row, col, "lightblue");
}

function getScreenCoordFromTileCoord(row, col) {
    const tile_size = canvas.width / world.dimensions.w;
    let y = row * tile_size;
    let x = col * tile_size;
    return {x, y, tile_size};
}

function getTileCoordFromScreenCoord(x, y) {
    const tile_size = canvas.width / world.dimensions.w;
    let row = Math.floor(y / tile_size);
    let col = Math.floor(x / tile_size);

    return {row, col};
}



function getIndexForGrid(row, col) {
    return row * world_dimensions.w + col;
}

function getTile(row, col, world) {
    const index = getIndexForGrid(row, col);
    return world[index];
}



function floodFindOtherBlocks(world, row, col, piece, tile_type, walls = []) {
    const index = getIndexForGrid(row, col);
    const the_tile = getTile(row, col, world);
    if (the_tile === tile_type) {
        
        // Remove block from grid, add a wall to wall-grid
        world[index] = TileTypes.EMPTY;
        walls[index] = TileTypes.WALL;
        
        piece.addBlock({row, col});
        
        
        floodFindOtherBlocks(world, row -1, col     , piece, tile_type, walls);
        floodFindOtherBlocks(world, row +1, col     , piece, tile_type, walls);
        floodFindOtherBlocks(world, row   , col - 1 , piece, tile_type, walls);
        floodFindOtherBlocks(world, row   , col + 1 , piece, tile_type, walls);
    }
}



function createPiece(row, col, world, tile_type, walls = []) { 
    const p = new Piece(tile_type);
    floodFindOtherBlocks(world, row, col, p, tile_type, walls);
    return p;
}



function updateAndRender(world)  {
    clearBG("purple");

  

    world.render();
    
}


