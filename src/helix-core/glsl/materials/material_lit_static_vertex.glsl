attribute vec4 hx_position;

uniform mat4 hx_worldViewMatrix;

varying vec3 hx_viewPosition;
uniform mat4 hx_inverseProjectionMatrix;

void main()
{
    hx_geometry();
    hx_viewPosition = (hx_inverseProjectionMatrix * gl_Position).xyz;
}