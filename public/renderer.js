
import * as mat4 from './vendor/glmatrix/esm/mat4.js';

import { 
    VS_MVP_SOURCE, 
    VS_MVP_TEXTURED_SOURCE 
} from './rendering/vertex_shaders.js'
import { 
    FS_WHITE_SOURCE, 
    FS_COLOR_SOURCE,
    FS_CIRCLE_SOURCE,
    FS_ROUNDED_SOURCE
} from './rendering/fragment_shaders.js';



function createGlQuad(gl) {
    const vertices = [
        -0.5,  0.5, 0.0,
        -0.5, -0.5, 0.0,
         0.5, -0.5, 0.0,
         0.5,  0.5, 0.0 
    ];
     
    const indices = [3,2,1,3,1,0]; 


    const texture_coords = [
        0.0,  0.0,
        0.0,  1.0,
        1.0,  0.0,
        1.0,  1.0, 
    ];
    const tex_coord_indices = [3,2,1,3,1,0]; 


    // VERTEX 
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
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gl.vertexAttribPointer    ( 0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray( 0 );


    // TEXCOORDS
    const tex_coord_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tex_coord_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture_coords), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const tex_coord_indices_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tex_coord_indices_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(tex_coord_indices), gl.STATIC_DRAW);
    
    gl.vertexAttribPointer    ( 1, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray( 1 );


   


    return {
       position: vertex_buffer,
       position_indices: index_buffer,
       position_indices_count : indices.length,

       texcoord: tex_coord_buffer,
       texcoord_indices: tex_coord_indices_buffer,
       texcoord_indices_count: tex_coord_indices.length
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


    //Set the attributes in the vertex shader to the same indices
    gl.bindAttribLocation(shader_program, 0, 'aVertexPosition');
    //gl.bindAttribLocation(shader_program, 1, 'aTexCoord');


    gl.linkProgram(shader_program);

    if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
        console.error("Unable to link shader program: ", gl.getProgramInfo(shader_program));
        return null;
    }

    const result = new ShaderProgram(shader_program);
    return result; //.addAttribute(gl, 'vertex_position', 'aVertexPosition');
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
    circle_shader;
    rounded_rect_shader;

    render_list = [];

    camera_projection;

    constructor() {
        this.reset();
        this.quad = createGlQuad(this.#context);

        const gl = this.#context;
        this.default_white_shader = createGLShader(gl, VS_MVP_SOURCE, FS_WHITE_SOURCE);
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


        /*
        this.rounded_rect_shader = createGLShader(gl, VS_MVP_SOURCE, FS_ROUNDED_SOURCE);
        this.rounded_rect_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.rounded_rect_shader.addUniform(gl, 'view_matrix', 'uViewMatrix');
        this.rounded_rect_shader.addUniform(gl, 'model_matrix', 'uModelMatrix');
        this.rounded_rect_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
        this.rounded_rect_shader.addUniform(gl, 'color', 'uColor');
        */

        this.circle_shader = createGLShader(gl, VS_MVP_TEXTURED_SOURCE, FS_CIRCLE_SOURCE);
        this.circle_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.circle_shader.addAttribute(gl, 'texture_coord', 'aTexCoord');
        this.circle_shader.addUniform(gl, 'view_matrix', 'uViewMatrix');
        this.circle_shader.addUniform(gl, 'model_matrix', 'uModelMatrix');
        this.circle_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
        this.circle_shader.addUniform(gl, 'resolution', 'uResolution');
        this.circle_shader.addUniform(gl, 'color', 'uColor');

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
        }

        this.render_list.push(renderable);
    }

    drawColorQuad(position, color) {
        const gl = this.#context;

        
        const info = this.circle_shader;
        gl.useProgram(info.program);
        
        


        // FRAGMENT
        {
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
    
            gl.uniform2fv(
                info.uniforms.resolution.location,
                [this.canvas.width, this.canvas.height]
            );
        }

        // Draw call
        {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.position);
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