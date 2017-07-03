HX.VERSION = '0.1';
HX.INITIALIZED = false;

var HX_GL = null;

/**
 * Provides a set of options to configure Helix
 * @constructor
 */
HX.InitOptions = function()
{
    this.maxBones = 64;

    this.useSkinningTexture = true;

    // rendering pipeline options
    this.hdr = false;   // only if available
    this.useGammaCorrection = true;
    this.usePreciseGammaCorrection = false;  // Uses pow 2.2 instead of 2 for gamma correction, only valid if useGammaCorrection is true
    this.defaultLightingModel = HX.LightingModel.Unlit;

    this.maxPointLightsPerPass = 3;
    this.maxDirLightsPerPass = 1;

    // debug-related
    // this.debug = false;   // requires webgl-debug.js:
    this.ignoreAllExtensions = false;           // ignores all non-default extensions
    this.ignoreDrawBuffersExtension = false;     // forces multiple passes for the GBuffer
    this.ignoreDepthTexturesExtension = false;     // forces storing depth info explicitly
    this.ignoreTextureLODExtension = false;     // forces storing depth info explicitly
    this.ignoreHalfFloatTextureExtension = false;     // forces storing depth info explicitly
    this.throwOnShaderError = false;

    // will be assigned to HX.DirectionalLight.SHADOW_FILTER
    this.directionalShadowFilter = new HX.HardDirectionalShadowFilter();
};

/**
 * Initializes Helix and creates a WebGL context from a given canvas
 * @param canvas The canvas to create the gl context from.
 */
