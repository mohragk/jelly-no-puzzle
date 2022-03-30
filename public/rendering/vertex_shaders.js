export const VS_MVP_SOURCE = `
    attribute vec3 aVertexPosition;
    attribute vec2 aTexCoord;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying highp vec2 texCoord;

    void main() {
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition , 1.0);
        texCoord = aTexCoord;
    }
`;

export const VS_FULLSCREEN_SOURCE = `
    attribute vec3 aVertexPosition;
    attribute vec2 aTexCoord;

    varying highp vec2 texCoord;

    void main() {
        gl_Position = vec4(aVertexPosition , 1.0);
        texCoord = aTexCoord;
    }
`