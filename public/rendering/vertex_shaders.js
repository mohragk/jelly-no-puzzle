export const VS_MVP_SOURCE = `
    attribute vec3 aVertexPosition;
    attribute vec2 aTexCoord;

    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    uniform mat4 uProjectionMatrix;

    varying highp vec2 texCoord;

    void main() {
        gl_Position = uProjectionMatrix * uModelMatrix * uViewMatrix * vec4(aVertexPosition , 1.0);
        texCoord = aTexCoord;
    }
`;