HX.init = function(canvas, options)
{
    if (HX.INITIALIZED) throw new Error("Can only initialize Helix once!");


    HX.TARGET_CANVAS = canvas;

    var webglFlags = {
        antialias:false,
        alpha:false,
        depth:false,
        stencil:false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false
    };

    var glContext = canvas.getContext('webgl', webglFlags) || canvas.getContext('experimental-webgl', webglFlags);
    /*if (options && options.debug) {
        // ugly, but prevents having to include the webgl-debug.js file
        eval("glContext = WebGLDebugUtils.makeDebugContext(glContext)");
    }*/

    HX.OPTIONS = options || new HX.InitOptions();
    HX.GL = HX_GL = glContext;

    if (!HX_GL) throw new Error("WebGL not supported");

    HX.INITIALIZED = true;

    var extensions  = HX_GL.getSupportedExtensions();

    function _getExtension(name)
    {
        return extensions.indexOf(name) >= 0 ? HX_GL.getExtension(name) : null;
    }

    // shortcuts
    HX._initGLProperties();

    HX._initLights();

    HX.GLSLIncludeGeometryPass = "\n" + HX.DirectionalLight.SHADOW_FILTER.getGLSL() + HX.GLSLIncludeGeometryPass;

    var defines = "";
    if (HX.OPTIONS.useGammaCorrection !== false)
        defines += HX.OPTIONS.usePreciseGammaCorrection? "#define HX_GAMMA_CORRECTION_PRECISE\n" : "#define HX_GAMMA_CORRECTION_FAST\n";

    defines += "#define HX_MAX_BONES " + HX.OPTIONS.maxBones + "\n";

    HX.OPTIONS.ignoreDrawBuffersExtension = HX.OPTIONS.ignoreDrawBuffersExtension || HX.OPTIONS.ignoreAllExtensions;
    HX.OPTIONS.ignoreDepthTexturesExtension = HX.OPTIONS.ignoreDepthTexturesExtension || HX.OPTIONS.ignoreAllExtensions;
    HX.OPTIONS.ignoreTextureLODExtension = HX.OPTIONS.ignoreTextureLODExtension || HX.OPTIONS.ignoreAllExtensions;
    HX.OPTIONS.ignoreHalfFloatTextureExtension = HX.OPTIONS.ignoreHalfFloatTextureExtension || HX.OPTIONS.ignoreAllExtensions;

    if (!HX.OPTIONS.ignoreDrawBuffersExtension)
        HX.EXT_DRAW_BUFFERS = _getExtension('WEBGL_draw_buffers');

    if (HX.EXT_DRAW_BUFFERS && HX.EXT_DRAW_BUFFERS.MAX_DRAW_BUFFERS_WEBGL >= 3)
        defines += "#extension GL_EXT_draw_buffers : require\n";

    HX.EXT_FLOAT_TEXTURES = _getExtension('OES_texture_float');
    if (!HX.EXT_FLOAT_TEXTURES) {
        console.warn('OES_texture_float extension not supported!');
        HX.OPTIONS.useSkinningTexture = false;
    }

    if (!HX.OPTIONS.ignoreHalfFloatTextureExtension)
        HX.EXT_HALF_FLOAT_TEXTURES = _getExtension('OES_texture_half_float');

    if (!HX.EXT_HALF_FLOAT_TEXTURES) console.warn('OES_texture_half_float extension not supported!');

    HX.EXT_FLOAT_TEXTURES_LINEAR = _getExtension('OES_texture_float_linear');
    if (!HX.EXT_FLOAT_TEXTURES_LINEAR) console.warn('OES_texture_float_linear extension not supported!');

    HX.EXT_HALF_FLOAT_TEXTURES_LINEAR = _getExtension('OES_texture_half_float_linear');
    if (!HX.EXT_HALF_FLOAT_TEXTURES_LINEAR) console.warn('OES_texture_half_float_linear extension not supported!');

    // these SHOULD be implemented, but are not by Chrome
    //HX.EXT_COLOR_BUFFER_FLOAT = _getExtension('WEBGL_color_buffer_float');
    //if (!HX.EXT_COLOR_BUFFER_FLOAT) console.warn('WEBGL_color_buffer_float extension not supported!');

    //HX.EXT_COLOR_BUFFER_HALF_FLOAT = _getExtension('EXT_color_buffer_half_float');
    //if (!HX.EXT_COLOR_BUFFER_HALF_FLOAT) console.warn('EXT_color_buffer_half_float extension not supported!');

    if (!HX.OPTIONS.ignoreDepthTexturesExtension)
        HX.EXT_DEPTH_TEXTURE = _getExtension('WEBGL_depth_texture');

    if (!HX.EXT_DEPTH_TEXTURE) {
        console.warn('WEBGL_depth_texture extension not supported!');
        defines += "#define HX_NO_DEPTH_TEXTURES\n";
    }

    HX.EXT_STANDARD_DERIVATIVES = _getExtension('OES_standard_derivatives');
    if (!HX.EXT_STANDARD_DERIVATIVES) console.warn('OES_standard_derivatives extension not supported!');

    if (!HX.OPTIONS.ignoreTextureLODExtension)
        HX.EXT_SHADER_TEXTURE_LOD = _getExtension('EXT_shader_texture_lod');

    if (!HX.EXT_SHADER_TEXTURE_LOD)
        console.warn('EXT_shader_texture_lod extension not supported!');

    HX.EXT_TEXTURE_FILTER_ANISOTROPIC = _getExtension('EXT_texture_filter_anisotropic');
    if (!HX.EXT_TEXTURE_FILTER_ANISOTROPIC) console.warn('EXT_texture_filter_anisotropic extension not supported!');

    //HX.EXT_SRGB = _getExtension('EXT_sRGB');
    //if (!HX.EXT_SRGB) console.warn('EXT_sRGB extension not supported!');

    HX.DEFAULT_TEXTURE_MAX_ANISOTROPY = HX.EXT_TEXTURE_FILTER_ANISOTROPIC? HX_GL.getParameter(HX.EXT_TEXTURE_FILTER_ANISOTROPIC.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;

    if (!HX.EXT_HALF_FLOAT_TEXTURES_LINEAR || !HX.EXT_HALF_FLOAT_TEXTURES)
        HX.OPTIONS.hdr = false;

    HX.HDR_FORMAT = HX.OPTIONS.hdr? HX.EXT_HALF_FLOAT_TEXTURES.HALF_FLOAT_OES : HX_GL.UNSIGNED_BYTE;

    HX.GAMMA_CORRECTION_IN_LIGHTS = false;

    // this causes lighting accumulation to happen in gamma space (only accumulation of lights within the same pass is linear)
    // This yields an incorrect gamma correction to be applied, but looks much better due to encoding limitation (otherwise there would be banding)
    if (HX.OPTIONS.useGammaCorrection && !HX.OPTIONS.hdr) {
        HX.GAMMA_CORRECT_LIGHTS = true;
        defines += "#define HX_GAMMA_CORRECT_LIGHTS\n";
    }

    if (HX.OPTIONS.useSkinningTexture) {
        defines += "#define HX_USE_SKINNING_TEXTURE\n";

        this._initDefaultSkinningTexture();
    }

    // this cannot be defined by the user
    HX.NUM_MORPH_TARGETS = 8;

    HX.GLSLIncludeGeneral = defines + HX.GLSLIncludeGeneral;

    // default copy shader
    HX.COPY_SHADER = new HX.CopyChannelsShader();

    HX._initMaterialPasses();

    HX.Texture2D._initDefault();
    HX.TextureCube._initDefault();
    HX.BlendState._initDefaults();
    HX.RectMesh._initDefault();
    HX.PoissonDisk._initDefault();
    HX.PoissonSphere._initDefault();

    HX._init2DDitherTexture(32, 32);

    HX.setClearColor(HX.Color.BLACK);

    HX.onPreFrame = new HX.Signal();  // for engine-specific stuff (entity updates etc), stats updates, etc
    HX.onFrame = new HX.Signal();   // for user-implemented behaviour and rendering

    HX.FRAME_TICKER = new HX.FrameTicker();
    HX.start();
};

HX.start = function()
{
    HX.FRAME_TICKER.start(function(dt) {
        HX.onPreFrame.dispatch(dt);
        HX.onFrame.dispatch(dt);
    });
};

HX.stop = function()
{
    HX.FRAME_TICKER.stop();
};

HX._initMaterialPasses = function()
{
    var options = HX.OPTIONS;
    HX.MaterialPass.BASE_PASS = 0;
    HX.MaterialPass.NORMAL_DEPTH_PASS = 1;
    HX.MaterialPass.DIR_LIGHT_PASS = 2;
    // assume only one dir light with shadow per pass, since it's normally only the sun
    HX.MaterialPass.DIR_LIGHT_SHADOW_PASS = HX.MaterialPass.DIR_LIGHT_PASS + options.maxDirLightsPerPass;
    HX.MaterialPass.POINT_LIGHT_PASS = HX.MaterialPass.DIR_LIGHT_SHADOW_PASS + 1;
    HX.MaterialPass.DIR_LIGHT_SHADOW_MAP_PASS = HX.MaterialPass.POINT_LIGHT_PASS + options.maxPointLightsPerPass;
    HX.MaterialPass.NUM_PASS_TYPES = HX.MaterialPass.DIR_LIGHT_SHADOW_MAP_PASS + 1;
};

HX._initLights = function()
{
    HX.DirectionalLight.SHADOW_FILTER = HX.OPTIONS.directionalShadowFilter;
};

HX._initDefaultSkinningTexture = function()
{
    HX.DEFAULT_SKINNING_TEXTURE = new HX.Texture2D();

    var data = [];
    for (var i = 0; i < HX.OPTIONS.maxBones; ++i)
        data.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0);

    HX.DEFAULT_SKINNING_TEXTURE.uploadData(new Float32Array(data), HX.OPTIONS.maxBones, 3, false, HX_GL.RGBA, HX_GL.FLOAT);
    HX.DEFAULT_SKINNING_TEXTURE.filter = HX.TextureFilter.NEAREST_NOMIP;
    HX.DEFAULT_SKINNING_TEXTURE.wrapMode = HX.TextureWrapMode.CLAMP;
};

