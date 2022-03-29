import { Renderer } from './renderer.js';


import { levels }  from './levels2.js';


import { lerp } from './math.js';
import { GameplayFlags, Tile, AnchorPoints } from './tile.js';

import { World, Neighbours } from './world.js';
import { Recorder } from './recorder.js';
import { DelayedTrigger } from './delayedtrigger.js';
import { CommandBuffer, MoveCommand, MoveDirections } from './command.js';
import { Events } from './events.js';

import { AudioPlayer, SoundBank } from './audio.js';



const DEV_MODE = false;


let audio_player = new AudioPlayer();
let sound_bank = new SoundBank();


function shakeCanvas() {
    canvas.classList.add("add_shake")
    window.setTimeout(() => canvas.classList.remove("add_shake"), 250)
}



const halt_input_trigger = new DelayedTrigger(
    0.2, 
    () => game_state.halt_input = false,          // Arm Callback
    () => game_state.halt_input = true            // Finished Callback
);          
const fallen_trigger = new DelayedTrigger(0.1, () => {
    audio_player.trigger(sound_bank.get("thump01_sound"));

    canvas.classList.add("add_gravity_shake_mild")
    window.setTimeout(() => canvas.classList.remove("add_gravity_shake_mild"), 250)
});

const triggers = [
    halt_input_trigger,
    fallen_trigger
];

let canvas, ctx;
let renderer;
let game_state; 
let command_buffer;
let recorder;
let event_listener = {
    handleEvent: (e) => {

        if (e === Events.MOVE) {
            audio_player.trigger(sound_bank.get("move01_sound"));
            halt_input_trigger.armAndReset();
        }
        
        if (e === Events.IMPOSSIBLE) {
            shakeCanvas();
            audio_player.trigger(sound_bank.get("tap01_sound"));
        }
        
        if (e === Events.BEGIN_FALL) {
            fallen_trigger.armAndReset();
            halt_input_trigger.armAndReset();
        }

        if (e === Events.BEGIN_MERGE) {
            audio_player.trigger(sound_bank.get("glup01_sound"));
        }
    }
}






const DEFAULT_GAMESTATE = {
    running: false,
    has_won: false,
    halt_input: false,
    
    level_index : 0,
    level_colors: new Set(),
    selected_tiles: [],
    selected_move_dir: null,
    mouse: {
        dragging: false,
        start_drag: [0,0],
        end_drag:   [0,0],
        start_tile: {row: 0, col: 0},
        over_tile:  {row: 0, col: 0},
        screen_coord: {x: 0, y: 0},
    },
    default_move_speed: 7.0,
    move_speed: 7.0,
    fall_speed: 16.0,
    frame_count: 0,

    debug_time_enabled: false,
    
};

let debug_render_index = 0;
const DEBUG_RENDERS = [
    () => {},
    () => world.debugRender(),
    () => world.debugRenderTileIDs(),
    () => world.debugRenderPieces(world.debug_pieces),
]


let DISPLAY_RASTER = false;


let world = new World();


function removeClassesFromHTML() {
    canvas.classList.remove("add_victory_animation");
    document.body.classList.remove("animated-bgcolors");
}


function getCanvas(renderer) { 
    if (renderer) {
        return renderer.canvas
    } 

    return document.getElementById("grid_canvas");
}

function reset(level_index) {

   
    last_time = timestamp();

    renderer.render_list.length = 0;

    removeClassesFromHTML();

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
    
    world = new World();
    const level_index = game_state.level_index;
    loadLevel(level_index, levels, world);
    
    game_state.running = true;

    removeClassesFromHTML();
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



    // OPENGL
    if (1) {
        const cv = document.getElementById("opengl_canvas");
        canvas.style.width  = `${new_w}px`;
        canvas.style.height = `${new_h}px`;;
        renderer.canvas.width = new_w;
        renderer.canvas.height = new_h;
        const oversampling_factor = 1.0;
        renderer.updateCameraProjection(world.dimensions.w, world.dimensions.h, oversampling_factor);
    }

}

window.addEventListener("load", main);
window.addEventListener("orientationchange", () => { resizeCanvas(canvas) });
window.addEventListener("resize", () => { resizeCanvas(canvas) });

