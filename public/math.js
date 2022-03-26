export function lerp(a, b, t) {
    return (t*b) + (1 - t)*a;
}

export function lerpToInt(a, b, t) {
    let result = lerp(a,b,t);
    return Math.floor(result);
}

export class Rectangle {
    top_left     = [0, 0];
    bottom_right = [0, 0];

    dimensions = [0, 0];

    constructor(tl, br) {
        this.top_left = tl;
        this.bottom_right = br;

        this.dimensions[0] = this.bottom_right[0] - this.top_left[0]  //x
        this.dimensions[1] = this.bottom_right[1] - this.top_left[1]  //x
    }
}


export const degreeToRadians = (degrees)  => (degrees * Math.PI) / 180.0;