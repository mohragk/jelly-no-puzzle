import { degreeToRadians } from "./math.js";
import * as mat4 from './vendor/glmatrix/esm/mat4.js';

const VS_SOURCE = `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
`;

const FS_SOURCE = `
void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

const FS_COLOR_SOURCE = `
    precision mediump float;
    uniform vec4 uColor;

    void main() {
        gl_FragColor = uColor;
    }
`;


function createGlQuad(gl) {
    // Strore z for depth later
    const verticesss = [
        1.0,  1.0, 0.0,
       -1.0,  1,0, 0.0,
       -1.0, -1,0, 0.0,
       
        1.0,  1.0, 0.0,
       -1.0, -1.0, 0.0,
        1.0, -1.0, 0.0
    ];

    const vertices = [
        -0.5,0.5,0.0,
        -0.5,-0.5,0.0,
        0.5,-0.5,0.0,
        0.5,0.5,0.0 
    ];
     
    const indices = [3,2,1,3,1,0]; 
    
    const vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return {
       position: vertex_buffer,
       position_indices: index_buffer,
       position_indices_count : indices.length
    };
}


function createGLShader(gl, vs, fs) {
    const loadShader = (gl, type, src) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(`Unable to compile shaders: `, gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    };

    const vertex_shader = loadShader(gl, gl.VERTEX_SHADER, vs);
    const fragment_shader = loadShader(gl, gl.FRAGMENT_SHADER, fs);

    const shader_program = gl.createProgram();
    gl.attachShader(shader_program, vertex_shader);
    gl.attachShader(shader_program, fragment_shader);
    gl.linkProgram(shader_program);

    if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
        console.error("Unable to link shader program: ", gl.getProgramInfo(shader_program));
        return null;
    }

    const program_info = {
        program: shader_program,
        attribLocations: {
            vertex_position: gl.getAttribLocation(shader_program, 'aVertexPosition'),

        },
        uniformLocations: {
            projection_matrix: gl.getUniformLocation(shader_program, 'uProjectionMatrix'),
            modelview_matrix: gl.getUniformLocation(shader_program, 'uModelViewMatrix'),
            color: gl.getUniformLocation(shader_program, "uColor")
        }
    }
    return program_info;
}

export class RenderShape {
    quads;
    
    // Shader stuff    
    color;
    transform;
}


let RED = 0.1;

export class Renderer {
    canvas;
    #context;

    quad;
    default_white_shader;

    constructor() {
        this.canvas = document.querySelector('#opengl_canvas');
        if (!this.canvas) {
            console.error("No canvas found! Create a dom element with id: 'opengl_canvas' ");
            return;
        }
        this.#context = this.canvas.getContext("webgl");

        if (!this.#context) {
            console.error("WebGL not initialized! Your browser may not support it :(")
            return;
        }

        this.quad = createGlQuad(this.#context);
        this.default_white_shader = createGLShader(this.#context, VS_SOURCE, FS_COLOR_SOURCE);
    }


    drawAll(dt) {
        const gl = this.#context;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
        
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const FOV = degreeToRadians(45);
        const aspect_ratio = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const z_near = 0.1;
        const z_far = 100.0;
        const proj_matrix = mat4.create();
        mat4.perspective(
            proj_matrix,
            FOV,
            aspect_ratio,
            z_near,
            z_far
        );

        const MVM = mat4.create();
        mat4.translate(
            MVM,
            MVM,
            [0.0, 0.0, -4.0]
        );


        // DRAW QUAD 
        {
            const num_components = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            
            const info = this.default_white_shader;
            gl.useProgram(info.program);


            gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.position);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quad.position_indices);
            gl.vertexAttribPointer(
                info.attribLocations.vertex_position,
                num_components,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                info.attribLocations.vertex_position
            );



            gl.uniformMatrix4fv(
                info.uniformLocations.projection_matrix,
                false,
                proj_matrix
            );
            gl.uniformMatrix4fv(
                info.uniformLocations.modelview_matrix,
                false,
                MVM
            );

            
            gl.uniform4fv(
                info.uniformLocations.color,
                [0.3, RED, 0.1, 1.0]
            );

            RED += dt;
            if (RED > 1.0) RED = 0;

            // Draw call
            {
                gl.drawElements(gl.TRIANGLES, this.quad.position_indices_count, gl.UNSIGNED_SHORT, 0);
            }
        }
    }
}