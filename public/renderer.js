
import * as mat4 from './vendor/glmatrix/esm/mat4.js';



import { VS_FULLSCREEN_SOURCE, VS_MVP_SOURCE } from './rendering/vertex_shaders.js'
import { 
    FS_WHITE_SOURCE, 
    FS_COLOR_SOURCE, 
    FS_CURSOR_SOURCE,
    FS_MASKED_SOURCE,
    FS_MATTE_SOURCE,
    FS_CIRCLE_SOURCE,
    FS_GRID_SOURCE,
    FS_TILE_SOURCE
} from './rendering/fragment_shaders.js';

import {Neighbours} from './world.js'
import { MoveDirections } from './command.js';




function getRGBForNamedColor (name) {
    switch(name) {
        case "gray":    return [0.5,0.5,0.5];
        case "red":     return [1.0, 0.0, 0.0];
        case "green":   return [0.0, 0.5, 0.0];
        case "blue":    return [0.0, 0.0, 1.0];
        case "white":   return [1.0, 1.0, 1.0];
    }
    return [0,0,0];
}

function createFullscreenQuad(gl) {
    const vertices = [
        -1.0,  1.0, 0.0,
        -1.0, -1.0, 0.0,
         1.0, -1.0, 0.0,
         1.0,  1.0, 0.0 
    ];
    return getQuadForVerts(gl, vertices);
}

function createGlQuad(gl) {
    const vertices = [
        -0.5,  0.5, 0.0,
        -0.5, -0.5, 0.0,
         0.5, -0.5, 0.0,
         0.5,  0.5, 0.0 
    ];
    return getQuadForVerts(gl, vertices);
   
}


function getQuadForVerts(gl, verts) {
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
        
        const vertex_buffer = getBuffer(new Float32Array(verts), gl.ARRAY_BUFFER)
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

function createGLShader(gl, vs, fs, name = "") {
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

    const result = new ShaderProgram(shader_program, name);
    return result; 
}


export class FrameBuffer {
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
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        this.buffer = fb;
    }
}


class ShaderProgram {
    program;
    uniforms = {};
    attributes = {};
    name = "";

    constructor(program, name) {
        this.program = program;
        this.name = name;
    }

    addUniform(gl, key, name) {
        this.uniforms[key] = { location: gl.getUniformLocation(this.program, name), value: 0 };
    }

    addAttribute(gl, key, name) {
        this.attributes[key] = {location: gl.getAttribLocation(this.program, name), value: 0 };
    }
};


const EdgeMaskTypes = {
    TOP_LEFT_OUTER: 0,
    TOP_LEFT_INNER: 1,
    TOP_LEFT_LEFT:  2,
    TOP_LEFT_TOP:   3,

    TOP_RIGHT_OUTER: 10,
    TOP_RIGHT_INNER: 11,
    TOP_RIGHT_RIGHT: 12,
    TOP_RIGHT_TOP:   13,

    BOTTOM_LEFT_OUTER:  20,
    BOTTOM_LEFT_INNER:  21,
    BOTTOM_LEFT_LEFT:   22,
    BOTTOM_LEFT_BOTTOM: 23,

    BOTTOM_RIGHT_OUTER:  30,
    BOTTOM_RIGHT_INNER:  31,
    BOTTOM_RIGHT_RIGHT:  32,
    BOTTOM_RIGHT_BOTTOM: 33,
};

export class Renderer {
    canvas;
    #context;
    frame_buffer;

    quad;
    fs_quad;

    default_white_shader;
    single_color_shader;
    fullscreen_shader;
    grid_shader;
    texture_shader;
    circle_color_shader;
    cursor_shader;
    tile_shader;


    texture_catalog;
    texture_environment_background;

    render_list = [];
    environment_list = [];

    camera_projection;

