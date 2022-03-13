import { levels }  from './levels2.js';
import { GameplayFlags, Tile } from './tile.js';

import { World } from './world.js';
import { CommandBuffer, MoveCommand, MoveDirections } from './command.js';

let canvas, ctx;
let command_buffer;


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


let game_state = {
    running: false,
    level_colors: new Set(),
    has_won: false,
    level_index : 0,
    mouse: {row: 0, col: 0},
    frame_count: 0
};

let DEBUG_RENDER_WALLS = false;
const DEFAULT_GAMESTATE = {...game_state};

let world = new World();
let last_time = 0;

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
            
        }

        if (e.key === 'r') {

        }

        if (e.key === 'd') { 
            DEBUG_RENDER_WALLS = !DEBUG_RENDER_WALLS;
        }
    })

    
    function onMouseDown(e) {
        const {offsetX, offsetY} = e;
        let {row, col} = getTileCoordFromScreenCoord(offsetX, offsetY);
        
        if (row < world.dimensions.h && col < world.dimensions.w) {
            const button = e.button;
            const tile = world.getTile(row, col);
            const apply = tile.gameplay_flags & GameplayFlags.MOVABLE && !world.move_set.length;

            if (apply) {
                const dir = button === MouseButtons.LEFT ? MoveDirections.LEFT : MoveDirections.RIGHT;
                const c = new MoveCommand({row, col}, dir);
                command_buffer.add(c);
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
    const getTileFromChar = (c) => {
        const t = new Tile();
        switch (c) {
            case ' ': {
                return t;
            }
            case 'x': {
                t.gameplay_flags |= GameplayFlags.STATIC;
                t.color = "gray";
                return t;
            }
            case 'r': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.color = "red";
                return t;
            }
            case 'g': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.color = "green";
                return t;
            }
            case 'b': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.color = "blue";
                return t;
            }
        }
    };
    const level = levels[index];

    const h = level.length;
    const w = level[0].length;
    world.setDimensions(w, h);


    let row = 0;
    let col = 0;

    for (let line of level) {
        for (let c of line) {
           
            const tile = getTileFromChar(c);
            world.putInGrid(row, col, tile);

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

    const dt = (time - last_time) / 1000.0;
    last_time = time;
    if (game_state.running) {
        updateAndRender(world, command_buffer, dt);
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


export function drawBlockNonUnitScale(x, y, color) {
    const size = canvas.width / world.dimensions.w;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
}

export function getScreenCoordFromTileCoord(row, col) {
    const tile_size = canvas.width / world.dimensions.w;
    let y = row * tile_size;
    let x = col * tile_size;
    return {x, y, tile_size};
}



export function getTileCoordFromScreenCoord(x, y) {
    const tile_size = canvas.width / world.dimensions.w;
    let row = Math.floor(y / tile_size);
    let col = Math.floor(x / tile_size);

    return {row, col};
}






function updateAndRender(world, command_buffer, dt) {
    clearBG("lightblue");

    world.update(command_buffer, dt);
    world.render();

    if (DEBUG_RENDER_WALLS) {
        world.debugRenderCells();
    }
}


