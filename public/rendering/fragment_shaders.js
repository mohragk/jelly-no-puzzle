export const FS_WHITE_SOURCE = `
void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

export const FS_COLOR_SOURCE = `
    precision mediump float;
    uniform vec4 uColor;

    void main() {
        gl_FragColor = uColor;
    }
`;


export const FS_CIRCLE_SOURCE = `
    precision mediump float;

    uniform vec4 uColor;

    varying highp vec2 texCoord;

    float circle(in vec2 st, in float radius){
        vec2 dist = st-vec2(0.5);
        return 1.-smoothstep(
            radius-(radius*0.01),
            radius+(radius*0.01),
            dot(dist,dist)*4.0);
    }

    float roundedBoxSDF(vec3 p, vec3 b, float r) {
        return length( max( abs(p)-b+r, 0.0 ) ) - r;
    }
    
    void main() {
        vec2 uv = texCoord * 2.0 - 1.0;
        vec3 st = vec3(uv, 0.0);
        float box = roundedBoxSDF(st, vec3(0.97), .25);
        box = 1.0 - smoothstep(0.0, 0.03, box) ;
        gl_FragColor = vec4(uColor.rgb, box);
    }
`;

export const FS_TEXTURED_SOURCE = `
    precision mediump float;
    uniform vec4 uColor;

    uniform sampler2D uTexture;

    varying highp vec2 texCoord;
    
    void main() {
        vec4 col = texture2D(uTexture, texCoord);
        gl_FragColor = col;
    }
`;