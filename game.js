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






let game_state = {
    mouse: {
        x: 0, y: 0,
        last_clicked_left:  [],
        last_clicked_right: [],
    },
    running: false,
    level_colors: new Set(),
    has_won: false
};

let DEBUG_RENDER_WALLS = false;
const DEFAULT_GAMESTATE = {...game_state};



function reset(level) {
    game_state = {...DEFAULT_GAMESTATE};
    game_state.level_colors = new Set();
    world = new World(1, 1);
    recorder = new Recorder();
   
    const level_index = level - 1;
    loadLevel(level_index, levels, world);
    //recorder.add([...world]);
    
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


const TileTypes = {
    EMPTY: 0,
    WALL: 1,

    RED_BLOCK: 10,
    BLUE_BLOCK: 11,
    GREEN_BLOCK: 12,

    BLACK_BLOCK: 20,
};


class World {

   

    getIndex(row, col) {
        return col + row * this.dimensions.w;
    }


    addWall(row, col) {
        const id = this.wall_id;
        const p = new Piece(id, TileTypes.WALL);
        this.pieces[id] = p;
        const index = this.getIndex(row, col);
        this.grid[index] = id;
    }

    addEmpty(row, col) {
        const id = this.empty_id;
        const p = new Piece(id, TileTypes.EMPTY);
        this.pieces[id] = p;
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
            this.pieces.push(p);
            const index = this.getIndex(row, col);
            this.grid[index] = id;
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

    render() {
        this.forEachTile( (row, col, index) => {
            const ID = this.grid[index];
            const p = this.pieces[ID];
            const type = p.tile_type;
            drawBlock(row, col, getColorForTileType(type));
        });
    }

    grid = [];
    dimensions = {
        w: 1,
        h: 1
    };
    pieces = [];
    // fixed
    wall_id = 1;
    empty_id = 0;
    block_id = 2;
};

let world = new World(1, 1);

class Piece {
    
    constructor(id, type) {
        this.id = id;
        this.tile_type = type;
    }
    
    addBlock(block) {
        this.blocks.push(block);
    }

    id;
    should_move = false;
    move_direction = 0;
    tile_type;
    blocks = [];
}


const forEachTile = (cb) => {
    
    for (let row = 0; row < world_dimensions.h; row++ ) {
        for (let col = 0; col < world_dimensions.w; col++) {
            const index = row * world_dimensions.w + col;
            cb(index, row, col);
        }
    }
};


function addBlock(world, row, col, type, game_state) {
    const index = row * world_dimensions.w + col;
    world[index] = type;
    if (type > TileTypes.WALL && type < TileTypes.BLACK_BLOCK) {
        game_state.level_colors.add(type);
    }
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
            //const prev = recorder.getPrevious();
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
            if (button === MouseButtons.LEFT)  {
                game_state.mouse.last_clicked_left = [row, col];
            }
            if (button === MouseButtons.RIGHT)  { 
                game_state.mouse.last_clicked_right = [row, col];
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


    // Pre-pass to get world dimensions...
    let row = 0;
    let col = 0;
    world.dimensions.h = level.length;
    world.dimensions.w = level[0].length;


    // Actually load level...
    row = 0;
    col = 0;

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

const MoveDirections = {
    LEFT: -1,
    RIGHT: 1,
};

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


