import {levels}  from './levels2.js';

let canvas, ctx;

const world_dimensions = {
    w: 14,
    h: 8
};
let world  = [];

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


let DEBUG_RENDER_WALLS = false;

const MouseButtons = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
    BACK: 3,
    FORWARD: 4
};

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

const DEFAULT_GAMESTATE = {...game_state};

const TileTypes = {
    EMPTY: 0,
    WALL: 1,

    RED_BLOCK: 10,
    BLUE_BLOCK: 11,
    GREEN_BLOCK: 12,
    YELLOW_BLOCK: 13,

    BLACK_BLOCK: 20,
};


function reset(level) {
    game_state = {...DEFAULT_GAMESTATE};
    game_state.level_colors = new Set();
    world = [];
    recorder = new Recorder();
   
    const level_index = level - 1;
    loadLevel(level_index, levels, world);
    recorder.add([...world]);
    
    game_state.running = true;
    mainLoop();
}


function getColorForTileType (type) {
    switch (type) {
        case TileTypes.RED_BLOCK: return "red";
        case TileTypes.BLUE_BLOCK: return "blue";
        case TileTypes.GREEN_BLOCK: return "green";
        case TileTypes.YELLOW_BLOCK: return "yellow";
    }
}




class Piece {
    
    constructor(type) {
        this.tile_type = type;
    }
    
    addBlock(block) {
        this.blocks.push(block);
    }

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

window.addEventListener("load", main());

function addBlock(world, row, col, type, game_state) {
    const index = row * world_dimensions.w + col;
    world[index] = type;
    if (type > TileTypes.WALL && type < TileTypes.BLACK_BLOCK) {
        game_state.level_colors.add(type);
    }
}

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
        if (e.key === 'r') {
            const prev = recorder.getPrevious();
            world = [...prev];
        }

        if (e.key === 'd') { 
            DEBUG_RENDER_WALLS = !DEBUG_RENDER_WALLS;
        }
    })

    function onMouseDown(e) {
        e.preventDefault();

        const button = e.button;
    };

    function onMouseUp(e) {
        const {offsetX, offsetY} = e;
        const {row, col} = getTileCoordFromScreenCoord(offsetX, offsetY);
        
        if (row < world_dimensions.h && col < world_dimensions.w) {

            const button = e.button;
            if (button === MouseButtons.LEFT)  {
                game_state.mouse.last_clicked_left = [row, col];
            }
            if (button === MouseButtons.RIGHT)  { 
                game_state.mouse.last_clicked_right = [row, col];
            }
    
            recorder.add([...world]);
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
    let row = 0;
    let col = 0;
    let max_col = 0;
    for (let line of level) {
        for (let c of line) {
            const type = getTileTypeFromChar(c);
            addBlock(world, row, col, type, game_state);

            col++;
            max_col = col > max_col ? col : max_col;
        }
        col = 0;
        row++;
    }
    world_dimensions.h = row;
    world_dimensions.w = max_col;

    const cell_size = 72;
    canvas.width  = cell_size * world_dimensions.w;
    canvas.height = cell_size * world_dimensions.h;
    console.log(game_state.level_colors)
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
    const tile_size = canvas.width / world_dimensions.w;
    let y = row * tile_size;
    let x = col * tile_size;
    return {x, y, tile_size};
}

function getTileCoordFromScreenCoord(x, y) {
    const tile_size = canvas.width / world_dimensions.w;
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
    
    let move_pieces = [];
   

    if (game_state.mouse.last_clicked_left.length) {
        const [row, col] = game_state.mouse.last_clicked_left;
        game_state.mouse.last_clicked_left = [];
        const tile = getTile(row, col, world);
        if (tile !== TileTypes.WALL && tile !== TileTypes.EMPTY) {
            const p = createPiece(row, col, world, tile);
            p.should_move = true;
            p.move_direction = MoveDirections.LEFT;
            move_pieces.push(p);
        }
    }

    if (game_state.mouse.last_clicked_right.length) {
        const [row, col] = game_state.mouse.last_clicked_right;
        game_state.mouse.last_clicked_right = [];
        const tile = getTile(row, col, world);
        if (tile !== TileTypes.WALL && tile !== TileTypes.EMPTY) {
            const p = createPiece(row, col, world, tile);
            p.should_move = true;
            p.move_direction = MoveDirections.RIGHT;
            move_pieces.push(p);
        }
    }
    
    
    // Handle move
    if (move_pieces.length)
    {
        let can_move = true;
        outer: for (let piece of move_pieces) {
            for (let coord of piece.blocks) {
                let {row, col} = coord;
                col += piece.move_direction;
                const other = getTile(row, col, world);
                if (other === TileTypes.WALL) { 
                    can_move = false;
                    break outer;
                }
                if (other > TileTypes.WALL && other < TileTypes.BLACK_BLOCK ) {
                    const p = createPiece(row, col, world, other);
                    p.should_move = true;
                    p.move_direction = piece.move_direction;
                    move_pieces.push(p);
                }
            }
        }
        if (can_move) {
            for (let piece of move_pieces) {
                for (let coord of piece.blocks) {
                    coord.col += piece.move_direction;
                }
            }
        }

        repopulateGrid(move_pieces, world);
    }
    
    

    // Apply gravity
    {
        let walls = new Array(world.length).fill(0);
        const pieces = [];
       
       
        forEachTile( (index, row, col) => {
            const tile = getTile(row, col, world);
            if (tile > TileTypes.WALL && tile < TileTypes.BLACK_BLOCK) {
                const p = createPiece(row, col, world, tile, walls);
                pieces.push(p);
            }
        });

            
        for (let piece of pieces) {
            let can_move = true;

            // Remove itself from wall-set
            const tmp_walls = [...walls];
            for (let {row, col} of piece.blocks) {  
                const index = getIndexForGrid(row, col);
                tmp_walls[index] = TileTypes.EMPTY;
            }

            for (let coord of piece.blocks) {
                let {row, col} = coord;
                row += 1;
                const block_wall = getTile(row, col, tmp_walls);
                const other      = getTile(row, col, world);
                
                if (other === TileTypes.WALL || block_wall === TileTypes.WALL) { 
                    can_move = false;
                    break;
                }
                
            }
            if (can_move) {
                for (let coord of piece.blocks) {
                    coord.row += 1;
                }
            }
            // Check win-state
            const level_colors_count = game_state.level_colors.size;
            if (level_colors_count === pieces.length) {
                game_state.has_won = true;
                game_state.running = false;
                
            }
        }
    


        drawGrid(walls);

        repopulateGrid(pieces, world);
        
    }
        
    if (!DEBUG_RENDER_WALLS) {
        drawGrid(world);
    }
    

    
}


function repopulateGrid(pieces, grid) { 
    for (let piece of pieces) {
        const tile = piece.tile_type;
        for (let {row, col} of piece.blocks) {
            const index = getIndexForGrid(row, col);
            grid[index] = tile;
        }   
    }
}

function drawGrid(grid = []) {

    clearBG('purple')
    
    forEachTile( (index, row, col) => {
        const tile = grid[index];
        if (tile === TileTypes.WALL) {
            drawWall(row, col);
        }
        else if (tile === TileTypes.EMPTY) {
            drawEmpty(row, col);
        }
        else {
            const color = getColorForTileType(tile);
            drawBlock(row, col, color);
        }
    });
}