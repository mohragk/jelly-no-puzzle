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

export const FS_TEXTURED_SOURCE = `
    precision mediump float;
    uniform vec4 uColor;

    varying vec2 texCoord;
    uniforma sampler2D uTexture;

    void main() {
        gl_FragColor = texture2D(uTexture, texCoord);
    }
`;

export const FS_CIRCLE_SOURCE = `
    precision mediump float;
    
    uniform vec2 uResolution;
    uniform vec4 uColor;


   
    void main() {
        // Normalized coords [-1, 1]
        vec2 uv = gl_FragCoord.xy / uResolution.xy * 2.0 - 1.0;
        float aspect = uResolution.x / uResolution.y;
        uv.x *= aspect;

        float thickness = 0.4;
        float fade = 0.005;

        float distance = 1.0 - length(uv);
        vec3 color = vec3( smoothstep(0.0, fade, distance) );
        color *= vec3( smoothstep(thickness+fade, thickness, distance) );

        gl_FragColor = vec4(color, 1.0);
        gl_FragColor.rgb *= uColor.rgb;
    }
`;

export const FS_ROUNDED_SOURCE = `
    precision mediump float;
    uniform vec4 uColor;

    float roundedRectSDF(vec2 position, vec2 size, float radius) {
        vec2 q = abs(position) - size;
        return length(max(q+radius, 0.0)) - radius; 
    }

    void main() {
        vec2 position = vec2(100.0, 300.0);
        vec2 size   = vec2(72.0, 172.0);
        float border_radius = size.x / 4.;
        float SDF = roundedRectSDF(gl_FragCoord.xy - position, size, border_radius);
        float alpha = 1.0 - SDF;
        vec4 col = vec4(uColor.x, uColor.y, uColor.z, alpha);
        gl_FragColor = col;
    }
`;

