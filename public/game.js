import { levels }  from './levels2.js';

import {lerp, lerpToInt} from './math.js';
import { GameplayFlags, Tile } from './tile.js';

import { World, Neighbours } from './world.js';
import { Recorder } from './recorder.js';
import { DelayedTrigger } from './delayedtrigger.js';
import { CommandBuffer, MoveCommand, MoveDirections } from './command.js';
import { Events } from './events.js';

import {AudioPlayer} from './audio.js';







const DEV_MODE = false;




let audio_player = new AudioPlayer();




function shakeCanvas() {
    canvas.classList.add("add_shake")
    window.setTimeout(() => canvas.classList.remove("add_shake"), 250)
}

let fallen_trigger = new DelayedTrigger(0.1, () => {
    audio_player.trigger(thump01_clip);
    canvas.classList.add("add_gravity_shake_mild")
    window.setTimeout(() => canvas.classList.remove("add_gravity_shake_mild"), 250)
});


// NOTE: sound clips are loaded via the DOM, maybe move that
// to actual JS?
let thump01_clip = document.getElementById('thump01_sound');
let tap01_clip = document.getElementById('tap01_sound');
let fail01_sound = document.getElementById('fail01_sound');
let glup01_sound = document.getElementById('glup01_sound');
let move01_sound = document.getElementById('move01_sound');
let victory_flute_sound = document.getElementById('victory_flute_sound');


let canvas, ctx;
let game_state; 
let command_buffer;
let recorder;
let event_listener = {
    handleEvent: (e) => {

        if (e === Events.VICTORY) {
            audio_player.trigger(victory_flute_sound);
        }

        if (e === Events.MOVE) {
            audio_player.trigger(move01_sound);
        }

        if (e === Events.BEGIN_MERGE) {
            audio_player.trigger(glup01_sound)
        }
        
        if (e === Events.IMPOSSIBLE) {
            shakeCanvas();
            audio_player.trigger(tap01_clip);
        }

        if (e === Events.BEGIN_FALL) {
            fallen_trigger.armAndReset();
        }
    }
}







const DEFAULT_GAMESTATE = {
    running: false,
    level_colors: new Set(),
    has_won: false,
    level_index : 0,
    mouse: {
        dragging: false,
        start_drag: [0,0],
        end_drag:   [0,0],
        start_tile: {row: 0, col: 0},
        over_tile:  {row: 0, col: 0},
        screen_coord: {x: 0, y: 0},
    },
    frame_count: 0,
    debug_time_enabled : false,

};



let DEBUG_RENDER = false;
let ENABLE_UNIFIED_CLICK = true;


let world = new World();