HX._init2DDitherTexture = function(width, height)
{
    HX.DEFAULT_2D_DITHER_TEXTURE = new HX.Texture2D();
    var len = width * height;
    var minValue = 1.0 / len;
    var data = [];
    var k = 0;
    var values = [];
    var i;

    for (i = 0; i < len; ++i) {
        values.push(i / len);
    }

    HX.shuffle(values);

    for (i = 0; i < len; ++i) {
        var angle = values[i] * Math.PI * 2.0;
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        // store rotation matrix
        // RGBA:
        data[k++] = cos;
        data[k++] = sin;
        data[k++] = minValue + values[i];
        data[k++] = 1.0;
    }

    HX.DEFAULT_2D_DITHER_TEXTURE.uploadData(new Float32Array(data), width, height, false, HX_GL.RGBA, HX_GL.FLOAT);
    HX.DEFAULT_2D_DITHER_TEXTURE.filter = HX.TextureFilter.NEAREST_NOMIP;
    HX.DEFAULT_2D_DITHER_TEXTURE.wrapMode = HX.TextureWrapMode.REPEAT;
};


HX._initGLProperties = function()
{
    HX.TextureFilter = {};
    HX.TextureFilter.NEAREST = {min: HX_GL.NEAREST_MIPMAP_NEAREST, mag: HX_GL.NEAREST};
    HX.TextureFilter.BILINEAR = {min: HX_GL.LINEAR_MIPMAP_NEAREST, mag: HX_GL.LINEAR};
    HX.TextureFilter.TRILINEAR = {min: HX_GL.LINEAR_MIPMAP_LINEAR, mag: HX_GL.LINEAR};

    if (HX.EXT_TEXTURE_FILTER_ANISOTROPIC)
        HX.TextureFilter.TRILINEAR_ANISOTROPIC = {min: HX_GL.LINEAR_MIPMAP_LINEAR, mag: HX_GL.LINEAR};


    HX.TextureFilter.NEAREST_NOMIP = { min: HX_GL.NEAREST, mag: HX_GL.NEAREST };
    HX.TextureFilter.BILINEAR_NOMIP = { min: HX_GL.LINEAR, mag: HX_GL.LINEAR };

    HX.TextureWrapMode = {};
    HX.TextureWrapMode.REPEAT = { s: HX_GL.REPEAT, t: HX_GL.REPEAT };
    HX.TextureWrapMode.CLAMP = { s: HX_GL.CLAMP_TO_EDGE, t: HX_GL.CLAMP_TO_EDGE };

    // default settings:
    HX.TextureWrapMode.DEFAULT = HX.TextureWrapMode.REPEAT;
    HX.TextureFilter.DEFAULT = HX.TextureFilter.TRILINEAR;

    HX.CullMode = {
        NONE: null,
        BACK: HX_GL.BACK,
        FRONT: HX_GL.FRONT,
        ALL: HX_GL.FRONT_AND_BACK
    };

    HX.StencilOp = {
        KEEP: HX_GL.KEEP,
        ZERO: HX_GL.ZERO,
        REPLACE: HX_GL.REPLACE,
        INCREMENT: HX_GL.INCR,
        INCREMENT_WRAP: HX_GL.INCR_WRAP,
        DECREMENT: HX_GL.DECR,
        DECREMENT_WRAP: HX_GL.DECR_WRAP,
        INVERT: HX_GL.INVERT
    };

    HX.Comparison = {
        DISABLED: null,
        ALWAYS: HX_GL.ALWAYS,
        NEVER: HX_GL.NEVER,
        LESS: HX_GL.LESS,
        EQUAL: HX_GL.EQUAL,
        LESS_EQUAL: HX_GL.LEQUAL,
        GREATER: HX_GL.GREATER,
        NOT_EQUAL: HX_GL.NOTEQUAL,
        GREATER_EQUAL: HX_GL.GEQUAL
    };

    HX.ElementType = {
        POINTS: HX_GL.POINTS,
        LINES: HX_GL.LINES,
        LINE_STRIP: HX_GL.LINE_STRIP,
        LINE_LOOP: HX_GL.LINE_LOOP,
        TRIANGLES: HX_GL.TRIANGLES,
        TRIANGLE_STRIP: HX_GL.TRIANGLE_STRIP,
        TRIANGLE_FAN: HX_GL.TRIANGLE_FAN
    };

    HX.BlendFactor = {
        ZERO: HX_GL.ZERO,
        ONE: HX_GL.ONE,
        SOURCE_COLOR: HX_GL.SRC_COLOR,
        ONE_MINUS_SOURCE_COLOR: HX_GL.ONE_MINUS_SRC_COLOR,
        DESTINATION_COLOR: HX_GL.DST_COLOR,
        ONE_MINUS_DESTINATION_COLOR: HX_GL.ONE_MINUS_DST_COLOR,
        SOURCE_ALPHA: HX_GL.SRC_ALPHA,
        ONE_MINUS_SOURCE_ALPHA: HX_GL.ONE_MINUS_SRC_ALPHA,
        DESTINATION_ALPHA: HX_GL.DST_ALPHA,
        ONE_MINUS_DESTINATION_ALPHA: HX_GL.ONE_MINUS_DST_ALPHA,
        SOURCE_ALPHA_SATURATE: HX_GL.SRC_ALPHA_SATURATE,
        CONSTANT_ALPHA: HX_GL.CONSTANT_ALPHA,
        ONE_MINUS_CONSTANT_ALPHA: HX_GL.ONE_MINUS_CONSTANT_ALPHA
    };

    HX.BlendOperation = {
        ADD: HX_GL.FUNC_ADD,
        SUBTRACT: HX_GL.FUNC_SUBTRACT,
        REVERSE_SUBTRACT: HX_GL.FUNC_REVERSE_SUBTRACT
    };

    HX.COMPLETE_CLEAR_MASK = HX_GL.COLOR_BUFFER_BIT | HX_GL.DEPTH_BUFFER_BIT | HX_GL.STENCIL_BUFFER_BIT;
};