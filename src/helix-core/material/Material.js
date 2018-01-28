import {CullMode, ElementType, META, BlendFactor, capabilities, Comparison} from "../Helix";
import {Signal} from "../core/Signal";
import {MaterialPass} from "./MaterialPass";
import {UnlitPass} from "./passes/UnlitPass";
import {DirectionalShadowPass} from "./passes/DirectionalShadowPass";
import {BlendState} from "../render/BlendState";
import {ForwardLitBasePass} from "./passes/ForwardLitBasePass";
import {ForwardLitDirPass} from "./passes/ForwardLitDirPass";
import {ForwardLitPointPass} from "./passes/ForwardLitPointPass";
import {ForwardLitSpotPass} from "./passes/ForwardLitSpotPass";
import {ForwardLitProbePass} from "./passes/ForwardLitProbePass";
import {ForwardFixedLitPass} from "./passes/ForwardFixedLitPass";
import {GBufferAlbedoPass} from "./passes/GBufferAlbedoPass";
import {GBufferNormalDepthPass} from "./passes/GBufferNormalDepthPass";
import {GBufferSpecularPass} from "./passes/GBufferSpecularPass";
import {GBufferFullPass} from "./passes/GBufferFullPass";
import {ApplyGBufferPass} from "./passes/ApplyGBufferPass";
import {RenderPath} from "../render/RenderPath";
import {SpotShadowPass} from "./passes/SpotShadowPass";
import {PointShadowPass} from "./passes/PointShadowPass";

/**
 * @ignore
 */
var MATERIAL_ID_COUNTER = 0;

/**
 * @classdesc
 * Material is a base class for materials. It splits up into two components: the geometry stage, and the lighting model.
 *
 * @constructor
 *
 * @param geometryVertexShader The vertex code for the geometry stage.
 * @param geometryFragmentShader The fragment code for the geometry stage.
 * @param [lightingModel] The {@linkcode LightingModel} to use. Defaults to what was passed in (if anything) with {@linkcode InitOptions#defaultLightingModel}.
 *
 * @author derschmale <http://www.derschmale.com>
 */
function Material(geometryVertexShader, geometryFragmentShader, lightingModel)
{
    // dispatched when the material's code changed and a link with a mesh may have become invalid
    this.onChange = new Signal();

    this._elementType = ElementType.TRIANGLES;
    this._cullMode = CullMode.BACK;
    this._writeDepth = true;
    this._writeColor = true;
    this._passes = new Array(Material.NUM_PASS_TYPES);
    this._renderOrderHint = ++MATERIAL_ID_COUNTER;
    this._renderPath = null;
    // forced render order by user:
    this._renderOrder = 0;
    this._textures = {};
    this._uniforms = {};
    this._fixedLights = null;
    this._useMorphing = false;
    this._useNormalMorphing = false;
    this._useSkinning = false;

    this._name = null;
    this._geometryVertexShader = geometryVertexShader;
    this._geometryFragmentShader = geometryFragmentShader;
    this._lightingModel = lightingModel || META.OPTIONS.defaultLightingModel;

    this._initialized = false;
    this._blendState = null;
    this._additiveBlendState = BlendState.ADD;    // additive blend state is used for dynamic lighting
    this._needsNormalDepth = false;
    this._needsBackbuffer = false;
}

Material.ID_COUNTER = 0;

