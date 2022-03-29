
import * as mat4 from './vendor/glmatrix/esm/mat4.js';

import { VS_MVP_SOURCE } from './rendering/vertex_shaders.js'
import { 
    FS_WHITE_SOURCE, 
    FS_COLOR_SOURCE, 
    FS_CURSOR_SOURCE,
    FS_TEXTURED_SOURCE 
} from './rendering/fragment_shaders.js';

import {Neighbours} from './world.js'


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

function getRGBForNamedColor (name) {
    switch(name) {
        case "gray":    return [0.5,0.5,0.5];
        case "red":     return [1.0, 0.0, 0.0];
        case "green":   return [0.0, 0.5, 0.0];
        case "blue":    return [0.0, 0.0, 1.0];
    }
    return [0,0,0];
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


class FrameBuffer {
    width;
    height;

    texture;
    buffer;

    constructor (gl, width, height) {
        this.width = width;
        this.height = height;

        this.initializeTexture(gl);
        this.initializeBuffer(gl);
    }

    initializeTexture(gl) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        const width = this.width;
        const height = this.height;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        // Filtering
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.texture = texture;
    }

    initializeBuffer(gl) {
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

        // Attach the texture as the first color attachment
        const point = gl.COLOR_ATTACHMENT0;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, point, gl.TEXTURE_2D, this.texture, 0);

        this.buffer = fb;
    }
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
    frame_buffer;

    quad;

    default_white_shader;
    single_color_shader;
    rounded_color_shader;
    texture_shader;
    cursor_shader;

    
    texture_edge_mask_tl_full;
    texture_edge_mask_tl_inner;
    texture_edge_mask_tl_left;
    texture_edge_mask_tl_top;

    texture_edge_mask_tr_full;
    texture_edge_mask_tr_inner;
    texture_edge_mask_tr_right;
    texture_edge_mask_tr_top;

    texture_edge_mask_bl_full;
    texture_edge_mask_bl_inner;
    texture_edge_mask_bl_left;
    texture_edge_mask_bl_bottom;

    texture_edge_mask_br_full;
    texture_edge_mask_br_inner;
    texture_edge_mask_br_right;
    texture_edge_mask_br_bottom;

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


        this.texture_shader  = createGLShader(gl, VS_MVP_SOURCE, FS_TEXTURED_SOURCE);
        this.texture_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.texture_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
        this.texture_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
        this.texture_shader.addUniform(gl, 'edge_mask_texture', 'uEdgeMaskTexture');
        this.texture_shader.addUniform(gl, 'color', 'uColor');


        this.cursor_shader  = createGLShader(gl, VS_MVP_SOURCE, FS_CURSOR_SOURCE);
        this.cursor_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
        this.cursor_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
        this.cursor_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
        this.cursor_shader.addUniform(gl, 'color', 'uColor');
        this.cursor_shader.addUniform(gl, 'time', 'uTime');
      
        
        
        this.texture_edge_mask_tl_full      = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tl_outer.png');
        this.texture_edge_mask_tl_inner     = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tl_inner.png');
        this.texture_edge_mask_tl_left      = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tl_left.png');
        this.texture_edge_mask_tl_top       = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tr_top.png');
        
        this.texture_edge_mask_tr_full      = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tr_outer.png');
        this.texture_edge_mask_tr_inner     = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tr_inner.png');
        this.texture_edge_mask_tr_right     = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tr_right.png');
        this.texture_edge_mask_tr_top       = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tr_top.png');
        
        this.texture_edge_mask_bl_full      = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_bl_outer.png');
        this.texture_edge_mask_bl_inner     = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_bl_inner.png');
        this.texture_edge_mask_bl_left      = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tl_left.png');
        this.texture_edge_mask_bl_bottom    = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_bl_bottom.png');    
        
        this.texture_edge_mask_br_full      = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_br_outer.png');
        this.texture_edge_mask_br_inner     = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_br_inner.png');
        this.texture_edge_mask_br_right     = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_tr_right.png');
        this.texture_edge_mask_br_bottom    = loadTexture(gl, '/assets/textures/rounded_tile_mask_edge_bl_bottom.png');    

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

        const gl = this.#context;
        this.frame_buffer = new FrameBuffer(gl, this.canvas.width, this.canvas.height);
    }

   
    getRenderableQuad(color, position) {
        const renderable = {
            position: [...position],
            color,
            mesh: this.quad,
        }

        return renderable;
    }

    drawCursorQuad(named_color, position) {
        const color = [...getRGBForNamedColor(named_color), 1];
        const renderable = this.getRenderableQuad(color, position);
        renderable.shader = this.cursor_shader;
        renderable.type = "STANDARD";
        this.drawColoredQuad(renderable);
    }

    pushCursorQuad(named_color, position) {
        const color = [...getRGBForNamedColor(named_color), 1];
        const renderable = this.getRenderableQuad(color, position);
        renderable.shader = this.cursor_shader;
        renderable.type = "STANDARD";

        this.render_list.push(renderable);
    }

    pushColoredQuad(named_color, position) {
        const color = [...getRGBForNamedColor(named_color), 1];
        const renderable = this.getRenderableQuad(color, [...position, -1]);
        renderable.shader = this.single_color_shader;
        renderable.type = "STANDARD";

        this.render_list.push(renderable);
    }

    pushSubTile(color, tile_position, corner, neighbours) {
        const renderable = this.getRenderableQuad(color, this.getSubPosition(tile_position, corner));
        renderable.shader = this.texture_shader;
        renderable.scale = 0.5;
        renderable.mask_texture      = this.getMask(corner);
        renderable.edge_mask_texture = this.getEdgeMask(corner, neighbours);
        
        this.render_list.push(renderable);
    }

    pushRoundedColorTile(named_color, position, neighbours) {
        const color = [...getRGBForNamedColor(named_color), 1.0];
        this.pushSubTile(color, position, "TOP_LEFT",    neighbours);
        this.pushSubTile(color, position, "TOP_RIGHT",  neighbours);
        this.pushSubTile(color, position, "BOTTOM_LEFT", neighbours);
        this.pushSubTile(color, position, "BOTTOM_RIGHT", neighbours);
    }

    getSubPosition(position, corner) {
        const offset = 0.25;
        switch(corner) {
            case "TOP_LEFT":        return [ position[0] - offset, position[1] - offset, -1 ];
            case "TOP_RIGHT":       return [ position[0] + offset, position[1] - offset, -1 ];
            case "BOTTOM_LEFT":     return [ position[0] - offset, position[1] + offset, -1 ];
            case "BOTTOM_RIGHT":    return [ position[0] + offset, position[1] + offset, -1 ];
        }
    }

    getMask(corner) {
        switch(corner) {
            case "TOP_LEFT":        return this.texture_mask_tl;
            case "TOP_RIGHT":       return this.texture_mask_tr;
            case "BOTTOM_LEFT":     return this.texture_mask_bl;
            case "BOTTOM_RIGHT":    return this.texture_mask_br;
        }
    }

    getEdgeMask(corner, neighbours) {
        switch(corner) {
            case "TOP_LEFT": {
                if (neighbours & Neighbours.TOP_LEFT && !(neighbours & Neighbours.TOP || neighbours & Neighbours.LEFT)) {
                    return this.texture_edge_mask_tl_inner;
                }
                else if (neighbours & Neighbours.TOP && neighbours & Neighbours.LEFT) {
                    return this.texture_edge_mask_tl_full;
                }

                else if (neighbours & Neighbours.LEFT) {
                    return this.texture_edge_mask_tl_left;
                }
                else if (neighbours & Neighbours.TOP) {
                    // INCORRECT!
                    return this.texture_edge_mask_tl_top;
                }
            }
            break;

            case "TOP_RIGHT": {
                if (neighbours & Neighbours.TOP_RIGHT && !(neighbours & Neighbours.TOP || neighbours & Neighbours.RIGHT)) {
                    // INCORRECT!
                    return this.texture_edge_mask_tr_inner;
                }
                else if (neighbours & Neighbours.TOP && neighbours & Neighbours.RIGHT) {
                    return this.texture_edge_mask_tr_full;
                }

                else if (neighbours & Neighbours.RIGHT) {
                    return this.texture_edge_mask_tr_right;
                }
                else if (neighbours & Neighbours.TOP) {
                    return this.texture_edge_mask_tr_top;
                }

            }
            break;

            case "BOTTOM_LEFT": {
                if (neighbours & Neighbours.BOTTOM_LEFT && !(neighbours & Neighbours.BOTTOM || neighbours & Neighbours.LEFT)) {
                    // INCORRECT!
                    return this.texture_edge_mask_bl_inner;
                }
                else if (neighbours & Neighbours.BOTTOM && neighbours & Neighbours.LEFT) {
                    return this.texture_edge_mask_bl_full;
                }

                else if (neighbours & Neighbours.LEFT) {
                    return this.texture_edge_mask_bl_left;
                }
                else if (neighbours & Neighbours.BOTTOM) {
                    return this.texture_edge_mask_bl_bottom;
                }

            }
            break;

            case "BOTTOM_RIGHT": {
                if (neighbours & Neighbours.BOTTOM_RIGHT && !(neighbours & Neighbours.BOTTOM || neighbours & Neighbours.RIGHT)) {
                    // INCORRECT!
                    return this.texture_edge_mask_br_inner;
                }
                else if (neighbours & Neighbours.BOTTOM && neighbours & Neighbours.RIGHT) {
                    return this.texture_edge_mask_br_full;
                }

                else if (neighbours & Neighbours.RIGHT) {
                    return this.texture_edge_mask_br_right;
                }
                else if (neighbours & Neighbours.BOTTOM) {
                    return this.texture_edge_mask_br_bottom;
                }

            }
            break;
        }
    }

    
  

    drawColoredQuad(renderable, time) {
        const gl = this.#context;

        // @TODO: should this be hard coded?
        const info = renderable.shader;

        gl.useProgram(info.program);

        

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


        // OPTIONAL

        if (info.uniforms.time) {
            
            gl.uniform1f(
                info.uniforms.time.location,
                time || 1.0
            );  
        }
 
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
            gl.bindTexture(gl.TEXTURE_2D, renderable.edge_mask_texture);

            // Tell the shader we bound the texture to texture unit 0
            gl.uniform1i(info.uniforms.edge_mask_texture.location, 0);
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

    drawAll(time) {
        

        const gl = this.#context;
        
        // WORLD PASS
        {
           //gl.bindFramebuffer(gl.FRAMEBUFFER, this.frame_buffer.buffer);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);

            gl.clearColor(0.1, 0.1, 0.1, 0.0);  // Clear to color fully opaque
            gl.clearDepth(1.0);                 // Clear everything
            gl.enable(gl.DEPTH_TEST);           // Enable depth testing
            gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
            while (this.render_list.length) {
                const renderable = this.render_list.pop();
                if (renderable.type === "STANDARD") {
                    this.drawColoredQuad(renderable, time);
                }
                else {
                    this.drawRoundedTile(renderable);
                }
            }
        }

        // RENDER TO CANVAS
        {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        }
    }
}