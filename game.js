import { levels }  from './levels2.js';
import { GameplayFlags, Tile } from './tile.js';

import { Recorder } from './recorder.js';

import { World } from './world.js';
import { CommandBuffer, MoveCommand, MoveDirections } from './command.js';

let canvas, ctx;
let command_buffer;


let recorder = new Recorder();
export const EdgePlacements = {
    TOP: 0,
    BOTTOM: 1,
    LEFT: 2,
    RIGHT: 3
};


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

function reset(level_index) {

 
    if (level_index < levels.length) {
        const select = document.getElementById("level-select");
        select.value = level_index + 1;

        game_state = {...DEFAULT_GAMESTATE};
       
        world = new World();
        recorder = new Recorder();
        command_buffer = new CommandBuffer();
        
        loadLevel(level_index, levels, world);
        game_state.level_index = level_index;
        
        game_state.running = true;
    
       
        mainLoop();
    }
}

function resetWorld(levels) {
    world = new World();
    const level_index = game_state.level_index;
    loadLevel(level_index, levels, world);
    
    game_state.running = true;
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
            world.setState(prev);
            game_state.has_won = false;
        }

        if (e.key === 'r') {
            recorder.add(world.grid);
            resetWorld(levels);
            game_state.has_won = false;
        }

        if (e.key === 'n') {
            if (game_state.has_won) {
                reset(game_state.level_index + 1);
            }
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
            const apply = tile.gameplay_flags & GameplayFlags.MOVABLE && !world.move_set.length && !game_state.has_won;

            if (apply) {
                const dir = button === MouseButtons.LEFT ? MoveDirections.LEFT : MoveDirections.RIGHT;
                const c = new MoveCommand({row, col}, dir);
                command_buffer.add(c);
            }
        }
    }

   
   

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
        reset(t - 1)
    }
    
    // Reset to first level
    reset(0);
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
}

function mainLoop(time) {
    

    const dt = (time - last_time) / 1000.0;
    last_time = time;
    {
        updateAndRender(world, command_buffer, dt);
        requestAnimationFrame(mainLoop);
    }
}

function clearBG(color) {
    drawFullScreen(color);
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

export function drawFullScreen(color) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = color;
    ctx.fillRect(0,0, w, h);
}


export function drawBlockNonUnitScale(x, y, color, edges = []) {
    const size = canvas.width / world.dimensions.w;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = "lightgray";
    const edge_thickness = size / 18;
    for (let edge of edges) {
        switch (edge) {
            case EdgePlacements.TOP: {
                ctx.fillRect(x, y, size, edge_thickness);
            }
            break;
            case EdgePlacements.BOTTOM: {
                ctx.fillRect(x, y + size - edge_thickness, size, edge_thickness);
            }
            break;
            case EdgePlacements.LEFT: {
                ctx.fillRect(x, y, edge_thickness, size);
            }
            break;
            case EdgePlacements.RIGHT: {
                ctx.fillRect( x + size - edge_thickness, y, edge_thickness, size);
            }
            break;

        }
    }
}

export function getScreenCoordFromTileCoord(row, col) {
    const tile_size = canvas.width / world.dimensions.w;
    let y = Math.floor(row * tile_size);
    let x = Math.floor(col * tile_size);
    return {x, y, tile_size};
}



export function getTileCoordFromScreenCoord(x, y) {
    const tile_size = canvas.width / world.dimensions.w;
    let row = Math.floor(y / tile_size);
    let col = Math.floor(x / tile_size);

    return {row, col};
}



function drawWinText() {
    const text = "You won!";
    ctx.font = "72px sans-serif";
    ctx.fillStyle = "black";
    ctx.textAlign = "center"
    const {width, fontBoundingBoxAscent} = ctx.measureText(text);

    ctx.fillText(text, canvas.width/2, canvas.height/2 - (fontBoundingBoxAscent/2));

    ctx.font = "28px sans-serif";
    ctx.textAlign = "center"
    ctx.fillText("Press 'N' to go to next level.", canvas.width/2, canvas.height/2 + (fontBoundingBoxAscent));
}


function updateAndRender(world, command_buffer, dt) {
    clearBG("darkgray");

    
    
        world.update(command_buffer, dt, game_state, recorder);
        world.render();
        
        if (game_state.has_won) {
            drawWinText();
        }
    

    if (DEBUG_RENDER_WALLS) {
        world.debugRenderCells();
    }
}


