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
        r.x  = p.y > 0.0 ? r.x : r.y;

        vec2 q = abs(p)-b+r.x;
        float distance = min(max(q.x, q.y), 0.0) + length( max(q, 0.0) ) - r.x;

        return 0.0-distance;
    }

    float roundedBoxSDF(vec2 p, vec2 b, float r) {
        return length( max( abs(p)-b+r, 0.0 ) ) - r;
    }
    
    void main() {
        vec2 uv = texCoord * 2.0 - 1.0;
        const float max_radius = 0.5;
        vec4 radii = uCornerWeights * max_radius;
        float dist = partriallyRoundedBoxSDF(uv, vec2(1.0), radii);
       
        const float smoothing = 0.0085;
        float mask = smoothstep(0.0-smoothing, 0.0+smoothing, dist);

        
       
        gl_FragColor = vec4( uColor.rgb, mask);
    }
`;

export const FS_MASKED_SOURCE = `
    precision mediump float;
    uniform vec4 uColor;

    uniform sampler2D uMaskTexture;
   
    varying vec2 texCoord;
    
    void main() {
        float alpha = texture2D(uMaskTexture, texCoord).r;
        vec3 col = uColor.rgb;
        gl_FragColor = vec4(col, alpha);
    }
`;

export const FS_TILE_SOURCE = `
    precision mediump float;
    precision mediump sampler2D;

    uniform vec4 uColor;

    uniform sampler2D uMaskTextureTL;
    uniform sampler2D uMaskTextureTR;
    uniform sampler2D uMaskTextureBL;
    uniform sampler2D uMaskTextureBR;

    varying vec2 texCoord;

    float map(float value, float min1, float max1, float min2, float max2) {
        return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
    }

    void main() {
        vec2 uv = texCoord;

        float alpha = 0.0;

        // TOP LEFT
        if (uv.x <= 0.5 && uv.y <= 0.5) {
            float st_x = map(texCoord.x, 0.0, 0.5, 0.0, 1.0);
            float st_y = map(texCoord.y, 0.0, 0.5, 0.0, 1.0);

            vec2 st = vec2(st_x, st_y);
            alpha = texture2D(uMaskTextureTL, st).r;
        }
        // TOP RIGHT
        if (uv.x > 0.5 && uv.y <= 0.5) {
            float st_x = map(texCoord.x, 0.5, 1.0, 0.0, 1.0);
            float st_y = map(texCoord.y, 0.0, 0.5, 0.0, 1.0);

            vec2 st = vec2(st_x, st_y);
            alpha = texture2D(uMaskTextureTR, st).r;
        }

        // BOTTOM LEFT
        if (uv.x <= 0.5 && uv.y > 0.5) {
            float st_x = map(texCoord.x, 0.0, 0.5, 0.0, 1.0);
            float st_y = map(texCoord.y, 0.5, 1.0, 0.0, 1.0);

            vec2 st = vec2(st_x, st_y);
            alpha = texture2D(uMaskTextureBL, st).r;
        }

        // BOTTOM RIGHT
        if (uv.x > 0.5 && uv.y > 0.5) {
            float st_x = map(texCoord.x, 0.5, 1.0, 0.0, 1.0);
            float st_y = map(texCoord.y, 0.5, 1.0, 0.0, 1.0);

            vec2 st = vec2(st_x, st_y);
            alpha = texture2D(uMaskTextureBR, st).r;
        }

        vec3 col = uColor.rgb;
        gl_FragColor = vec4(col, alpha);
    }
`;


export const FS_CIRCLE_SOURCE = `
    precision mediump float;

    uniform vec4 uColor;
    uniform float uRadius;

    varying vec2 texCoord;

    float circle(in vec2 _st, in float _radius){
        vec2 dist = _st-vec2(0.5);
        return 1.-smoothstep(_radius-(_radius*0.1),
                            _radius+(_radius*0.1),
                            dot(dist,dist)*4.0);
    }

    void main() {
        vec2 st = texCoord;

        float alpha = circle(st, uRadius) * 0.8;
        gl_FragColor = vec4(uColor.rgb, alpha);
    }