function reset(level_index) {

    canvas.classList.remove("add_victory_animation");
    document.body.classList.remove("animated-bgcolors");

    if (level_index < levels.length) {
        const button = document.getElementById("next_button");
        button.style.visibility = "hidden";

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
    canvas.classList.remove("add_victory_animation");
    document.body.classList.remove("animated-bgcolors");
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

const isEven = (n) => n % 2 === 0

function resizeCanvas(canvas) {
    const getCellSize = (prefer_width, world_dim) => {
        const div = document.getElementById("canvas-container");
        const window_dim = prefer_width ? div.clientWidth : window.innerHeight - 20;
        const window_w = Math.min(window_dim);
        return Math.floor(window_w / world_dim);
    };
    
    let cell_size = getCellSize(true, world.dimensions.w);
    let new_h = cell_size * world.dimensions.h;
    if (new_h > window.innerHeight) {
        cell_size = getCellSize(false, world.dimensions.h);
        new_h = cell_size * world.dimensions.h;
    }
    // NOTE: Introdces small error for better tile rendering
    if (!isEven(cell_size)) {
        cell_size -= 1;
    }
    let new_w = cell_size * world.dimensions.w;


    canvas.width  = new_w;
    canvas.height = new_h;
}

window.addEventListener("load", main);
window.addEventListener("orientationchange", () => { resizeCanvas(canvas) });
window.addEventListener("resize", () => { resizeCanvas(canvas) });

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
        e.preventDefault();
        if (e.key === 'z') {
            handleUndo();
        }

        if (e.key === 'r') {
           handleReset();
        }

        if (e.key === 'n') {
            handleNext();
        }

        
        if (DEV_MODE) {
            if (e.key === 'd') {
                DEBUG_RENDER = !DEBUG_RENDER;
            }
            // Time dilation
            if (e.key === '-') {
                time_step_f *= 2;
            }
            if (e.key === '=') {
                time_step_f /= 2;
            }
        }
        

        if (e.key === 'm') {
            ENABLE_UNIFIED_CLICK = !ENABLE_UNIFIED_CLICK;
        }
    })

    function handleUndo() {
        canvas.classList.remove("add_victory_animation");
        document.body.classList.remove("animated-bgcolors");
        const prev = recorder.getPrevious();
        world.setState(prev);
       // command_buffer.clear(); // maybe not necessary
        game_state.has_won = false;
        game_state.running = true;
    }

    function handleReset() {
        recorder.add(world.grid);
        resetWorld(levels);
        game_state.has_won = false;
        game_state.running = true;
    }

    function handleNext() {
        if (game_state.has_won) {
            const index = game_state.level_index + 1;
            localStorage.setItem('last_level', index);
            let highest = parseInt(localStorage.getItem('highest_level')) || 0;
            if (highest < index) {
                highest = index;
                localStorage.setItem('highest_level', `${highest}`);
            }
            
            // Update select options
            const select = document.getElementById("level-select");
            const options = select.options;
            if (options.length - 1 < highest) {

                let option = document.createElement("option");
                let val = `${index+1}`;
                option.value = val;
                option.text = val;
                select.add(option);
            }

            reset(index);
        }
    }

    function onMouseDown(e) {
        e.preventDefault();
        const {offsetX, offsetY, button} = e;
        let {row, col} = getTileCoordFromScreenCoord(offsetX, offsetY);
       
        if (row < world.dimensions.h && col < world.dimensions.w) {
            const apply = !world.move_set.length && !game_state.has_won;
            
            if (apply) {
                let tile = world.getTile(row, col);
                let dir = button === MouseButtons.LEFT ? MoveDirections.LEFT : MoveDirections.RIGHT;

                if (ENABLE_UNIFIED_CLICK) {

                    let other_tile = world.findClosestMovable(row, col, offsetX);
                    if (other_tile) {
                        tile = other_tile;
                    }

                   
                    let {x, tile_size} = getScreenCoordFromTileCoord(tile.world_pos.row, tile.world_pos.col);
                   
                    let mouse_x = offsetX;
                    const half_size = tile_size/2;
                    let center_x = lerp(x-half_size, x + tile_size + half_size, 0.5);
                    dir = mouse_x < center_x ?  MoveDirections.RIGHT : MoveDirections.LEFT;
                }

                if (tile.gameplay_flags & GameplayFlags.MOVABLE) {
                    const c = new MoveCommand({row: tile.world_pos.row, col: tile.world_pos.col}, dir);
                    command_buffer.add(c);
                }
            }
            
        }
    }

    function onMouseMove(e) {
        const {offsetX, offsetY} = e;
        game_state.mouse.screen_coord.x = offsetX;
        game_state.mouse.screen_coord.y = offsetY;

        const {row, col} = getTileCoordFromScreenCoord(offsetX, offsetY);
        game_state.mouse.over_tile.row = row;
        game_state.mouse.over_tile.col = col;
    }

    function getTouchCoord(canvas, e) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.changedTouches[0];
        
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

        if (false && game_state.mouse.dragging) {
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
            e.preventDefault();
            handleUndo();
        };
    }
    
    {
        const button = document.getElementById("reset_button");
        button.onclick = e => {
            e.preventDefault();
            handleReset();
        };
    }
    {
        const button = document.getElementById("next_button");
        button.onclick = e => {
            e.preventDefault();
            handleNext();
        };
    }
   

    // Check level selection
    const select = document.getElementById("level-select");
    let highest = parseInt(localStorage.getItem('highest_level')) || 0;
    
    for (let i = 0; i < highest + 1; i++) {
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

    let tile_id = 100;

    for (let line of level) {

        for (let index = 0; index < line.length; index++) {
            let c = line[index];
            if (c === 's') {
                c += line[++index];
            }
            
            const tile = getTileFromChar(c);
            if (tile.id < 0 && (tile.gameplay_flags & GameplayFlags.MOVABLE) ) {
                tile.id = tile_id++;
            }
            world.putInGrid(row, col, tile);
            col++;
        }

       
        col = 0;
        row++;
    }

    world.addListener(event_listener);
    world.findAndApplyMerges(true);

    resizeCanvas(canvas);
}

function timestamp() {
    return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
}