    constructor() {
        this.reset();
        const gl = this.#context;

        // QUADS
        {
            this.quad = createGlQuad(gl);
            this.fs_quad = createFullscreenQuad(gl);
        }

        // SHADERS
        {
            this.fullscreen_shader = createGLShader(gl, VS_FULLSCREEN_SOURCE, FS_MATTE_SOURCE);
            this.fullscreen_shader.addUniform(gl, 'color_texture', 'uColorTexture');
    
            this.grid_shader = createGLShader(gl, VS_FULLSCREEN_SOURCE, FS_GRID_SOURCE);
            this.grid_shader.addUniform(gl, 'color', 'uColor');
            this.grid_shader.addUniform(gl, 'resolution', 'uResolution');
            this.grid_shader.addUniform(gl, 'world_dimensions', 'uWorldDimensions');
    
            this.default_white_shader = createGLShader(gl, VS_MVP_SOURCE, FS_WHITE_SOURCE);
            this.default_white_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
            this.default_white_shader.addAttribute(gl, 'texcoord', 'aTexCoord');
            this.default_white_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
            this.default_white_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
            
            this.single_color_shader  = createGLShader(gl, VS_MVP_SOURCE, FS_COLOR_SOURCE);
            this.single_color_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
            this.single_color_shader.addAttribute(gl, 'texcoord', 'aTexCoord');
            this.single_color_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
            this.single_color_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
            this.single_color_shader.addUniform(gl, 'color', 'uColor');
            
            this.circle_color_shader = createGLShader(gl, VS_MVP_SOURCE, FS_CIRCLE_SOURCE, "circle_color_shader");
            this.circle_color_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
            this.circle_color_shader.addAttribute(gl, 'texcoord', 'aTexCoord');
            this.circle_color_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
            this.circle_color_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
            this.circle_color_shader.addUniform(gl, 'color', 'uColor');
            this.circle_color_shader.addUniform(gl, 'radius', 'uRadius');
            
            
            this.texture_shader  = createGLShader(gl, VS_MVP_SOURCE, FS_MASKED_SOURCE);
            this.texture_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
            this.texture_shader.addAttribute(gl, 'texcoord', 'aTexCoord');
            this.texture_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
            this.texture_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
            this.texture_shader.addUniform(gl, 'edge_mask_texture', 'uMaskTexture');
            this.texture_shader.addUniform(gl, 'color', 'uColor');
            
            
            this.cursor_shader  = createGLShader(gl, VS_MVP_SOURCE, FS_CURSOR_SOURCE);
            this.cursor_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
            this.cursor_shader.addAttribute(gl, 'texcoord', 'aTexCoord');
            this.cursor_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
            this.cursor_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
            this.cursor_shader.addUniform(gl, 'color', 'uColor');
            this.cursor_shader.addUniform(gl, 'time', 'uTime');
            this.cursor_shader.addUniform(gl, 'show_left', 'uShowLeft');
            this.cursor_shader.addUniform(gl, 'show_right', 'uShowRight');

            this.tile_shader = createGLShader(gl, VS_MVP_SOURCE, FS_TILE_SOURCE);
            this.tile_shader.addAttribute(gl, 'vertex_position', 'aVertexPosition');
            this.tile_shader.addAttribute(gl, 'texcoord', 'aTexCoord');
            this.tile_shader.addUniform(gl, 'modelview_matrix', 'uModelViewMatrix');
            this.tile_shader.addUniform(gl, 'projection_matrix', 'uProjectionMatrix');
            this.tile_shader.addUniform(gl, 'color', 'uColor');
            this.tile_shader.addUniform(gl, 'mask_texture_tl', 'uMaskTextureTL');
            this.tile_shader.addUniform(gl, 'mask_texture_tr', 'uMaskTextureTR');
            this.tile_shader.addUniform(gl, 'mask_texture_bl', 'uMaskTextureBL');
            this.tile_shader.addUniform(gl, 'mask_texture_br', 'uMaskTextureBR');
            
        }
        
        // INITIAL SETTINGS
        {
            gl.clearColor(0.1, 0.1, 0.1, 0.0);  // Clear to color fully transparent
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
      
    }

    setTextureCatalog(catalog) {
        this.texture_catalog = catalog;
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

  

    pushCursorQuad(named_color, position, push_dir, scale = 1.0) {
        const color = [...getRGBForNamedColor(named_color), 1];
        const renderable = this.getRenderableQuad(color, position);
        renderable.scale = scale;
        renderable.shader = this.cursor_shader;
        renderable.show_left = true;
        renderable.show_right = true;

        if (push_dir) {
            renderable.show_left =  (push_dir === MoveDirections.LEFT);
            renderable.show_right = (push_dir === MoveDirections.RIGHT);
        }

        this.render_list.push(renderable);
    }


    getSingleColoredQuad(named_color, position, scale) {
        const color = [...getRGBForNamedColor(named_color), 1];
        const renderable = this.getRenderableQuad(color, [...position, -1]);
        renderable.shader = this.single_color_shader;
        renderable.scale = scale;
        
        return renderable;
    }
    
    pushEnvironmentQuad(named_color, position, scale, neighbours) {
        const is_full = true;
        const color = [...getRGBForNamedColor(named_color), 1.0];
        const a = this.getSubTile(color, position, "TOP_LEFT", neighbours, is_full)
        const b = this.getSubTile(color, position, "TOP_RIGHT", neighbours, is_full)
        const c = this.getSubTile(color, position, "BOTTOM_LEFT", neighbours, is_full)
        const d = this.getSubTile(color, position, "BOTTOM_RIGHT", neighbours, is_full)
        this.environment_list.push(a, b, c, d);
    }
  
    pushCircleQuad(named_color, position, radius) {
        const renderable = this.getSingleColoredQuad(named_color, position, 1.0);
        renderable.shader = this.circle_color_shader;
        renderable.radius = radius;

        this.render_list.push(renderable);
    }

    pushColoredQuad(named_color, position, scale = 1.0) {
        const renderable = this.getSingleColoredQuad(named_color, position, scale);

        this.render_list.push(renderable);
    }


    getSubTile(color, tile_position, corner, neighbours, is_full) {
        const renderable = this.getRenderableQuad(color, this.getSubPosition(tile_position, corner));
        renderable.shader = this.texture_shader;
        renderable.scale = 0.5;
        const mask_type = this.getEdgeMaskType(corner, neighbours);
        renderable.edge_mask_texture = this.getMaskForType(mask_type, is_full);

        return renderable;
    }

    pushSubTile(color, tile_position, corner, neighbours, is_full) {
        const renderable = this.getSubTile(color, tile_position, corner, neighbours, is_full);

        this.render_list.push(renderable);
    }

    pushTile(named_color, position, neighbours, is_full) {
        const color = [...getRGBForNamedColor(named_color), 1.0];
        const renderable = this.getRenderableQuad(color, [...position, -1]);
        renderable.mask_texture_tl = this.getMaskForType(this.getEdgeMaskType("TOP_LEFT", neighbours), is_full);
        renderable.mask_texture_tr = this.getMaskForType(this.getEdgeMaskType("TOP_RIGHT", neighbours), is_full);
        renderable.mask_texture_bl = this.getMaskForType(this.getEdgeMaskType("BOTTOM_LEFT", neighbours), is_full);
        renderable.mask_texture_br = this.getMaskForType(this.getEdgeMaskType("BOTTOM_RIGHT", neighbours), is_full);
        renderable.shader = this.tile_shader;
        renderable.type = "SINGLE_QUAD_TILE"; // temporary
        this.render_list.push(renderable);
    }

    pushFullRoundedColorTile(named_color, position, neighbours) {
        this.pushRoundedColorTile(named_color, position, neighbours, true);
    }

    pushRoundedColorTile(named_color, position, neighbours, is_full = false) {
        const color = [...getRGBForNamedColor(named_color), 1.0];
        this.pushSubTile(color, position, "TOP_LEFT",     neighbours, is_full);
        this.pushSubTile(color, position, "TOP_RIGHT",    neighbours, is_full);
        this.pushSubTile(color, position, "BOTTOM_LEFT",  neighbours, is_full);
        this.pushSubTile(color, position, "BOTTOM_RIGHT", neighbours, is_full);
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

    getMaskForType(type, is_full) {
        if (!this.texture_catalog) {
            console.error("No texture catalog found!")
            return;
        }
        switch(type) {
            case EdgeMaskTypes.TOP_LEFT_OUTER:      return is_full ? this.texture_catalog.get("texture_full_mask_tl")      : this.texture_catalog.get("tile_mask_tl_outer");
            case EdgeMaskTypes.TOP_LEFT_INNER:      return is_full ? this.texture_catalog.get("texture_full_mask_none")    : this.texture_catalog.get("tile_mask_tl_inner");
            case EdgeMaskTypes.TOP_LEFT_LEFT:       return is_full ? this.texture_catalog.get("texture_full_mask_none")    : this.texture_catalog.get("tile_mask_tl_left");
            case EdgeMaskTypes.TOP_LEFT_TOP:        return is_full ? this.texture_catalog.get("texture_full_mask_none")    : this.texture_catalog.get("tile_mask_tl_top");

            case EdgeMaskTypes.TOP_RIGHT_OUTER:     return is_full ? this.texture_catalog.get("texture_full_mask_tr")      : this.texture_catalog.get("tile_mask_tr_outer");
            case EdgeMaskTypes.TOP_RIGHT_INNER:     return is_full ? this.texture_catalog.get("texture_full_mask_none")    : this.texture_catalog.get("tile_mask_tr_inner");
            case EdgeMaskTypes.TOP_RIGHT_RIGHT:     return is_full ? this.texture_catalog.get("texture_full_mask_none")    : this.texture_catalog.get("tile_mask_tl_right");
            case EdgeMaskTypes.TOP_RIGHT_TOP:       return is_full ? this.texture_catalog.get("texture_full_mask_none")    : this.texture_catalog.get("tile_mask_tl_top");

            case EdgeMaskTypes.BOTTOM_LEFT_OUTER:   return is_full ? this.texture_catalog.get("texture_full_mask_bl")       : this.texture_catalog.get("tile_mask_bl_outer");
            case EdgeMaskTypes.BOTTOM_LEFT_INNER:   return is_full ? this.texture_catalog.get("texture_full_mask_none")     : this.texture_catalog.get("tile_mask_bl_inner");
            case EdgeMaskTypes.BOTTOM_LEFT_LEFT:    return is_full ? this.texture_catalog.get("texture_full_mask_none")     : this.texture_catalog.get("tile_mask_tl_left");
            case EdgeMaskTypes.BOTTOM_LEFT_BOTTOM:  return is_full ? this.texture_catalog.get("texture_full_mask_none")     : this.texture_catalog.get("tile_mask_tl_bottom");

            case EdgeMaskTypes.BOTTOM_RIGHT_OUTER:  return is_full ? this.texture_catalog.get("texture_full_mask_br")       : this.texture_catalog.get("tile_mask_br_outer");
            case EdgeMaskTypes.BOTTOM_RIGHT_INNER:  return is_full ? this.texture_catalog.get("texture_full_mask_none")     : this.texture_catalog.get("tile_mask_br_inner");
            case EdgeMaskTypes.BOTTOM_RIGHT_RIGHT:  return is_full ? this.texture_catalog.get("texture_full_mask_none")     : this.texture_catalog.get("tile_mask_tl_right");
            case EdgeMaskTypes.BOTTOM_RIGHT_BOTTOM: return is_full ? this.texture_catalog.get("texture_full_mask_none")     : this.texture_catalog.get("tile_mask_tl_bottom");
        }

        return this.texture_catalog.get("texture_full_mask_none");
    }

    getEdgeMaskType(corner, neighbours) {
        switch(corner) {
            case "TOP_LEFT": {
                if (neighbours & Neighbours.TOP_LEFT && !(neighbours & Neighbours.TOP || neighbours & Neighbours.LEFT)) {
                    return EdgeMaskTypes.TOP_LEFT_INNER;
                }
                else if (neighbours & Neighbours.TOP && neighbours & Neighbours.LEFT) {
                    return EdgeMaskTypes.TOP_LEFT_OUTER;
                }

                else if (neighbours & Neighbours.LEFT) {
                    return EdgeMaskTypes.TOP_LEFT_LEFT;
                }
                else if (neighbours & Neighbours.TOP) {
                    return EdgeMaskTypes.TOP_LEFT_TOP;
                }
            }
            break;

            case "TOP_RIGHT": {
                if (neighbours & Neighbours.TOP_RIGHT && !(neighbours & Neighbours.TOP || neighbours & Neighbours.RIGHT)) {
                    return EdgeMaskTypes.TOP_RIGHT_INNER;
                    
                }
                else if (neighbours & Neighbours.TOP && neighbours & Neighbours.RIGHT) {
                    return EdgeMaskTypes.TOP_RIGHT_OUTER;
                }

                else if (neighbours & Neighbours.RIGHT) {
                    return EdgeMaskTypes.TOP_RIGHT_RIGHT;
                }
                else if (neighbours & Neighbours.TOP) {
                    return EdgeMaskTypes.TOP_RIGHT_TOP;
                }

            }
            break;

            case "BOTTOM_LEFT": {
                if (neighbours & Neighbours.BOTTOM_LEFT && !(neighbours & Neighbours.BOTTOM || neighbours & Neighbours.LEFT)) {
                    return EdgeMaskTypes.BOTTOM_LEFT_INNER;
                }
                else if (neighbours & Neighbours.BOTTOM && neighbours & Neighbours.LEFT) {
                    return EdgeMaskTypes.BOTTOM_LEFT_OUTER;
                }

                else if (neighbours & Neighbours.LEFT) {
                    return EdgeMaskTypes.BOTTOM_LEFT_LEFT;
                }
                else if (neighbours & Neighbours.BOTTOM) {
                    return EdgeMaskTypes.BOTTOM_LEFT_BOTTOM;
                }

            }
            break;

            case "BOTTOM_RIGHT": {
                if (neighbours & Neighbours.BOTTOM_RIGHT && !(neighbours & Neighbours.BOTTOM || neighbours & Neighbours.RIGHT)) {
                    return EdgeMaskTypes.BOTTOM_RIGHT_INNER;
                }
                else if (neighbours & Neighbours.BOTTOM && neighbours & Neighbours.RIGHT) {
                    return EdgeMaskTypes.BOTTOM_RIGHT_OUTER;
                }

                else if (neighbours & Neighbours.RIGHT) {
                    return EdgeMaskTypes.BOTTOM_RIGHT_RIGHT;
                }
                else if (neighbours & Neighbours.BOTTOM) {
                    return EdgeMaskTypes.BOTTOM_RIGHT_BOTTOM;
                }

            }
            break;
        }
    }

    

    drawTile(renderable) {
        const gl = this.#context;

        const info = renderable.shader;
        gl.useProgram(info.program);

        const {position, color} = renderable;
        
        // ATTRIBUTES
        const mesh = this.quad;

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.position_indices);
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


        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.texcoord);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.texcoord_indices);
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

        // MASK TEXTURES
        const useTexture = (texture, location, offset) => {
            gl.activeTexture(gl.TEXTURE0 + offset);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(location, offset);
        };
        
        let offset = 0;
        useTexture(renderable.mask_texture_tl, info.uniforms.mask_texture_tl.location, offset++);
        useTexture(renderable.mask_texture_tr, info.uniforms.mask_texture_tr.location, offset++);
        useTexture(renderable.mask_texture_bl, info.uniforms.mask_texture_bl.location, offset++);
        useTexture(renderable.mask_texture_br, info.uniforms.mask_texture_br.location, offset++);
    

        // Draw call
        gl.drawElements(gl.TRIANGLES, this.quad.position_indices_count, gl.UNSIGNED_SHORT, 0);
    }
  