`;


export const FS_MATTE_SOURCE = `
    precision mediump float;
    
    uniform sampler2D uColorTexture;
   
    varying vec2 texCoord;
    
    void main() {
        vec4 col = texture2D(uColorTexture, texCoord);
        gl_FragColor = col;
    }
`

export const FS_CURSOR_SOURCE = `
    precision mediump float;

    #define PI 3.14159265359


    uniform vec4 uColor;
    uniform float uTime;
    uniform bool uShowLeft;
    uniform bool uShowRight;

    varying vec2 texCoord;

    mat2 rotate2d(float _angle){
        return mat2(cos(_angle),-sin(_angle),
                    sin(_angle),cos(_angle));
    }


    float box(in vec2 _st, in vec2 _size){
        _size = vec2(0.5) - _size*0.5;
        vec2 uv = smoothstep(_size,
                            _size+vec2(0.001),
                            _st);
        uv *= smoothstep(_size,
                        _size+vec2(0.001),
                        vec2(1.0)-_st);
        return uv.x*uv.y;
    }


    float chevron (in vec2 _st, float _size) {
        float thickness =_size/4.;
        return box(_st + vec2(-_size/2.0, thickness/2.0), vec2(_size,thickness)) +
               box(_st - vec2(thickness/2.0, -_size/2.0), vec2(thickness,_size));
    }
    
    float chevronLeft(in vec2 _st, float _size) {
        _st -= vec2(0.5);
        _st.x += (_size/6.);
        _st = rotate2d(0.25 * PI) * _st;
        _st += vec2(0.5);
        
        return chevron(_st, _size);
    }
    
    float chevronRight(in vec2 _st, float _size) {
        _st -= vec2(0.5);
        _st.x -= (_size/6.);
        _st = rotate2d(1.25 * PI) * _st;
        _st += vec2(0.5);
       
       return chevron(_st, _size);
    }
    


  
    
    float cross(in vec2 _st, float _size){
        return  box(_st, vec2(_size,_size/4.)) +
                box(_st, vec2(_size/4.,_size));
    }

    float circle(in vec2 _st, in float _radius){
        vec2 dist = _st-vec2(0.5);
        return 1.-smoothstep(_radius-(_radius*0.1),
                             _radius+(_radius*0.1),
                             dot(dist,dist)*4.0);
    }

    void main() {
        vec2 st = texCoord;

        
        float size = (uShowLeft && uShowRight) ? 0.10 : 0.15;
        if (uShowLeft && uShowRight) {
            st -= vec2(0.5);
            st = rotate2d( uTime * PI ) * st;
            st += vec2(0.5);
        }
        float right = uShowRight    ? chevronRight(st, size) : 0.0;
        float left  = uShowLeft     ? chevronLeft(st, size) : 0.0;

        float alpha = left + right;

        float circle = circle(st, 0.16) * 0.4;

        vec3 col = vec3( (uShowLeft && uShowRight) ? 0.15 : 0.95 );
        
        gl_FragColor = vec4(col, alpha);
    }
`;



export const FS_GRID_SOURCE = `
    precision mediump float;

    uniform vec4 uColor;
    uniform vec2 uResolution;
    uniform vec2 uWorldDimensions;

    varying vec2 texCoord;

    float grid (vec2 st, float tile_width, float thickness) {
       
        vec2 size = vec2(thickness);

        vec2 a1 = mod(st - size, tile_width);
        vec2 a2 = mod(st + size, tile_width);
        vec2 a = a2 - a1;

        float g = min(a.x, a.y);

        return clamp(g, 0.0, 1.0);
    }


    void main() {
        float thickness = 1.5;
        float tile_size =  uResolution.x / uWorldDimensions.x;

        float a = clamp(grid(gl_FragCoord.xy, tile_size, 1.0), 0.65, 1.0);
        gl_FragColor = vec4(uColor.rgb, 1.0-a);
    }

`;