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


export const FS_ROUNDED_SOURCE = `
    precision mediump float;

    uniform vec4 uColor;
    uniform vec4 uCornerWeights;

    varying highp vec2 texCoord;

    float partriallyRoundedBoxSDF(vec2 p, vec2 b, vec4 r) {
        r.xy = p.x > 0.0 ? r.xy : r.wz;
        r.x  = p.y > 0.0 ? r.y : r.x;

        vec2 q = abs(p)-b+r.x;
        return min(max(q.x, q.y), 0.0) + length( max(q, 0.0)) - r.x;
    }

    float roundedBoxSDF(vec2 p, vec2 b, float r) {
        return length( max( abs(p)-b+r, 0.0 ) ) - r;
    }
    
    void main() {
        vec2 uv = texCoord * 2.0 - 1.0;
        float max_radius = 0.25;
        vec4 radii = uCornerWeights * max_radius;
        float box = partriallyRoundedBoxSDF(uv, vec2(0.97), radii);
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