

const InputModes = {
    DIRECT: 0,
    CLASSIC: 1,
};

let input_mode = InputModes.DIRECT;
let enable_grid = false;
let bart_mode = false;

// NOTE: we use a global for tracking the mouse position to minimize
// input lag. Maybe.
let global_mouse_pos = {x: 0, y: 0};