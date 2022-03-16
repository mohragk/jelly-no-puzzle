import { levels }  from './levels2.js';
import { GameplayFlags, Tile } from './tile.js';

import {lerp} from './math.js';

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
    mouse: {
        dragging: false,
        start_drag: [0,0],
        end_drag:   [0,0],
        start_tile: {row:0, col:0},
        screen_coord: {x: 0, y: 0}
    },
    frame_count: 0
};

let DEBUG_RENDER_WALLS = false;
let TEST_HALF_CLICK = false;

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

    canvas.addEventListener("touchstart", onTouchStart);
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchmove", onTouchMove);
    
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    
    document.addEventListener("keypress", e => {
        if (e.key === 'z') {
            handleUndo();
        }

        if (e.key === 'r') {
           handleReset();
        }

        if (e.key === 'n') {
            handleNext();
        }

        if (e.key === 'd') { 
            DEBUG_RENDER_WALLS = !DEBUG_RENDER_WALLS;
        }

        if (e.key === 't') {
            TEST_HALF_CLICK = !TEST_HALF_CLICK;
        }
    })

    function handleUndo() {
        const prev = recorder.getPrevious();
            world.setState(prev);
            game_state.has_won = false;
    }

    function handleReset() {
        recorder.add(world.grid);
        resetWorld(levels);
        game_state.has_won = false;
    }

    function handleNext() {
        if (game_state.has_won) {
            const index = game_state.level_index + 1;
            reset(index);
            localStorage.setItem('last_level', index);
        }
    }

    function onMouseDown(e) {
        e.preventDefault();
        const {offsetX, offsetY, button} = e;
        let {row, col} = getTileCoordFromScreenCoord(offsetX, offsetY);
       

        if (row < world.dimensions.h && col < world.dimensions.w) {
            const tile = world.getTile(row, col);
            const apply = tile.gameplay_flags & GameplayFlags.MOVABLE && !world.move_set.length && !game_state.has_won;

            if (apply) {
                let dir = button === MouseButtons.LEFT ? MoveDirections.LEFT : MoveDirections.RIGHT;
                if (TEST_HALF_CLICK) {
                    let {x, tile_size} = getScreenCoordFromTileCoord(row, col);
                   
                    let mouse_x = offsetX;
                    let center_x = lerp(x, x + tile_size, 0.5);
                    dir = mouse_x < center_x ?  MoveDirections.RIGHT : MoveDirections.LEFT;
                }

                const c = new MoveCommand({row, col}, dir);
                command_buffer.add(c);
            }
            
        }
    }

    function onMouseMove(e) {
        const {offsetX, offsetY} = e;
        game_state.mouse.screen_coord.x = offsetX;
        game_state.mouse.screen_coord.y = offsetY;
    }

    function getTouchCoord(canvas, e) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.changedTouches[0];
        if (!touch) {
            debugger
        }
        return {
            offsetX: touch.clientX - rect.left,
            offsetY: touch.clientY - rect.top
        }
    }
    
    function onTouchStart(e) {
        e.preventDefault();
        const touches = e.changedTouches;

        const {offsetX, offsetY} = getTouchCoord(canvas, e);
        
        let {row, col} = getTileCoordFromScreenCoord(offsetX, offsetY);
        
        {
            const tile = world.getTile(row, col);
            const apply = tile.gameplay_flags & GameplayFlags.MOVABLE && !world.move_set.length && !game_state.has_won;

            if (apply) {
                game_state.mouse.start_drag = [offsetX, offsetY];
                game_state.mouse.start_tile = {row, col};
                game_state.mouse.dragging = true;
            }

        }
    }

    function onTouchEnd(e) {
        e.preventDefault();

        const {offsetX, offsetY} = getTouchCoord(canvas, e);

        {
            game_state.mouse.end_drag = [offsetX, offsetY];
            
            const {row, col} = game_state.mouse.start_tile;
            const tile = world.getTile(row, col);
            
            
            
            const apply = game_state.mouse.dragging && tile.gameplay_flags & GameplayFlags.MOVABLE && !world.move_set.length && !game_state.has_won;
            game_state.mouse.dragging = false;
            
            if (apply) {
                // Determine direction
                
                const direction = (game_state.mouse.end_drag[0] - game_state.mouse.start_drag[0]) < 0 ? MoveDirections.LEFT : MoveDirections.RIGHT;
                
                const command = new MoveCommand({row, col}, direction);
                command_buffer.add(command);
            }
            
        }
    }


    function onTouchMove(e) {
        e.preventDefault();
        const { offsetX } = getTouchCoord(canvas, e);

        if (game_state.mouse.dragging) {
            const {row, col} = game_state.mouse.start_tile;
            const tile = world.getTile(row, col);

            const direction = (offsetX - game_state.mouse.start_drag[0]) < 0 ? MoveDirections.LEFT : MoveDirections.RIGHT;
            tile.target_pos = {row, col: col + direction};

            const start = getScreenCoordFromTileCoord(row, col);

            const center_x = lerp(start.x, start.x + start.tile_size, 0.5);
            const drag_distance = Math.abs(offsetX - center_x);
            
            let delta =  start.tile_size;
            let t = drag_distance / delta;
            tile.move_t = Math.min(t, 0.5);
        }
    }



    // Add button behaviours
    {
        const button = document.getElementById("undo_button");
        button.onclick = e => {
            handleUndo();
        };
    }
    
    {
        const button = document.getElementById("reset_button");
        button.onclick = e => {
            handleReset();
        };
    }
    {
        const button = document.getElementById("next_button");
        button.onclick = e => {
            handleNext();
        };
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
        localStorage.setItem('last_level', JSON.stringify(t-1));
    }
    
    // Reset to last_saved level
    let level_index = parseInt(localStorage.getItem('last_level')) || 0;
    select.value = `${level_index + 1}`;
    reset(level_index);
}




