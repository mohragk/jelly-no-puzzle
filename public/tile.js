
export const GameplayFlags = {
    STATIC:         (1 << 0),
    MOVABLE:        (1 << 1),
    MERGED:         (1 << 2),
    MERGEABLE:      (1 << 3),
};

export const AnchorPoints = {
    NONE:   0,
    W:   (1 << 0) ,
    E:   (1 << 1) ,
    N:   (1 << 2) ,
    S:   (1 << 3) ,
}

export class Tile {
    id = -1;
    visual_pos = [0, 0];
    world_pos  = {row: 0, col: 0};
    target_pos = {row: 0, col: 0};
    
    move_t = 0.0;
    should_move = false;

    gameplay_flags = 0;

    anchor_points = AnchorPoints.NONE;

    color = "";
}
