
export function loadTexture(gl, url, load_manager) { 
    const isPowerOf2 = (n) => (n & (n - 1)) === 0;

    if (load_manager) load_manager.itemStart();

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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        if (load_manager) load_manager.itemEnd();
    };
    image.src = url;
    

    return texture;
}


export class TextureCatalog {
    textures = new Map();

    // NOTE: this is dependant on the WebGL context, so we might want
    // to abstract this out later.
    add(url, name, load_manager, gl) {
        const texture = loadTexture(gl, url, load_manager);
        this.textures.set(name, texture);
    }

    get(name) {
        return this.textures.get(name);
    }

}