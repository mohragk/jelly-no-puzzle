
import * as mat4 from './vendor/glmatrix/esm/mat4.js';

import { VS_MVP_SOURCE } from './rendering/vertex_shaders.js'
import { 
    FS_WHITE_SOURCE, 
    FS_COLOR_SOURCE, 
    FS_TEXTURED_SOURCE 
} from './rendering/fragment_shaders.js';


function loadTexture(gl, url) { 
    const isPowerOf2 = (n) => (n & (n - 1)) === 0;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // We initially load a single pixel until the resource has been processed.
    {
        const pixel = new Uint8Array( [0,0,255, 255] ) // blue
        gl.texImage2D( 
            gl.TEXTURE_2D,  
            0,                  // level
            gl.RGBA,            // internal format
            1,                  // width
            1,                  // height
            0,                  // border
            gl.RGBA,            // source format
            gl.UNSIGNED_BYTE,   // source type (?)
            pixel
        );
    }

    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D( 
            gl.TEXTURE_2D,  
            0,                  // level
            gl.RGBA,            // internal format
            gl.RGBA,            // source format
            gl.UNSIGNED_BYTE,   // source type (?)
            image
        );

        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    };
    image.src = url;
    
    

    return texture;
}


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
    rounded_color_shader;
    texture_shader;

    texture_mask_tl;
    texture_mask_tr;
    texture_mask_bl;
    texture_mask_br;

    render_list = [];

    camera_projection;

    constructor() {
        this.reset();
        const gl = this.#context;
        this.quad = createGlQuad(gl);

        this.default_white_shader = createGLShader(gl, VS_MVP_SOURCE, FS_WHITE_SOURCE);
        this.default_white_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.default_white_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
        this.default_white_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');

        this.single_color_shader  = createGLShader(gl, VS_MVP_SOURCE, FS_COLOR_SOURCE);
        this.single_color_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.single_color_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
        this.single_color_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
        this.single_color_shader.addUniform(gl, 'color', 'uColor');

        /*
        this.rounded_color_shader  = createGLShader(gl, VS_MVP_SOURCE, FS_ROUNDED_SOURCE);
        this.rounded_color_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.rounded_color_shader.addUniform(gl, 'view_matrix', 'uViewMatrix');
        this.rounded_color_shader.addUniform(gl, 'model_matrix', 'uModelMatrix');
        this.rounded_color_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
        this.rounded_color_shader.addUniform(gl, 'color', 'uColor');
        this.rounded_color_shader.addUniform(gl, 'corner_weights', 'uCornerWeights');
        */

        this.texture_shader  = createGLShader(gl, VS_MVP_SOURCE, FS_TEXTURED_SOURCE);
        this.texture_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.texture_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
        this.texture_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
        this.texture_shader.addUniform(gl, 'mask_texture', 'uMaskTexture');
        this.texture_shader.addUniform(gl, 'use_mask', 'uUseMask');
        this.texture_shader.addUniform(gl, 'color', 'uColor');

        this.texture_mask_tl = loadTexture(gl, '/assets/textures/rounded_tile_mask_tl_bw.png');
        this.texture_mask_tr = loadTexture(gl, '/assets/textures/rounded_tile_mask_tr_bw.png');
        this.texture_mask_br = loadTexture(gl, '/assets/textures/rounded_tile_mask_br_bw.png');
        this.texture_mask_bl = loadTexture(gl, '/assets/textures/rounded_tile_mask_bl_bw.png');

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
        this.#context = this.canvas.getContext("webgl", {premultipliedAlpha: false});

        if (!this.#context) {
            console.error("WebGL not initialized! Your browser may not support it :(")
            return;
        }
    }

   
    getRenderableQuad(color, position) {
        const renderable = {
            position,
            color,
            mesh: this.quad,
        }

        return renderable;
    }

    pushColorQuad(color, position) {
        const renderable = this.getRenderableQuad(color, position);
        renderable.shader = this.single_color_shader;
        renderable.type = "STANDARD";

        this.render_list.push(renderable);
    }

    
    pushRoundedColorTile(color, position, weights) {
        const shader = this.texture_shader;
        // TOP LEFT
        {
            const sub_position = [ position[0]-0.25, position[1]-0.25, position[2] ];
            const renderable = this.getRenderableQuad(color, sub_position);
            renderable.shader = shader;
            renderable.texture = this.texture_mask_tl;
            renderable.use_mask = weights[3] == 1;
            renderable.scale = 0.5;
            renderable.type = "ROUNDED";
            this.render_list.push(renderable);
        }
        // TOP RIGHT
        {
            const sub_position = [ position[0]+0.25, position[1]-0.25, position[2] ];
            const renderable = this.getRenderableQuad(color, sub_position);
            renderable.shader = shader;
            renderable.texture = this.texture_mask_tr;
            renderable.scale = 0.5;
            renderable.use_mask = weights[0] == 1;
            renderable.type = "ROUNDED";
            this.render_list.push(renderable);
        }
        // BOTTOM RIGHT
        {
            const sub_position = [ position[0]+0.25, position[1]+0.25, position[2] ];
            const renderable = this.getRenderableQuad(color, sub_position);
            renderable.shader = shader;
            renderable.texture = this.texture_mask_br;
            renderable.scale = 0.5;
            renderable.use_mask = weights[1] == 1;
            renderable.type = "ROUNDED";
            this.render_list.push(renderable);
        }
        // BOTTOM LEFT
        {
            const sub_position = [ position[0]-0.25, position[1]+0.25, position[2] ];
            const renderable = this.getRenderableQuad(color, sub_position);
            renderable.shader = shader;
            renderable.texture = this.texture_mask_bl;
            renderable.scale = 0.5;
            renderable.use_mask = weights[2] == 1;
            renderable.type = "ROUNDED";

            this.render_list.push(renderable);
        }
    }


    drawColoredQuad(renderable) {
        const gl = this.#context;

        // @TODO: should this be hard coded?
        const info = this.single_color_shader;

        gl.useProgram(info.program);

        // VERTEX
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.position);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quad.position_indices);
        gl.vertexAttribPointer(
            0,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(
            0
        );

        const {position, color} = renderable;

        // FRAGMENT
        const projection_matrix = this.getCameraProjection();
        const modelview_matrix = mat4.create();
        mat4.translate(modelview_matrix, modelview_matrix, position);
        gl.uniformMatrix4fv(
            info.uniforms.projection_matrix.location,
            false,
            projection_matrix
        );
        gl.uniformMatrix4fv(
            info.uniforms.modelview_matrix.location,
            false,
            modelview_matrix
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


    drawRoundedTile(renderable) {


        const gl = this.#context;

        const info = renderable.shader;
        gl.useProgram(info.program);

        // VERTEX
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.position);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quad.position_indices);
        gl.vertexAttribPointer(
            0,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(
            0
        );

        //TEXTURE
        if (this.quad.texcoord) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.texcoord);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quad.texcoord_indices);
            gl.vertexAttribPointer(
                1,
                2,
                gl.FLOAT,
                false,
                0,
                0
            );
            gl.enableVertexAttribArray(
                1
            );

            // Tell WebGL we want to affect texture unit 0
            gl.activeTexture(gl.TEXTURE0);

            // Bind the texture to texture unit 0
            gl.bindTexture(gl.TEXTURE_2D, renderable.texture);

            // Tell the shader we bound the texture to texture unit 0
            gl.uniform1i(info.uniforms.mask_texture.location, 0);
        }
       



        // FRAGMENT
        const projection_matrix = this.getCameraProjection();
        const modelview_matrix = mat4.create();
        mat4.translate(modelview_matrix, modelview_matrix, renderable.position);
        if (renderable.scale) {
            mat4.scale(modelview_matrix, modelview_matrix, [renderable.scale, renderable.scale, 1.0]);
        }
        

        gl.uniformMatrix4fv(
            info.uniforms.projection_matrix.location,
            false,
            projection_matrix
        );
        gl.uniformMatrix4fv(
            info.uniforms.modelview_matrix.location,
            false,
            modelview_matrix
        );
        
        
        gl.uniform4fv(
            info.uniforms.color.location,
            renderable.color
        );

        gl.uniform1i(
            info.uniforms.use_mask.location,
            renderable.use_mask ? 1 : 0
        );
        // Draw call
        {
            gl.drawElements(gl.TRIANGLES, this.quad.position_indices_count, gl.UNSIGNED_SHORT, 0);
        }
    }

    getCameraProjection() {
        return this.camera_projection;
    }

    updateCameraProjection(world_dim_w, world_dim_h, os_factor) {
        const z_near = 0.1;
        const z_far = 100.0;
        const proj_matrix = mat4.create();

        const dim_w = world_dim_w * os_factor;
        const dim_h = world_dim_h // * os_factor;
        mat4.ortho(
            proj_matrix,
            -0.5,
            dim_w-0.5,
            (dim_h)-0.5,
            -0.5,
            z_near,
            z_far
        );
        
        this.camera_projection = proj_matrix;
    }

    drawAll(world) {
        const gl = this.#context;
        gl.clearColor(0.1, 0.1, 0.1, 0.0);  // Clear to color fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
        
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        while (this.render_list.length) {
            const renderable = this.render_list.pop();
            if (renderable.type == "ROUNDED") {
                this.drawRoundedTile(renderable);
            }
            else {
                this.drawColoredQuad(renderable);
            } 
        }
    }
}