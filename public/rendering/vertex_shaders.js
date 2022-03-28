export const VS_MVP_SOURCE = `
    attribute vec4 aVertexPosition;

    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
        gl_Position = uProjectionMatrix * uModelMatrix * uViewMatrix * aVertexPosition;
    }
`;