function loadLevel(index, levels, world) {
    const getTileFromChar = (c) => {
        const t = new Tile();
        switch (c) {
            case ' ': {
            }
            break;
            case 'x': {
                t.gameplay_flags |= GameplayFlags.STATIC;
                t.color = "gray";
            }
            break;
            
            case '0': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGED;
                t.color = 'black';
                t.id = 0;
            }
            break;

            case '1': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGED;
                t.color = 'black';
                t.id = 1;
            }
            break;

            case '2': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGED;
                t.color = 'black';
                t.id = 2;
            }
            break;

            case '3': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGED;
                t.color = 'black';
                t.id = 3;
            }
            break;
            
            case '4': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGED;
                t.color = 'black';
                t.id = 4;
            }
            break;

            case '5': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGED;
                t.color = 'black';
                t.id = 4;
            }
            break;

            case '6': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGED;
                t.color = 'black';
                t.id = 6;
            }
            break;

            case 'r': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGEABLE;
                t.color = "red";
            }
            break;

            case 'g': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGEABLE;
                t.color = "green";
            }
            break;

            case 'b': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.gameplay_flags |= GameplayFlags.MERGEABLE;
                t.color = "blue";
            }
            break;

            case 'sr': {
                t.gameplay_flags |= GameplayFlags.STATIC;
                t.gameplay_flags |= GameplayFlags.MERGEABLE;
                t.color = "red";
            }
            break;

            case 'sg': {
                t.gameplay_flags |= GameplayFlags.STATIC;
                t.gameplay_flags |= GameplayFlags.MERGEABLE;
                t.color = "green";
            }
            break;

            case 'sb': {
                t.gameplay_flags |= GameplayFlags.STATIC;
                t.gameplay_flags |= GameplayFlags.MERGEABLE;
                t.color = "blue";
            }
            break;
        }

        return t;
    };
    const level = levels[index];

    const h = level.length;
    const w = level[0].length;
    world.setDimensions(w, h);


    let row = 0;
    let col = 0;

    for (let line of level) {

        for (let index = 0; index < line.length; index++) {
            let c = line[index];
            if (c === 's') {
                c += line[++index];
            }
            
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

    // First time merge checking!
    const visited = [];
    world.forEachCell((row, col, index) => {
        const tile = world.getTile(row, col);

        if ( (tile.gameplay_flags & GameplayFlags.MERGEABLE)) {
            const merge_list = [];
            world.findMergeTiles(row, col, merge_list, tile, visited);

            if (merge_list.length > 1) {
                for (let t of merge_list) {
                    t.gameplay_flags |= GameplayFlags.MERGED;
                }
            }
        }
    })

    console.log(world)
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

function drawArrowLeft(x, center_y, height, color = "black") {

    let start_x = x - height;
    ctx.beginPath();
    ctx.moveTo(start_x, center_y);
    ctx.lineTo(x, center_y - height/2);
    ctx.lineTo(x, center_y + height/2);
    ctx.fillStyle = color;
    ctx.fill();

}


function drawArrowRight(x, center_y, height, color = "black") {

    let start_x = x + height;
    ctx.beginPath();
    ctx.moveTo(start_x, center_y);
    ctx.lineTo(x, center_y - height/2);
    ctx.lineTo(x, center_y + height/2);
    ctx.fillStyle = color;
    ctx.fill();

}


export function drawMoveArrow(row, col, mouse_x, mouse_y) {
    if (!TEST_HALF_CLICK) return;


    ctx.globalAlpha = 0.6;
    let {x, y, tile_size} = getScreenCoordFromTileCoord(row, col);

    let center_x = lerp(x, x + tile_size, 0.5);
    let center_y = lerp(y, y + tile_size, 0.5);

    let size = tile_size /2;
    
    const left = mouse_x < center_x;
    let start_x = left ? x : center_x;
    
    let color = "white";
    ctx.fillStyle = color;
    
    let r_x = start_x
    let r_y = y;
    let r_w = tile_size /2;
    let r_h = tile_size;
    ctx.fillRect(r_x, r_y, r_w, r_h);

    let h = tile_size / 4;
    if (left) {
        drawArrowRight(center_x, center_y, h, color);
    }
    else {
        drawArrowLeft(center_x, center_y, h, color);
    }

    ctx.globalAlpha = 1.0;

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
        world.render(game_state);
        
        if (game_state.has_won) {
            drawWinText();
        }
    

    if (DEBUG_RENDER_WALLS) {
        world.debugRenderCells();
    }
}


