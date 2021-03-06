import {Shader} from "../shader/Shader";
import {ShaderLibrary} from "../shader/ShaderLibrary";
import {TextureCube} from "../texture/TextureCube";
import {GL} from "../core/GL";
import {FrameBuffer} from "../texture/FrameBuffer";
import {capabilities, CubeFace, DataType, TextureFilter} from "../Helix";
import {VertexBuffer} from "../core/VertexBuffer";
import {IndexBuffer} from "../core/IndexBuffer";
import {CustomCopyShader} from "../render/UtilShaders";
import {Texture2D} from "../texture/Texture2D";
import {RectMesh} from "../mesh/RectMesh";

var toCubeShader;
var fromCubeShader;
var toCubeVertices;
var toCubeIndices;

/**
 * EquirectangularTexture is a utility class that converts equirectangular environment {@linknode Texture2D} to a
 * {@linkcode TextureCube}.
 *
 * @namespace
 *
 * @author derschmale <http://www.derschmale.com>
 */
export var EquirectangularTexture =
{
    /**
     * Convert an equirectangular environment {@linknode Texture2D} to a {@linkcode TextureCube}.
     * @param source The source {@linknode Texture2D}
     * @param [size] The size of the target cube map.
     * @param [generateMipmaps] Whether or not a mip chain should be generated.
     * @param [target] An optional target {@linkcode TextureCube} to contain the converted data.
     * @returns {TextureCube} The environment map in a {@linkcode TextureCube}
     */
    toCube: function(source, size, generateMipmaps, target)
    {
        generateMipmaps = generateMipmaps === undefined? true : generateMipmaps;
        size = size || source.height;

        if (!toCubeShader)
            toCubeShader = new Shader(ShaderLibrary.get("2d_to_cube_vertex.glsl"), ShaderLibrary.get("equirectangular_to_cube_fragment.glsl"));

        if (!toCubeVertices)
            createRenderCubeGeometry();

        var gl = GL.gl;
        target = target || new TextureCube();
        target.initEmpty(size, source.format, getDataType(source.dataType));
        var faces = [ CubeFace.POSITIVE_X, CubeFace.NEGATIVE_X, CubeFace.POSITIVE_Y, CubeFace.NEGATIVE_Y, CubeFace.POSITIVE_Z, CubeFace.NEGATIVE_Z ];

		GL.setShader(toCubeShader);

        var textureLocation = toCubeShader.getUniformLocation("source");
        var posLocation = toCubeShader.getAttributeLocation("hx_position");
        var cornerLocation = toCubeShader.getAttributeLocation("corner");

        gl.uniform1i(textureLocation, 0);
        source.bind(0);

        toCubeIndices.bind();

        GL.enableAttributes(2);
        var old = GL.getCurrentRenderTarget();

        for (var i = 0; i < 6; ++i) {
            var fbo = new FrameBuffer(target, null, faces[i]);
            fbo.init();

            // we first used a single vertex buffer and drew elements with offsets, but it seems firefox did NOT like that
            toCubeVertices[i].bind();
            gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 20, 0);
            gl.vertexAttribPointer(cornerLocation, 3, gl.FLOAT, false, 20, 8);

            GL.setRenderTarget(fbo);
            GL.drawElements(gl.TRIANGLES, 6);
        }

        GL.setRenderTarget(old);

        if (generateMipmaps)
            target.generateMipmap();

        // TODO: for some reason, if EXT_shader_texture_lod is not supported, mipmapping of rendered-to cubemaps does not work
        if (capabilities.EXT_SHADER_TEXTURE_LOD)
            target.filter = TextureFilter.TRILINEAR;
        else
            target.filter = TextureFilter.BILINEAR_NOMIP;

        return target;
    },

    fromCube: function(source, width, generateMipmaps, target)
    {
        generateMipmaps = generateMipmaps === undefined? true : generateMipmaps;
        width = width || (source.size << 1);
        var height = width >> 1;

        target = target || new Texture2D();
        target.initEmpty(width, height, source.format, getDataType(source.dataType));

        if (!fromCubeShader)
            fromCubeShader = new CustomCopyShader(ShaderLibrary.get("equirectangular_from_cube_fragment.glsl"));

        var old = GL.getCurrentRenderTarget();
        var fbo = new FrameBuffer(target);
        fbo.init();

        GL.setRenderTarget(fbo);
        GL.clear();

        fromCubeShader.execute(RectMesh.DEFAULT, source);

        GL.setRenderTarget(old);

        if (generateMipmaps)
            target.generateMipmap();

        return target;
    }
};

function createRenderCubeGeometry()
{
    var vertices = [
        [
            // pos X
            1.0, 1.0, 1.0, -1.0, -1.0,
            -1.0, 1.0, 1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0, 1.0, 1.0,
            1.0, -1.0, 1.0, 1.0, -1.0
        ],
        [
            // neg X
            1.0, 1.0, -1.0, -1.0, 1.0,
            -1.0, 1.0, -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0, 1.0, -1.0,
            1.0, -1.0, -1.0, 1.0, 1.0,
        ],
        [
            // pos Y
            1.0, 1.0, 1.0, -1.0, 1.0,
            -1.0, 1.0, -1.0, -1.0, 1.0,
            -1.0, -1.0, -1.0, 1.0, 1.0,
            1.0, -1.0, 1.0, 1.0, 1.0,
        ],
        [
            // neg Y
            1.0, 1.0, -1.0, -1.0, -1.0,
            -1.0, 1.0, 1.0, -1.0, -1.0,
            -1.0, -1.0, 1.0, 1.0, -1.0,
            1.0, -1.0, -1.0, 1.0, -1.0,
        ],
        [
            // pos Z
            -1.0, -1.0, -1.0, 1.0, -1.0,
            1.0, -1.0, 1.0, 1.0, -1.0,
            1.0, 1.0, 1.0, 1.0, 1.0,
            -1.0, 1.0, -1.0, 1.0, 1.0,
        ],
        [
            // neg Z
            -1.0, -1.0, -1.0, -1.0, 1.0,
            1.0, -1.0, 1.0, -1.0, 1.0,
            1.0, 1.0, 1.0, -1.0, -1.0,
            -1.0, 1.0, -1.0, -1.0, -1.0
        ]
    ];
    var indices = [
        0, 1, 2, 0, 2, 3
    ];
    toCubeVertices = [];
    for (var i = 0; i < 6; ++i) {
        toCubeVertices[i] = new VertexBuffer();
        toCubeVertices[i].uploadData(new Float32Array(vertices[i]));
    }

    toCubeIndices = new IndexBuffer();
    toCubeIndices.uploadData(new Uint16Array(indices));
}

function getDataType(type)
{
    if (type === DataType.HALF_FLOAT && !capabilities.EXT_COLOR_BUFFER_HALF_FLOAT)
        type = capabilities.EXT_COLOR_BUFFER_FLOAT? DataType.FLOAT : DataType.UNSIGNED_BYTE;
    else if (type === DataType.FLOAT && !capabilities.EXT_COLOR_BUFFER_FLOAT)
        type = capabilities.EXT_COLOR_BUFFER_HALF_FLOAT? DataType.HALF_FLOAT : DataType.UNSIGNED_BYTE;

    return type;
}