function main() {
    
    renderer = new Renderer();
    canvas = getCanvas(renderer);
    //ctx = 

    const input_canvas = document.getElementById("opengl_canvas")

    input_canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };


    input_canvas.addEventListener("touchstart", onTouchStart);
    input_canvas.addEventListener("touchend", onTouchEnd);
    
    input_canvas.addEventListener("mousedown", onMouseDown);
    input_canvas.addEventListener("mousemove", onMouseMove);
    
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
        
        if (e.key === 'i') {
            input_mode = input_mode === InputModes.DIRECT ? InputModes.CLASSIC : InputModes.DIRECT;
        }
        
        if (e.key === 'g') {
            DISPLAY_RASTER = !DISPLAY_RASTER;
        }



        if (DEV_MODE) {
            if (e.key === 'd') {
                debug_render_index = (debug_render_index + 1) % DEBUG_RENDERS.length;
                //DEBUG_RENDER = !DEBUG_RENDER;
            }
            // Time dilation
            if (e.key === '-') {
                time_step_f *= 2;
            }
            if (e.key === '=') {
                time_step_f /= 2;
            }
        }
    })

    function handleUndo() {
        canvas.classList.remove("add_victory_animation");
        document.body.classList.remove("animated-bgcolors");
        const prev = recorder.getPrevious();
        world.setState(prev);
        game_state.has_won = false;
        game_state.running = true;
        fallen_trigger.cancel();
    }

    function handleReset() {
        if (!game_state.halt_input) {
            recorder.add(world.grid);
        }
        resetWorld(levels);
        game_state.has_won = false;
        game_state.running = true;
        fallen_trigger.cancel();
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

        const sendCommand = (tile, dir) => {
            if (tile.gameplay_flags & GameplayFlags.MOVABLE) {
                const c = new MoveCommand({row: tile.world_pos.row, col: tile.world_pos.col}, dir);
                command_buffer.add(c);
            }
        };
       
        if (row < world.dimensions.h && col < world.dimensions.w) {
            const apply = !world.move_set.length && !game_state.has_won;
            
            if (apply) {
                if (input_mode === InputModes.DIRECT) {
                    if (button === MouseButtons.LEFT && !command_buffer.hasCommands()) {
                        let mouse_x = offsetX;
                        const {closest, selected} = world.selectTiles(row, col, mouse_x);
    
                        if (selected.length) {
                            selected.sort((a, b) => {
                                if (a.world_pos.col < b.world_pos.col) return -1;
                                if (a.world_pos.col > b.world_pos.col) return 1;
                                return 0;
                            })
                            const count = selected.length;
                            const first_pos = selected[0].world_pos;
                            const left = getScreenCoordFromTileCoord(first_pos.row, first_pos.col);
                            const right_x = left.x + ((count) * getTileSize());
                            const center_x = lerp(left.x, right_x, 0.5); 
    
                            const dir = mouse_x < center_x ?  MoveDirections.RIGHT : MoveDirections.LEFT;
    
                            sendCommand(closest, dir);
                        }
                    }
                }
                else if (input_mode === InputModes.CLASSIC) {
                    if (!command_buffer.hasCommands()) {
                        let tile = world.getTile(row, col);
                        let dir = button === MouseButtons.LEFT ? MoveDirections.LEFT : MoveDirections.RIGHT;
                        sendCommand(tile, dir)
                    }
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
        
        // DETECTED TOUCH INPUT, CHANGE MOVE_SPEED
        game_state.move_speed = game_state.default_move_speed * 1.5;

        const {offsetX, offsetY} = getTouchCoord(canvas, e);
        
        let {row, col} = getTileCoordFromScreenCoord(offsetX, offsetY);
        
        {
            const apply = !game_state.halt_input && !world.move_set.length && !game_state.has_won;
            
            if (apply) {
                const tile = world.findClosestMovable(row, col, offsetX);
                if (tile) {
                    game_state.mouse.start_drag = [offsetX, offsetY];
                    game_state.mouse.start_tile = {...tile.world_pos};
                    game_state.mouse.dragging = true;
                }
            }

        }
    }

    function onTouchEnd(e) {
        e.preventDefault();

        const {offsetX, offsetY} = getTouchCoord(canvas, e);

        {
            game_state.mouse.end_drag = [offsetX, offsetY];
            
            const apply = game_state.mouse.dragging && !game_state.halt_input && !game_state.has_won;
            game_state.mouse.dragging = false;
            
            if (apply) {
                // Determine direction
                const {row, col} = game_state.mouse.start_tile;
                const direction = (game_state.mouse.end_drag[0] - game_state.mouse.start_drag[0]) < 0 ? MoveDirections.LEFT : MoveDirections.RIGHT;
                
                const command = new MoveCommand({row, col}, direction);
                command_buffer.add(command);
            }
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


    
    sound_bank.add("thump01_sound");
    sound_bank.add("tap01_sound");
    sound_bank.add("victory_flute_sound");
    sound_bank.add("glup01_sound");
    sound_bank.add("move01_sound");
    

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
                t.color = 'black';
                t.id = 0;
            }
            break;

            case '1': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.color = 'black';
                t.id = 1;
            }
            break;

            case '2': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.color = 'black';
                t.id = 2;
            }
            break;

            case '3': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.color = 'black';
                t.id = 3;
            }
            break;
            
            case '4': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.color = 'black';
                t.id = 4;
            }
            break;

            case '5': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
                t.color = 'black';
                t.id = 4;
            }
            break;

            case '6': {
                t.gameplay_flags |= GameplayFlags.MOVABLE;
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


        }

        return t;
    };

    const level = levels[index];

    const h = level.length;
    const w = level[0].length;
    world.setDimensions(w, h);


    let row = 0;
    let col = 0;

    let colored_tile_id = 100;

    

    const getStaticTile = (color_symbol, id) => {
        const colors = {
            'r': "red",
            'g': "green",
            'b': "blue",
        }
        const t = new Tile();
        t.id = id;
        t.gameplay_flags |= GameplayFlags.STATIC;
        t.gameplay_flags |= GameplayFlags.MERGEABLE;
        t.color = colors[color_symbol];

        return t;
    }

    const getAnchoredTile = (anchor_positions, color_symbol, id) => {
        const colors = {
            'r': "red",
            'g': "green",
            'b': "blue",
        }
        const t = new Tile();
        t.id = id;
        t.gameplay_flags |= GameplayFlags.MERGEABLE | GameplayFlags.MOVABLE;
        t.anchor_points = anchor_positions;
        t.color = colors[color_symbol];

        return t;
    };

    for (let line of level) {

        for (let index = 0; index < line.length; index++) {
            let c = line[index];
            let tile = getTileFromChar(c);

            // NOTE: set new, incremented id for colored tiles           
            if (tile.id < 0 && (tile.gameplay_flags) ) {
                tile.id = colored_tile_id++;
            }


            if (c === 'a') {
                let anchor_positions = 0;

                // @ROBUSTNESS: you better have at least one position defined!
                while (1) {
                    let next = line[++index];
                    if (next != 'E' && next != 'S' && next != 'W' & next != 'N' ) {
                        --index;
                        break;
                    }
                    anchor_positions |= AnchorPoints[next];
                }
                
                const color_symbol = line[++index];
                tile = getAnchoredTile(anchor_positions, color_symbol, colored_tile_id++);
            }
            else if (c === 's') {
                const color_symbol = line[++index];
                tile = getStaticTile(color_symbol, colored_tile_id++); 
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

let time_step = 1/240;
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




export function getTileSize() {
    const tile_size = canvas.width / world.dimensions.w;
    
    return tile_size;
}

export function getScreenCoordFromTileCoord(row, col) {
    const tile_size = getTileSize()
    let y = Math.floor(row * tile_size);
    let x = Math.floor(col * tile_size);
    return {x, y, tile_size};
}



export function getTileCoordFromScreenCoord(x, y) {
    const tile_size = getTileSize();
    let row = Math.floor(y / tile_size);
    let col = Math.floor(x / tile_size);

    return {row, col};
}




function update(world, command_buffer, dt) {
    world.update(command_buffer, dt, game_state, recorder, renderer);
    for (let trigger of triggers) {
        trigger.update(dt);
    }
}






function render(world) {
    
    // OPENGL
    world.render(renderer, game_state);
    renderer.drawAll(timestamp()/1000.0);
    
    if (DISPLAY_RASTER) {
        //drawRaster(world, 0.4);
    }
    

    if (game_state.has_won) {
        //drawWinText();
        canvas.classList.add("add_victory_animation");
        document.body.classList.add("animated-bgcolors");
        const button = document.getElementById("next_button");
        button.style.visibility = "visible";
        if (game_state.running) {
            game_state.running = false;
            audio_player.trigger(sound_bank.get("victory_flute_sound"));
        }
    }
    
    if (DEV_MODE) {
        const render = DEBUG_RENDERS[debug_render_index];
        if (render) {
            render();
        }
       
    }
}


