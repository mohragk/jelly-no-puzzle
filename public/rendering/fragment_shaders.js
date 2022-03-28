export const FS_WHITE_SOURCE = `
void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

export const FS_COLOR_SOURCE = `
precision highp float;
    uniform vec4 uColor;

    void main() {
        gl_FragColor = uColor;
    }
`;


export const FS_ROUNDED_SOURCE = `
    precision highp float;

    uniform vec4 uColor;
    uniform vec4 uCornerWeights;

    varying highp vec2 texCoord;

   
    float partriallyRoundedBoxSDF(vec2 p, vec2 b, vec4 r) {
        r.xy = p.x > 0.0 ? r.xy : r.wz;
        r.x  = p.y > 0.0 ? r.y : r.x;

        vec2 q = abs(p)-b+r.x;
        float distance = min(max(q.x, q.y), 0.0) + length( max(q, 0.0)) - r.x;

        return 0.0-distance;
    }

    float roundedBoxSDF(vec2 p, vec2 b, float r) {
        return length( max( abs(p)-b+r, 0.0 ) ) - r;
    }
    
    void main() {
        vec2 uv = texCoord * 2.0 - 1.0;
        const float max_radius = 0.3;
        vec4 radii = uCornerWeights * max_radius;
        float dist = partriallyRoundedBoxSDF(uv, vec2(1.0), radii);
       
        const float border_opacity = 0.6;
        const float border_thickness = 0.25;
        const float smoothing = 0.0085;
        float mask = smoothstep(0.0-smoothing, 0.0+smoothing, dist) * border_opacity;


        if (dist > border_thickness) {
            mask = 1.0;
        }
        
       
        gl_FragColor = vec4( uColor.rgb, mask);

        //gl_FragColor = vec4( vec3(dist) , 1.0);
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
