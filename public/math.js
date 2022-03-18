export function lerp(a, b, t) {
    return (t*b) + (1 - t)*a;
}

export function lerpToInt(a, b, t) {
    let result = lerp(a,b,t);
    return Math.floor(result);
}