
import * as mat4 from './vendor/glmatrix/esm/mat4.js';

import { VS_MVP_SOURCE } from './rendering/vertex_shaders.js'
import { FS_WHITE_SOURCE, FS_COLOR_SOURCE } from './rendering/fragment_shaders.js';



function createGlQuad(gl) {
    
    const getBuffer = (data, gl_buffer_type) => {
        const BO = gl.createBuffer();
        gl.bindBuffer(gl_buffer_type, BO);
        gl.bufferData( gl_buffer_type, data, gl.STATIC_DRAW );
        gl.bindBuffer(gl_buffer_type, null);
        
        return BO;
    };
        
        let result = {};
    // VERTEX
    {
        const vertices = [
            -0.5,  0.5, 0.0,
            -0.5, -0.5, 0.0,
             0.5, -0.5, 0.0,
             0.5,  0.5, 0.0 
        ];
        const vertex_buffer = getBuffer(new Float32Array(vertices), gl.ARRAY_BUFFER)
        result.position = vertex_buffer;
            
        const indices = [3,2,1,3,1,0]; 
        const index_buffer = getBuffer(new Uint16Array(indices), gl.ELEMENT_ARRAY_BUFFER);
        result.position_indices = index_buffer;
        result.position_indices_count = indices.length;
    }

    
    // TEXCOORDS
    {
        const coords = [
            0.0, 1.0, 
            0.0, 0.0, 
            1.0, 0.0, 
            1.0, 1.0, 
        ];
         
        
        const texcoord_buffer = getBuffer(new Float32Array(coords), gl.ARRAY_BUFFER);
        result.texcoord = texcoord_buffer;
            
        
        const indices = [3,2,1,3,1,0]; 
        const texcoord_index_buffer = getBuffer(new Uint16Array(indices), gl.ELEMENT_ARRAY_BUFFER);
        result.texcoord_indices = texcoord_index_buffer;
        result.texcoord_indices_count = indices.length;
    }



    return result;
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
    return result; 
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
        const model_matrix = mat4.create();
        mat4.translate(model_matrix, model_matrix, position);
        const view_matrix = mat4.create();

        gl.uniformMatrix4fv(
            info.uniforms.projection_matrix.location,
            false,
            projection_matrix
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