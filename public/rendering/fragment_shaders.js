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

export const FS_TEXTURED_SOURCE = `
    precision highp float;
    uniform vec4 uColor;
    
    uniform sampler2D uColorTexture;
    uniform bool uUseColorTexture;

    uniform sampler2D uEdgeMaskTexture;
   
    varying vec2 texCoord;
    
    void main() {
        float alpha = texture2D(uEdgeMaskTexture, texCoord).r;
        vec3 col = uUseColorTexture ? texture2D(uColorTexture, texCoord).rgb : uColor.rgb;
        gl_FragColor = vec4(col.rgb, alpha);
    }
`;

export const FS_CURSOR_SOURCE = `
    precision highp float;

    #define PI 3.14159265359
    #define TWO_PI 6.28318530718


    uniform vec4 uColor;
    uniform float uTime;

    varying vec2 texCoord;

    mat2 rotate2d(float _angle){
        return mat2(cos(_angle),-sin(_angle),
                    sin(_angle),cos(_angle));
    }

    float triangle (vec2 st, float rrr) {

        // Remap the space to -1. to 1.
        st = st * 2. - 1.;
      
        // Number of sides of your shape
        int N = 3;
      
        // Angle and radius from the current pixel
        float a = atan(st.x,st.y)+PI;
        float r = TWO_PI/float(N);
      
        // Shaping function that modulate the distance
        float dist = cos(floor(.5+a/r)*r-a)*length(st);
      
        return 1.0 - smoothstep(.4, .401, dist);
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

        st -= vec2(0.5)  ;
        st = rotate2d(uTime * PI) * st;
        st += vec2(0.5);

        float alpha = cross(st, 0.2);
        gl_FragColor = vec4(vec3(0.1), alpha);
    }
`;
