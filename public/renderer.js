
import * as mat4 from './vendor/glmatrix/esm/mat4.js';

import { VS_MVP_SOURCE } from './rendering/vertex_shaders.js'
import { FS_WHITE_SOURCE, FS_COLOR_SOURCE } from './rendering/fragment_shaders.js';



function createGlQuad(gl) {
    const vertices = [
        -0.5,  0.5, 0.0,
        -0.5, -0.5, 0.0,
         0.5, -0.5, 0.0,
         0.5,  0.5, 0.0 
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

    const result = new ShaderProgram(shader_program);
    return result; //.addAttribute(gl, 'vertex_position', 'aVertexPosition');

    const program_info = {
        program: shader_program,
        attribLocations: {
            vertex_position: gl.getAttribLocation(shader_program, 'aVertexPosition'),

        },
        uniformLocations: {
            projection_matrix: gl.getUniformLocation(shader_program, 'uProjectionMatrix'),
            model_matrix: gl.getUniformLocation(shader_program, 'uModelMatrix'),
            view_matrix: gl.getUniformLocation(shader_program, 'uViewMatrix'),
            color: gl.getUniformLocation(shader_program, "uColor")
        }
    }
    return program_info;
}

class ShaderProgram {
    program;
    uniforms = {};
    attributes = {};

    constructor(program) {
        this.program = program;
    }

    addUniform(gl, key, name) {
        this.uniforms[key] = { location: gl.getUniformLocation(this.program, name), value: 0 };
    }

    addAttribute(gl, key, name) {
        this.attributes[key] = {location: gl.getAttribLocation(this.program, name), value: 0 };
    }
};

export class Renderer {
    canvas;
    #context;

    quad;
    default_white_shader;
    single_color_shader;

    render_list = [];

    camera_projection;

    constructor() {
        this.reset();
        this.quad = createGlQuad(this.#context);

        const gl = this.#context;
        this.default_white_shader = createGLShader(this.#context, VS_MVP_SOURCE, FS_WHITE_SOURCE);
        this.default_white_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.default_white_shader.addUniform(gl, 'view_matrix', 'uViewMatrix');
        this.default_white_shader.addUniform(gl, 'model_matrix', 'uModelMatrix');
        this.default_white_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');

        this.single_color_shader  = createGLShader(this.#context, VS_MVP_SOURCE, FS_COLOR_SOURCE);
        this.single_color_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.single_color_shader.addUniform(gl, 'view_matrix', 'uViewMatrix');
        this.single_color_shader.addUniform(gl, 'model_matrix', 'uModelMatrix');
        this.single_color_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
        this.single_color_shader.addUniform(gl, 'color', 'uColor');
    }

    getContext() {
        return this.#context;
    }

    reset() {
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
    }

   

    pushColorQuad(color, position) {
        const renderable = {
            position,
            color,
            mesh:   this.quad,
            shader: this.single_color_shader,
        }

        this.render_list.push(renderable);
    }

    drawColorQuad(position, color) {
        const gl = this.#context;

        const num_components = 3;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        
        const info = this.single_color_shader;
        gl.useProgram(info.program);

        // VERTEX
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.position);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quad.position_indices);
        gl.vertexAttribPointer(
            info.attributes.vertex_position,
            num_components,
            type,
            normalize,
            stride,
            offset
        );
        gl.enableVertexAttribArray(
            info.attributes.vertex_position.location
        );


        // FRAGMENT
        const projection_matrix = this.getCameraProjection();
        info.uniforms.projection_matrix.value = projection_matrix;
        const model_matrix = mat4.create();
        mat4.translate(model_matrix, model_matrix, position);
        const view_matrix = mat4.create();

        gl.uniformMatrix4fv(
            info.uniforms.projection_matrix.location,
            false,
            info.uniforms.projection_matrix.value
        );
        gl.uniformMatrix4fv(
            info.uniforms.model_matrix.location,
            false,
            model_matrix
        );
        gl.uniformMatrix4fv(
            info.uniforms.view_matrix.location,
            false,
            view_matrix
        );

        
        gl.uniform4fv(
            info.uniforms.color.location,
            color
        );

        // Draw call
        {
            gl.drawElements(gl.TRIANGLES, this.quad.position_indices_count, gl.UNSIGNED_SHORT, 0);
        }
    }

    getCameraProjection() {
        return this.camera_projection;
    }

    updateCameraProjection(world_dim_w, world_dim_h) {
        const z_near = 0.1;
        const z_far = 100.0;
        const proj_matrix = mat4.create();

        mat4.ortho(
            proj_matrix,
            -0.5,
            world_dim_w-0.5,
            -(world_dim_h-0.5),
            0.5,
            z_near,
            z_far
        );
        
        this.camera_projection = proj_matrix;
    }

    drawAll(world) {
        const gl = this.#context;
        gl.clearColor(0.7, 0.7, 0.7, 1.0);  // Clear to color fully opaque
        // gl.clearDepth(1.0);                 // Clear everything
        // gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        // gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
        
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        while (this.render_list.length) {
            const renderable = this.render_list.pop();
            this.drawColorQuad(renderable.position, renderable.color);
        }
    }
}