Material.prototype =
{
    /**
     * @ignore
     */
    init: function()
    {
        if (this._initialized || !this._geometryVertexShader || !this._geometryFragmentShader)
            return;

        this._needsNormalDepth = false;
        this._needsBackbuffer = false;

        var vertex = this._geometryVertexShader;
        var fragment = this._geometryFragmentShader;

        if (this._useSkinning)
            vertex = "#define HX_USE_SKINNING\n" + vertex;

        if (this._useMorphing) {
            vertex = "#define HX_USE_MORPHING\n" + vertex;

            if (this._useNormalMorphing)
                vertex = "#define HX_USE_NORMAL_MORPHING\n" + vertex;
        }

        if (!this._lightingModel) {
            this._renderPath = RenderPath.FORWARD_FIXED;
            this.setPass(MaterialPass.BASE_PASS, new UnlitPass(vertex, fragment));
        }
        else if (this._fixedLights) {
            this._renderPath = RenderPath.FORWARD_FIXED;
            this.setPass(MaterialPass.BASE_PASS, new ForwardFixedLitPass(vertex, fragment, this._lightingModel, this._fixedLights));
        }
        else if (this._lightingModel !== META.OPTIONS.deferredLightingModel || this._blendState) {
            this._renderPath = RenderPath.FORWARD_DYNAMIC;

            this.setPass(MaterialPass.BASE_PASS, new ForwardLitBasePass(vertex, fragment));

            this.setPass(MaterialPass.DIR_LIGHT_PASS, new ForwardLitDirPass(vertex, fragment, this._lightingModel, false));
            this.setPass(MaterialPass.DIR_LIGHT_SHADOW_PASS, new ForwardLitDirPass(vertex, fragment, this._lightingModel, true));
            this.setPass(MaterialPass.POINT_LIGHT_PASS, new ForwardLitPointPass(vertex, fragment, this._lightingModel, false));
            this.setPass(MaterialPass.POINT_LIGHT_SHADOW_PASS, new ForwardLitPointPass(vertex, fragment, this._lightingModel, true));
            this.setPass(MaterialPass.SPOT_LIGHT_PASS, new ForwardLitSpotPass(vertex, fragment, this._lightingModel, false));
            this.setPass(MaterialPass.SPOT_LIGHT_SHADOW_PASS, new ForwardLitSpotPass(vertex, fragment, this._lightingModel, true));
            this.setPass(MaterialPass.LIGHT_PROBE_PASS, new ForwardLitProbePass(vertex, fragment, this._lightingModel));
        }
        else {
            this._renderPath = RenderPath.DEFERRED;
            this.setPass(MaterialPass.BASE_PASS, new ApplyGBufferPass(vertex, fragment));

            // only deferred needs these passes:
            if (!capabilities.GBUFFER_MRT) {
                this.setPass(MaterialPass.GBUFFER_ALBEDO_PASS, new GBufferAlbedoPass(vertex, fragment));
                this.setPass(MaterialPass.GBUFFER_SPECULAR_PASS, new GBufferSpecularPass(vertex, fragment));
            }
        }

        this.setPass(MaterialPass.DIR_LIGHT_SHADOW_MAP_PASS, new DirectionalShadowPass(vertex, fragment));
        this.setPass(MaterialPass.POINT_LIGHT_SHADOW_MAP_PASS, new PointShadowPass(vertex, fragment));
        this.setPass(MaterialPass.SPOT_LIGHT_SHADOW_MAP_PASS, new SpotShadowPass(vertex, fragment));

        // always may need these passes for AO
        if (capabilities.GBUFFER_MRT)
            this.setPass(MaterialPass.GBUFFER_PASS, new GBufferFullPass(vertex, fragment));

        // may need this even with MRT, if no deferred materials are selected
        this.setPass(MaterialPass.GBUFFER_NORMAL_DEPTH_PASS, new GBufferNormalDepthPass(vertex, fragment));

        this._initialized = true;
    },

    /**
     * Whether or not the Material was initialized and ready to use.
     * @ignore
     */
    get initialized() { return this._initialized; },

    /**
     * The blend state used for this material.
     *
     * @see {BlendState}
     */
    get blendState()
    {
        return this._blendState;
    },

    set blendState(value)
    {
        this._blendState = value;
        if (value) {
            this._additiveBlendState = value.clone();
            this._additiveBlendState.dstFactor = BlendFactor.ONE;
        }
        else {
            this._additiveBlendState = BlendState.ADD;
        }

        // blend state can require different render path, so shaders need to adapt
        this._invalidate();
    },

    /**
     * Allows setting a specific set of lights to this material, avoiding having to figure out lighting dynamically.
     * This will cause all lighting to happen in a single pass, which is generally *much* faster than any other option.
     */
    get fixedLights()
    {
        return this._fixedLights;
    },

    set fixedLights(value)
    {
        this._fixedLights = value;
        this._invalidate();
    },

    /**
     * The name of the material.
     */
    get name()
    {
        return this._name;
    },

    set name(value)
    {
        this._name = value;
    },

    /**
     * The {@options LightingModel} used to light this material. If this is set to {@linkcode InitOptions#deferredLightingModel}
     * and no blendState is assigned, this material will be rendered using the deferred render path.
     */
    get lightingModel()
    {
        return this._lightingModel;
    },

    set lightingModel(value)
    {
        this._lightingModel = value;
        this._invalidate();
    },

    /**
     * A Number that can force the order in which the material is rendered. Higher values will be rendered later!
     */
    get renderOrder()
    {
        return this._renderOrder;
    },

    set renderOrder(value)
    {
        this._renderOrder = value;
    },

    /**
     * An {@linkcode ElementType} to describe the type of elements to render.
     */
    get elementType()
    {
        return this._elementType;
    },

    set elementType(value)
    {
        this._elementType = value;
        for (var i = 0; i < MaterialPass.NUM_PASS_TYPES; ++i) {
            if (this._passes[i])
                this._passes[i].elementType = value;
        }
    },

    /**
     * Defines whether or not this material should write depth information.
     */
    get writeDepth()
    {
        return this._writeDepth;
    },

    set writeDepth(value)
    {
        this._writeDepth = value;

        if (!value && this._passes[MaterialPass.GBUFFER_NORMAL_DEPTH_PASS]) {
            this._passes[MaterialPass.GBUFFER_NORMAL_DEPTH_PASS] = null;
        }
        else if (value && !this._passes[MaterialPass.GBUFFER_NORMAL_DEPTH_PASS])
            this._invalidate();

        for (var i = 0; i < MaterialPass.NUM_PASS_TYPES; ++i) {
            if (this._passes[i])
                this._passes[i].writeDepth = value;
        }
    },

    /**
     * Defines whether or not this material should write color information. This should only be used for some special
     * cases.
     */
    get writeColor()
    {
        return this._writeColor;
    },

    set writeColor(value)
    {
        this._writeColor = value;

        for (var i = 0; i < MaterialPass.NUM_PASS_TYPES; ++i) {
            if (this._passes[i])
                this._passes[i].writeColor = value;
        }
    },

    /**
     * Defines how back-face culling is applied. One of {@linkcode CullMode}.
     */
    get cullMode()
    {
        return this._cullMode;
    },

    set cullMode(value)
    {
        this._cullMode = value;
        for (var i = 0; i < MaterialPass.NUM_PASS_TYPES; ++i) {
            if (i !== MaterialPass.DIR_LIGHT_SHADOW_MAP_PASS  &&
                i !== MaterialPass.SPOT_LIGHT_SHADOW_MAP_PASS &&
                i !== MaterialPass.POINT_LIGHT_SHADOW_MAP_PASS &&
                this._passes[i])
                this._passes[i].cullMode = value;
        }
    },

    /**
     * @ignore
     */
    get renderPath()
    {
        // make sure that if we request the path, it's figured out
        if (!this._initialized) this.init();
        return this._renderPath;
    },

    /**
     * @ignore
     */
    getPass: function (type)
    {
        if (!this._initialized) this.init();
        return this._passes[type];
    },

    /**
     * @ignore
     */
    setPass: function (type, pass)
    {
        this._passes[type] = pass;

        if (pass) {
            if(type === MaterialPass.DIR_LIGHT_SHADOW_MAP_PASS)
                pass.cullMode = META.OPTIONS.directionalShadowFilter.cullMode;
            else if(type === MaterialPass.SPOT_LIGHT_SHADOW_MAP_PASS)
                pass.cullMode = META.OPTIONS.spotShadowFilter.cullMode;
            else if(type === MaterialPass.POINT_LIGHT_SHADOW_MAP_PASS)
                pass.cullMode = META.OPTIONS.pointShadowFilter.cullMode;
            else
                pass.cullMode = this._cullMode;

            pass.elementType = this._elementType;
            pass.writeDepth = this._writeDepth;
            pass.writeColor = this._writeColor;

            // one of the lit ones
            if (type >= MaterialPass.DIR_LIGHT_PASS  && type <= MaterialPass.LIGHT_PROBE_PASS)
                pass.blendState = this._additiveBlendState;

            if (type === MaterialPass.BASE_PASS)
                pass.blendState = this._blendState;

            if (pass.getTextureSlot("hx_gbufferNormalDepth"))
                this._needsNormalDepth = true;

            if (pass.getTextureSlot("hx_backbuffer"))
                this._needsBackbuffer = true;

            for (var slotName in this._textures) {
                if (this._textures.hasOwnProperty(slotName)) {
                    var texture = this._textures[slotName];
                    if (texture instanceof Array)
                        pass.setTextureArray(slotName, texture);
                    else
                        pass.setTexture(slotName, texture);
                }
            }

            for (var uniformName in this._uniforms) {
                if (this._uniforms.hasOwnProperty(uniformName)) {
                    if (uniformName.charAt(uniformName.length - 1) === ']')
                        pass.setUniformArray(uniformName.substr(0, uniformName.length - 3), this._uniforms[uniformName]);
                    else
                        pass.setUniform(uniformName, this._uniforms[uniformName]);
                }
            }
        }

        this.onChange.dispatch();
    },

    /**
     * @ignore
     */
    hasPass: function (type)
    {
        if (!this._initialized) this.init();
        return !!this._passes[type];
    },

    /**
     * Assigns a texture to the shaders with a given name.
     * @param {string} slotName The name of the texture as it appears in the shader code.
     * @param {Texture2D} texture The texture to assign
     */
    setTexture: function(slotName, texture)
    {
        if (texture)
            this._textures[slotName] = texture;
        else
            delete this._textures[slotName];

        for (var i = 0; i < MaterialPass.NUM_PASS_TYPES; ++i)
            if (this._passes[i]) this._passes[i].setTexture(slotName, texture);
    },

    /**
     * Assigns a texture array to the shaders with a given name.
     * @param {string} slotName The name of the texture array as it appears in the shader code.
     * @param {Array} texture An Array of {@linkcode Texture2D} objects
     */
    setTextureArray: function(slotName, textures)
    {
        if (textures)
            this._textures[slotName] = textures;
        else
            delete this._textures[slotName];

        for (var i = 0; i < MaterialPass.NUM_PASS_TYPES; ++i)
            if (this._passes[i]) this._passes[i].setTextureArray(slotName, textures);
    },

    /**
     * Sets a uniform value to the shaders.
     * @param name The uniform name as it appears in the shader code.
     * @param value The uniform value. For vectors, this can be a {@linkcode Float2}, {@linkcode Float4}, or an Array
     * @param [overwrite] If the value was already set, ignore the new value. Defaults to true.
     */
    setUniform: function(name, value, overwrite)
    {
        if (overwrite === undefined) overwrite = true;

        if (!overwrite && this._uniforms.hasOwnProperty(name))
            return;

        this._uniforms[name] = value;

        for (var i = 0; i < MaterialPass.NUM_PASS_TYPES; ++i) {
            if (this._passes[i])
                this._passes[i].setUniform(name, value);
        }
    },

    /**
     * Sets the value for a uniform array to the shaders.
     * @param name The uniform array name as it appears in the shader code.
     * @param value An array of values.
     * @param overwrite (Optional) If the value was already set, ignore the new value.
     */
    setUniformArray: function(name, value, overwrite)
    {
        if (overwrite === undefined) overwrite = true;

        if (!overwrite && this._uniforms.hasOwnProperty(name + '[0]'))
            return;

        this._uniforms[name + '[0]'] = value;

        for (var i = 0; i < MaterialPass.NUM_PASS_TYPES; ++i) {
            if (this._passes[i])
                this._passes[i].setUniformArray(name, value);
        }
    },

    /**
     * @ignore
     */
    _setUseSkinning: function(value)
    {
        if (this._useSkinning !== value)
            this._invalidate();

        this._useSkinning = value;
    },

    /**
     * @ignore
     */
    _setUseMorphing: function(positions, normals)
    {
        if (this._useSkinning !== positions || this._useNormalMorphing !== normals)
            this._invalidate();

        this._useMorphing = positions;
        this._useNormalMorphing = normals;
    },

    /**
     * Called by subclasses when their shaders are invalidated
     * @ignore
     */
    _invalidate: function()
    {
        this._initialized = false;
        this._passes = new Array(Material.NUM_PASS_TYPES);
        this.onChange.dispatch();
    },

    /**
     * @ignore
     */
    toString: function()
    {
        return "[Material(name=" + this._name + ")]";
    }
};

export { Material };