let time_step = 1/120;
let time_step_f = 1.0;
let delta_time = 0;
let last_time = timestamp();
function mainLoop() {
    const now = timestamp();
    const slow_time_step = time_step * time_step_f;
    const frame_delta = (now - last_time) / 1000.0;
    delta_time += Math.min(1, frame_delta);
    last_time = now;
    {
        while (delta_time > slow_time_step) {
            delta_time -= slow_time_step;
            update(world, command_buffer, time_step);
        }
        render(world);
        requestAnimationFrame(mainLoop);
    }
}

function clearBG(color) {
    drawFullScreen(color);
}

export function drawTileText(row, col, text, color = "white") {
    const {x, y, tile_size} = getScreenCoordFromTileCoord(row, col);

    ctx.fillStyle = color;
    ctx.font = "32px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, x+tile_size/2, y+tile_size/2);
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


export function drawFullScreen(color) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = color;
    ctx.fillRect(0,0, w, h);
}

function drawArrowLeft(x, center_y, height, color = "black") {

    let start_x = x;
    ctx.beginPath();
    ctx.moveTo(start_x, center_y);
    ctx.lineTo(x+height, center_y - height);
    ctx.lineTo(x+height, center_y + height);
    ctx.fillStyle = color;
    ctx.fill();

}


function drawArrowRight(x, center_y, height, color = "black") {

    let start_x = x;
    ctx.beginPath();
    ctx.moveTo(start_x, center_y);
    ctx.lineTo(x-height, center_y - height);
    ctx.lineTo(x-height, center_y + height);
    ctx.fillStyle = color;
    ctx.fill();

}


export function drawMoveArrow(row, col, mouse_x, sides) {
    if (!ENABLE_UNIFIED_CLICK) return;


    ctx.globalAlpha = 0.6;
    let {x, y, tile_size} = getScreenCoordFromTileCoord(row, col);

    let center_x = lerp(x, x + tile_size, 0.5);
    let center_y = lerp(y, y + tile_size, 0.5);

    const left = mouse_x < center_x;
    let start_x = left ? x : center_x;
    
    let color = "white";
    ctx.fillStyle = color;
    
    let r_x = start_x
    let r_y = y;
    let r_w = tile_size / 2.2;
    let r_h = tile_size;
   // ctx.fillRect(r_x, r_y, r_w, r_h);

    let h = tile_size / 2;
    if (left) {
        if (sides.arrow_right)
            drawArrowRight(center_x, center_y, h, color);
    }
    else {
        if (sides.arrow_left)
            drawArrowLeft(center_x, center_y, h, color);
    }

    ctx.globalAlpha = 1.0;

}



