import { levels }  from './levels2.js';
import { TileTypes } from './tile.js';

import { World } from './world.js';
import { CommandBuffer } from './command.js';

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
        this.history[this.count] = JSON.parse(JSON.stringify( world ));
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


export function getColorForTileType (type) {
    switch (type) {
        case TileTypes.EMPTY: return "lightblue";
        case TileTypes.WALL: return "gray";

        case TileTypes.RED_BLOCK: return "red";
        case TileTypes.BLUE_BLOCK: return "blue";
        case TileTypes.GREEN_BLOCK: return "green";
        default: return "black"
    }
}






let world = new World();



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
    
    canvas.addEventListener("mousemove", onMouseMove);
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
                world.handleClick(button, row, col, command_buffer, recorder);
            }
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

    ctx.fillStyle = text_color;
    ctx.fillText(text, x+12, y+12);
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





function updateAndRender(world)  {
    clearBG("purple");

    world.update(command_buffer);
    world.render();

    if (DEBUG_RENDER_WALLS) {
        world.debugRenderGrid();
    }
    
}


