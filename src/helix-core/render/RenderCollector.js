import {ObjectPool} from "../core/ObjectPool";
import {Float4} from "../math/Float4";
import {Color} from "../core/Color";
import {SceneVisitor} from "../scene/SceneVisitor";
import {META} from "../Helix";
import {RenderItem} from "./RenderItem";
import {RenderPath} from "./RenderPath";
import {RenderSortFunctions} from "./RenderSortFunctions";

/**
 * @ignore
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
 */
function RenderCollector()
{
    SceneVisitor.call(this);

    this._renderItemPool = new ObjectPool(RenderItem);

    this._opaques = [];
    this._transparents = null;
    this._camera = null;
    this._cameraYAxis = new Float4();
    this._frustumPlanes = null;
    this._lights = null;
    this._ambientColor = new Color();
    this._shadowCasters = null;
    this._effects = null;
    this._needsNormalDepth = false;
    this._needsForwardPath = false;
    this._needsBackbuffer = false;
}

RenderCollector.prototype = Object.create(SceneVisitor.prototype, {
    ambientColor: {
        get: function() { return this._ambientColor; }
    },

    needsNormalDepth: {
        get: function() { return this._needsNormalDepth; }
    },

    needsForwardPath: {
        get: function() { return this._needsForwardPath; }
    },

    needsBackbuffer: {
        get: function() { return this._needsBackbuffer; }
    }
});

RenderCollector.prototype.getOpaqueRenderList = function(path) { return this._opaques[path]; };
RenderCollector.prototype.getTransparentRenderList = function() { return this._transparents; };
RenderCollector.prototype.getLights = function() { return this._lights; };
RenderCollector.prototype.getShadowCasters = function() { return this._shadowCasters; };
RenderCollector.prototype.getEffects = function() { return this._effects; };

RenderCollector.prototype.collect = function(camera, scene)
{
    this._camera = camera;
    camera.worldMatrix.getColumn(1, this._cameraYAxis);
    this._frustumPlanes = camera.frustum._planes;
    this._reset();

    scene.acceptVisitor(this);

    for (var i = 0; i < RenderPath.NUM_PATHS; ++i)
        this._opaques[i].sort(RenderSortFunctions.sortOpaques);

    this._transparents.sort(RenderSortFunctions.sortTransparents);

    this._lights.sort(RenderSortFunctions.sortLights);

    var effects = this._camera._effects;
    // add camera effects at the end
    if (effects) {
        var len = effects.length;

        for (var i = 0; i < len; ++i) {
            var effect = effects[i];
            this._needsNormalDepth = this._needsNormalDepth || effect._needsNormalDepth;
            this._effects.push(effect);
        }
    }

    // allows optimizing the render loop, skipping the entire forward path (which rerenders the light accumulation)
    // if no forward is needed
    this._needsForwardPath =
        this._transparents.length > 0 ||
        this._opaques[RenderPath.FORWARD_FIXED].length > 0 ||
        this._opaques[RenderPath.FORWARD_DYNAMIC].length > 0;
};

RenderCollector.prototype.qualifies = function(object)
{
    return object.visible && object.worldBounds.intersectsConvexSolid(this._frustumPlanes, 6);
};

RenderCollector.prototype.visitScene = function (scene)
{
    var skybox = scene._skybox;
    if (skybox)
        this.visitModelInstance(skybox._modelInstance, scene._rootNode.worldMatrix, scene._rootNode.worldBounds);
};

RenderCollector.prototype.visitEffects = function(effects)
{
    // camera does not pass effects
    //if (ownerNode === this._camera) return;
    var len = effects.length;

    for (var i = 0; i < len; ++i) {
        this._effects.push(effects[i]);
    }
};

RenderCollector.prototype.visitModelInstance = function (modelInstance, worldMatrix, worldBounds)
{
    var numMeshes = modelInstance.numMeshInstances;
    var cameraYAxis = this._cameraYAxis;
    var cameraY_X = cameraYAxis.x, cameraY_Y = cameraYAxis.y, cameraY_Z = cameraYAxis.z;
    var skeleton = modelInstance.skeleton;
    var skeletonMatrices = modelInstance.skeletonMatrices;
    var renderPool = this._renderItemPool;
    var camera = this._camera;
    var opaqueLists = this._opaques;
    var transparentList = this._transparents;

    for (var meshIndex = 0; meshIndex < numMeshes; ++meshIndex) {
        var meshInstance = modelInstance.getMeshInstance(meshIndex);
        if (!meshInstance.visible) continue;

        var material = meshInstance.material;

        var path = material.renderPath;

        // only required for the default lighting model (if not unlit)
        this._needsNormalDepth = this._needsNormalDepth || material._needsNormalDepth;
        this._needsBackbuffer = this._needsBackbuffer || material._needsBackbuffer;

        var renderItem = renderPool.getItem();

        renderItem.material = material;
        renderItem.meshInstance = meshInstance;
        renderItem.skeleton = skeleton;
        renderItem.skeletonMatrices = skeletonMatrices;
        // distance along Z axis:
        var center = worldBounds._center;
        renderItem.renderOrderHint = center.x * cameraY_X + center.y * cameraY_Y + center.z * cameraY_Z;
        renderItem.worldMatrix = worldMatrix;
        renderItem.camera = camera;
        renderItem.worldBounds = worldBounds;

        var bucket = (material.blendState || material._needsBackbuffer)? transparentList : opaqueLists[path];
        bucket.push(renderItem);
    }
};

RenderCollector.prototype.visitAmbientLight = function(light)
{
    var color = light._scaledIrradiance;
    this._ambientColor.r += color.r;
    this._ambientColor.g += color.g;
    this._ambientColor.b += color.b;
};

RenderCollector.prototype.visitLight = function(light)
{
    this._lights.push(light);
    if (light._castShadows) this._shadowCasters.push(light._shadowMapRenderer);
};

RenderCollector.prototype._reset = function()
{
    this._renderItemPool.reset();

    for (var i = 0; i < RenderPath.NUM_PATHS; ++i)
        this._opaques[i] = [];

    this._transparents = [];

    this._lights = [];
    this._shadowCasters = [];
    this._effects = [];
    this._needsNormalDepth = META.OPTIONS.ambientOcclusion;
    this._ambientColor.set(0, 0, 0, 1);
};

export { RenderCollector };