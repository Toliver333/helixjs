varying vec3 normal;
varying vec3 tangent;
varying vec3 bitangent;
varying vec2 uv;
varying float linearDepth;

uniform sampler2D map;

uniform vec3 color;
uniform float specularNormalReflection;
uniform float roughness;

uniform float hx_transparencyMode;

void main()
{
   vec4 samp = texture2D(map, uv);
   mat3 TBN;
   TBN[2] = normalize(normal);
   TBN[0] = normalize(tangent);
   TBN[1] = normalize(bitangent);
   vec3 normal = vec3(samp.xy * 2.0 - 1.0, 1.0);
   normal = TBN * normal;
   hx_processGeometry(hx_gammaToLinear(vec4(color, samp.z)), normal, 0.0, specularNormalReflection, roughness, hx_transparencyMode, linearDepth);
}