function drawSubOuterTopLeft(center_x, center_y, thickness, size, alpha = 0.3) {

    const dim = size / 2;
    let [x, y] = [center_x - dim, center_y - dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // top left
    ctx.moveTo(x, y);

    // straight down
    y += dim;
    ctx.lineTo(x, y);

    // straight right
    x += thickness;
    ctx.lineTo(x, y);

    // straight up
    y -= dim - thickness;
    ctx.lineTo(x, y);
    
    // straight right
    x = center_x;
    ctx.lineTo(x, y);

    // straight up
    y = center_y - dim;
    ctx.lineTo(x, y);

    // home
    x = center_x - dim;
    y = center_y - dim;
    ctx.lineTo(x, y);

    
    ctx.fill();
    ctx.globalAlpha = 1.0;

}

function drawSubOuterTopRight(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x + dim, center_y - dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // top right
    ctx.moveTo(x, y);

    // straight down
    y += dim;
    ctx.lineTo(x, y);

    // straight left
    x -= thickness;
    ctx.lineTo(x, y);

    // straight up
    y -= dim - thickness;
    ctx.lineTo(x, y);
    
    // straight right
    x = center_x;
    ctx.lineTo(x, y);

    // straight up
    y = center_y - dim;
    ctx.lineTo(x, y);

    // home
    x = center_x - dim;
    y = center_y - dim;
    ctx.lineTo(x, y);

    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawSubOuterBottomLeft(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x - dim, center_y + dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // bottom left
    ctx.moveTo(x, y);

    // straight up
    y -= dim;
    ctx.lineTo(x, y);

    // straight right
    x += thickness;
    ctx.lineTo(x, y);

    // straight down
    y += dim - thickness;
    ctx.lineTo(x, y);
    
    // straight right
    x = center_x;
    ctx.lineTo(x, y);

    // straight down
    y = center_y + dim;
    ctx.lineTo(x, y);

    // home
    x = center_x - dim;
    y = center_y + dim;
    ctx.lineTo(x, y);

    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawSubOuterBottomRight(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x + dim, center_y + dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // bottom right
    ctx.moveTo(x, y);

    // straight up
    y -= dim;
    ctx.lineTo(x, y);

    // straight left
    x -= thickness;
    ctx.lineTo(x, y);

    // straight down
    y += dim - thickness;
    ctx.lineTo(x, y);
    
    // straight left
    x = center_x;
    ctx.lineTo(x, y);

    // straight down
    y = center_y + dim;
    ctx.lineTo(x, y);

    // home
    x = center_x + dim;
    y = center_y + dim;
    ctx.lineTo(x, y);

    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawSubInnerTopLeft(center_x, center_y, thickness, size, alpha) {
    
    const dim = size / 2;
    let [x, y] = [center_x - dim, center_y - dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // top left
    ctx.moveTo(x, y);

    // straight down
    y += thickness;
    ctx.lineTo(x, y);

    // straight right
    x += thickness;
    ctx.lineTo(x, y);

    // straight up
    y -= thickness;
    ctx.lineTo(x, y);
    

    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawSubInnerTopRight(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x + dim, center_y - dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // top right
    ctx.moveTo(x, y);

    // straight down
    y += thickness;
    ctx.lineTo(x, y);

    // straight left
    x -= thickness;
    ctx.lineTo(x, y);

    // straight up
    y -= thickness;
    ctx.lineTo(x, y);
    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawSubInnerBottomLeft(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x - dim, center_y + dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // bottom left
    ctx.moveTo(x, y);

    // straight up
    y -= thickness;
    ctx.lineTo(x, y);

    // straight right
    x += thickness;
    ctx.lineTo(x, y);

    // straight down
    y += thickness;
    ctx.lineTo(x, y);
    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawSubInnerBottomRight(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x + dim, center_y + dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // bottom right
    ctx.moveTo(x, y);

    // straight up
    y -= thickness;
    ctx.lineTo(x, y);

    // straight left
    x -= thickness;
    ctx.lineTo(x, y);

    // straight down
    y += thickness;
    ctx.lineTo(x, y);
    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawSubEdgeLeft(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x - dim, center_y - dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // top left
    ctx.moveTo(x, y);

    // straight down
    y += dim;
    ctx.lineTo(x, y);

    // straight right
    x += thickness;
    ctx.lineTo(x, y);

    // straight up
    y = center_y - dim;
    ctx.lineTo(x, y);
    
   

    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}


function drawSubEdgeRight(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x + dim, center_y - dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // top right
    ctx.moveTo(x, y);

    // straight down
    y += dim;
    ctx.lineTo(x, y);

    // straight left
    x -= thickness;
    ctx.lineTo(x, y);

    // straight up
    y = center_y - dim;
    ctx.lineTo(x, y);
    
    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawSubEdgeTop(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x - dim, center_y - dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // top left
    ctx.moveTo(x, y);

    // straight right
    x += dim;
    ctx.lineTo(x, y);

    // straight down
    y += thickness;
    ctx.lineTo(x, y);

    // straight left
    x = center_x - dim;
    ctx.lineTo(x, y);
    
    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}


function drawSubEdgeBottom(center_x, center_y, thickness, size, alpha) {
    const dim = size / 2;
    let [x, y] = [center_x - dim, center_y + dim];
    
    ctx.fillStyle = "white"
    ctx.globalAlpha = alpha;
    ctx.beginPath();
   

    // bottom left
    ctx.moveTo(x, y);

    // straight right
    x += dim;
    ctx.lineTo(x, y);

    // straight up
    y -= thickness;
    ctx.lineTo(x, y);

    // straight left
    x = center_x - dim;
    ctx.lineTo(x, y);
    
    
    ctx.fill();
    ctx.globalAlpha = 1.0;
}


export function drawBlockNonUnitScale(x, y, color, neighbours) {
    const size = canvas.width / world.dimensions.w;
   

    const center_x = lerp(x, x + size, 0.5);
    const center_y = lerp(y, y + size, 0.5);

    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);

    // draw all quadrants
    const thickness = Math.floor(size / 8);
    const alpha = 0.3;
    // Top left
    {
        if (neighbours & Neighbours.TOP_LEFT && !(neighbours & Neighbours.TOP || neighbours & Neighbours.LEFT) ) {
            drawSubInnerTopLeft( center_x, center_y, thickness, size, alpha);
        } 
        else if (neighbours & Neighbours.TOP && neighbours & Neighbours.LEFT) {
            drawSubOuterTopLeft(center_x, center_y, thickness, size, alpha);
        }

        else if (neighbours & Neighbours.LEFT) {
            drawSubEdgeLeft(center_x, center_y, thickness, size, alpha);
        }
        else if (neighbours & Neighbours.TOP) {
            drawSubEdgeTop(center_x, center_y, thickness, size, alpha);
        }
       
    }

    // Top right 
    {
        if (neighbours & Neighbours.TOP_RIGHT && !(neighbours & Neighbours.TOP || neighbours & Neighbours.RIGHT) ) {
            drawSubInnerTopRight(center_x, center_y, thickness, size, alpha);
        }

        else if (neighbours & Neighbours.TOP && neighbours & Neighbours.RIGHT) {
            drawSubOuterTopRight(center_x, center_y, thickness, size, alpha);
        }
        else if (neighbours & Neighbours.RIGHT) {
            drawSubEdgeRight(center_x, center_y, thickness, size, alpha);
        }
        else if (neighbours & Neighbours.TOP) {
            drawSubEdgeTop(x + size, center_y, thickness, size, alpha);
        }
    }

    // Bottom left
    {
        if (neighbours & Neighbours.BOTTOM_LEFT && !(neighbours & Neighbours.BOTTOM || neighbours & Neighbours.LEFT) ) {
            drawSubInnerBottomLeft(center_x, center_y, thickness, size, alpha)
        }

        else if (neighbours & Neighbours.BOTTOM && neighbours & Neighbours.LEFT) {
            drawSubOuterBottomLeft(center_x, center_y, thickness, size, alpha);
        }
        else if (neighbours & Neighbours.LEFT) {
            drawSubEdgeLeft(center_x, y + size, thickness, size, alpha);
        }
        else if (neighbours & Neighbours.BOTTOM) {
            drawSubEdgeBottom(center_x, center_y, thickness, size, alpha);
        }
        
    }

    // Bottom right
    {
        
        if (neighbours & Neighbours.BOTTOM_RIGHT && !(neighbours & Neighbours.BOTTOM || neighbours & Neighbours.RIGHT) ) {
            drawSubInnerBottomRight(center_x, center_y, thickness, size, alpha)
        }
        else
        if (neighbours & Neighbours.BOTTOM && neighbours & Neighbours.RIGHT) {
            drawSubOuterBottomRight(center_x, center_y, thickness, size, alpha);
        }
        else if (neighbours & Neighbours.RIGHT) {
            drawSubEdgeRight(center_x, y + size, thickness, size, alpha);
        }
        else if (neighbours & Neighbours.BOTTOM) {
            drawSubEdgeBottom(x + size, center_y, thickness, size, alpha);
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
    const cell_size = canvas.width / world.dimensions.w;
    const text = "You won!";
    
    const font_size = `${cell_size * 0.75}px`
    ctx.font = font_size+" sans-serif";
    ctx.fillStyle = "black";
    ctx.textAlign = "center"
    let {fontBoundingBoxAscent} = ctx.measureText(text);
    fontBoundingBoxAscent = fontBoundingBoxAscent ? fontBoundingBoxAscent : 48;

    ctx.fillText(text, canvas.width/2, canvas.height/2 - (fontBoundingBoxAscent/2));
    

    const font_size_sm = `${cell_size * 0.4}px`;
    ctx.font = font_size_sm+" sans-serif";
    ctx.textAlign = "center"
    ctx.fillText("Press 'next' to go to next level.", canvas.width/2, canvas.height/2 + (fontBoundingBoxAscent));
}

function update(world, command_buffer, dt) {
    world.update(command_buffer, dt, game_state, recorder);
    fallen_trigger.update(dt);
}

function render(world) {
    clearBG("darkgray");
    
    world.render(game_state);
    
    if (game_state.has_won) {
        drawWinText();
        canvas.classList.add("add_victory_animation");
        document.body.classList.add("animated-bgcolors");
        const button = document.getElementById("next_button");
        button.style.visibility = "visible";
        if (game_state.running) {
            game_state.running = false;
            audio_player.trigger(victory_flute_sound);
        }
    }
    
    if (DEBUG_RENDER) {
        world.debugRender();
        world.debugRenderPieces(world.debug_pieces);
    }
}


