attribute vec4 hx_position;
attribute vec2 hx_texCoord;

varying vec2 uv;

uniform vec2 direction; // this is 1/pixelSize

void main()
{
	uv = hx_texCoord;
	gl_Position = hx_position;
}