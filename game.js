import { levels }  from './levels2.js';
import { TileTypes } from './tile.js';

import { World } from './world.js';
import { CommandBuffer, Command, Instruction, InstructionTypes, MoveDirections } from './command.js';

let canvas, ctx;


class Recorder {
    history = [];
    count = 0;
    max = 16;

    constructor() {
        this.history.length = this.max;
    }

    add(state) {
        if (this.count >= this.history.length) {
            this.max *= 2;
            this.history.length = this.max;
        }
        this.history[this.count] =  JSON.parse(JSON.stringify(state)) ;
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

let recorder;
let command_buffer;


let game_state = {
    running: false,
    level_colors: new Set(),
    has_won: false,
    level_index : 0,
    mouse: {row: 0, col: 0}
};

let DEBUG_RENDER_WALLS = false;
const DEFAULT_GAMESTATE = {...game_state};

let world = new World();


function reset(level) {
    game_state = {...DEFAULT_GAMESTATE};
    game_state.level_colors = new Set();
    world = new World();
    recorder = new Recorder();
    command_buffer = new CommandBuffer();
    
    const level_index = level - 1;
    loadLevel(level_index, levels, world);
    game_state.level_index = level_index;
    
    game_state.running = true;
    mainLoop();
}





export const MouseButtons = {
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
    
    document.addEventListener("keypress", e => {
        if (e.key === 'z') {
            const prev = recorder.getPrevious();
          
            if (prev) {
                command_buffer.clear();
                world.setState(prev);
            }
          
        }

        if (e.key === 'r') {
            return
            recorder.add(world.getState());
            const level = game_state.level_index;
            loadLevel(level, levels, world);
        }

        if (e.key === 'd') { 
            DEBUG_RENDER_WALLS = !DEBUG_RENDER_WALLS;
        }
    })

    
    function onMouseDown(e) {
        const {offsetX, offsetY} = e;
        const {row, col} = getTileCoordFromScreenCoord(offsetX, offsetY);
        
        if (row < world.dimensions.h && col < world.dimensions.w) {
            const button = e.button;
            if (!command_buffer.hasCommands()) {
                // world.handleClick(button, row, col, command_buffer, recorder);
                const p = world.getPiece(row, col);
                const dir = button === MouseButtons.LEFT ? MoveDirections.LEFT : MoveDirections.RIGHT;
                let command = new Command(p.id, new Instruction(InstructionTypes.MOVE, dir));
                command_buffer.add(command);
                recorder.add(world.getState());
            }
        }
        
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

    const h = level.length;
    const w = level[0].length;
    world.setDimensions(w, h);


    // load level
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

    console.log(world)
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

export function drawBlockText(row, col, text, text_color = "white") {
    const {x, y, tile_size} = getScreenCoordFromTileCoord(row, col);
    ctx.fillStyle = "black";
    ctx.fillRect(x, y, tile_size, tile_size);

    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, tile_size, tile_size);

    ctx.fillStyle = text_color;
    ctx.font = "32px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, x+tile_size/2, y+tile_size/2);
}

export function drawBlock(row, col, color) {
    const {x, y, tile_size} = getScreenCoordFromTileCoord(row, col);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, tile_size, tile_size);
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






function updateAndRender(world)  {
    clearBG("purple");

    world.update(command_buffer);
    world.render();

    if (DEBUG_RENDER_WALLS) {
        world.debugRenderGrid();
    }
    
}