    drawColoredQuad(renderable, time) {
        const gl = this.#context;

        const info = renderable.shader;
        gl.useProgram(info.program);

        const {position, color} = renderable;

        const mesh = this.quad;
    

        // ATTRIBUTES
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.position_indices);
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

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.texcoord);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.texcoord_indices);
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
        

        // FRAGMENT
        const projection_matrix = this.getCameraProjection();
        const modelview_matrix = mat4.create();
        mat4.translate(modelview_matrix, modelview_matrix, position);

        if (renderable.scale) {
            const {scale} = renderable;
            mat4.scale(modelview_matrix, modelview_matrix, [scale, scale, scale])
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
            color
        );

        // MASK TEXTURE
        
        if (renderable.edge_mask_texture) {
            let offset = 0;
            gl.activeTexture(gl.TEXTURE0 + offset);

            gl.bindTexture(gl.TEXTURE_2D, renderable.edge_mask_texture);

            gl.uniform1i(info.uniforms.edge_mask_texture.location, offset);
        }
       


        // OPTIONALS

        if (info.uniforms.time) {
            
            gl.uniform1f(
                info.uniforms.time.location,
                time || 1.0
            );  
        }

        if (info.uniforms.radius) {
            gl.uniform1f(
                info.uniforms.radius.location,
                renderable.radius || 0.1
            );
        }
 
        if (info.uniforms.show_left || info.uniforms.show_right ) {
            gl.uniform1i(
                info.uniforms.show_left.location,
                renderable.show_left
            );
            gl.uniform1i(
                info.uniforms.show_right.location,
                renderable.show_right
            );
        }        
        // Draw call
        {
            gl.drawElements(gl.TRIANGLES, this.quad.position_indices_count, gl.UNSIGNED_SHORT, 0);
        }
    }


    drawGrid(world_dimensions) {
        const gl = this.#context;
        const quad = this.fs_quad;
        const info = this.grid_shader;
        gl.useProgram(info.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, quad.position);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quad.position_indices);
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

        gl.bindBuffer(gl.ARRAY_BUFFER, quad.texcoord);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quad.texcoord_indices);
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


        
        gl.uniform4fv(
            info.uniforms.color.location,
            [...getRGBForNamedColor("black"), 1]
        );

        gl.uniform2fv(
            info.uniforms.resolution.location,
            [this.canvas.width, this.canvas.height]
        );

        gl.uniform2fv(
            info.uniforms.world_dimensions.location,
            world_dimensions
        );

    

        
        // Draw call
        {
            gl.drawElements(gl.TRIANGLES, quad.position_indices_count, gl.UNSIGNED_SHORT, 0);
        }
    }

    drawFullScreenQuad(texture) {
        const gl = this.#context;
        const quad = this.fs_quad;
        const info = this.fullscreen_shader;
        gl.useProgram(info.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, quad.position);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quad.position_indices);
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

        gl.bindBuffer(gl.ARRAY_BUFFER, quad.texcoord);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quad.texcoord_indices);
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


        // TEXTURE
        {

            
            // Tell WebGL we want to affect texture unit 0
            gl.activeTexture(gl.TEXTURE0);
            
            // Bind the texture to texture unit 0
            gl.bindTexture(gl.TEXTURE_2D, texture);
            // Tell the shader we bound the texture to texture unit 0
            gl.uniform1i(info.uniforms.color_texture.location, 0);

            //gl.bindTexture(gl.TEXTURE_2D, null);
        }

        // Draw call
        {
            
            gl.drawElements(gl.TRIANGLES, quad.position_indices_count, gl.UNSIGNED_SHORT, 0);
           // gl.bindTexture(gl.TEXTURE_2D, null);
           // gl.activeTexture(null);
        }
    }



    getCameraProjection() {
        return this.camera_projection;
    }

    updateCameraProjection(world_dim_w, world_dim_h, os_factor) {
        const z_near = 0.1;
        const z_far = 100.0;
        const proj_matrix = mat4.create();

        const dim_w = world_dim_w;
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

    // NOTE: for performance reasons, at first loop we draw all environmental tiles 
    // to a texture and simply use that to draw the background in subsequent render loops.
    updateEnvironmentTexture(frame_buffer) {

        if (!this.environment_list.length) return;

        const gl = this.#context;
        const renderables = this.environment_list;

       

        // DRAW TO FRAMEBUFFER
        {
            gl.bindFramebuffer(gl.FRAMEBUFFER, frame_buffer.buffer);
            gl.viewport(0, 0, frame_buffer.width, frame_buffer.height);
           
            gl.clear(gl.COLOR_BUFFER_BIT);
    
            while (renderables.length) {
                const renderable = renderables.pop();
                this.drawColoredQuad(renderable);
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        this.texture_environment_background = frame_buffer.texture;
    }

    drawAll(time, enable_grid, game_state) {
        const gl = this.#context;

        // NOTE: should only be filled at first loop and not in subsequent loops.
        if (this.environment_list.length) {
            // Pre-render background for better performance.
            this.updateEnvironmentTexture(this.frame_buffer);
        }
        
        {
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            
            gl.clear(gl.COLOR_BUFFER_BIT);

            if (this.texture_environment_background) {
                this.drawFullScreenQuad(this.texture_environment_background);
            }


            for (const renderable of this.render_list) {
                if (renderable.type === "SINGLE_QUAD_TILE") {
                    this.drawTile(renderable);   
                }
                else {
                    this.drawColoredQuad(renderable, time);
                }
            }
            this.render_list.length = 0;

            if (enable_grid) {
                this.drawGrid(game_state.world_dimensions);
            }
        }
    }
}