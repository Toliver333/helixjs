import {BoundingAABB} from "../scene/BoundingAABB";
import {GL} from "../core/GL";
import {VertexLayout} from "./VertexLayout";
import {MaterialPass} from "../material/MaterialPass";
import {Component} from "../entity/Component";
import {SkeletonPose} from "../animation/skeleton/SkeletonPose";
import {Matrix4x4} from "../math/Matrix4x4";

var nameCounter = 0;

/**
 * @classdesc
 * MeshInstance allows bundling a {@linkcode Mesh} with a {@linkcode Material} for rendering, allowing both the geometry
 * and materials to be shared regardless of the combination of both.
 *
 * @property {boolean} castShadows Defines whether or not this MeshInstance should cast shadows.
 * @property mesh The {@linkcode Mesh} providing the geometry for this instance.
 * @property material The {@linkcode Material} to use to render the given Mesh.
 * @property {Mesh} mesh The {@linkcode Mesh} providing the geometry for this instance.
 * @property {Material} material The {@linkcode Material} to use to render the given Mesh.
 * @property {Skeleton} skeleton The {@linkcode Skeleton} that deforms the vertex positions.
 * @property {Array|Texture2D} skeletonMatrices The skeleton matrices of the current skeleton pose.
 * @property {MorphPose} morphPose The {@linkcode MorphPose} defining the weights for each morph target.
 * @property {number} lodRangeStart The minimum distance to render this MeshInstance. Can be used with other
 * MeshInstances to enable LOD support, or singly for pop-in or impostors.
 * @property {number} lodRangeEnd The maximum distance to render this MeshInstance. Can be used with other
 * MeshInstances to enable LOD support, or singly for pop-in or impostors.
 *
 * @param mesh The {@linkcode Mesh} providing the geometry for this instance.
 * @param material The {@linkcode Material} to use to render the given Mesh.
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
 */
function MeshInstance(mesh, material)
{
	Component.call(this);

	this.name = "hx_meshinstance_" + (nameCounter++);
	this.castShadows = true;
	this.lodRangeStart = Number.NEGATIVE_INFINITY;
	this.lodRangeEnd = Number.POSITIVE_INFINITY;
	this._lodVisible = true;
	this.skeletonPose = null;
	this.bindShapeMatrix = null;
	this.bindShapeMatrixInverse = null;
	this._bounds = new BoundingAABB();
	this._morphPositions = null;
	this._morphNormals = null;
	this._morphWeights = null;
	this._meshMaterialLinkInvalid = true;
	this._vertexLayouts = null;
	this._morphPose = null;
	this._skeleton = null;
	this.mesh = mesh;
	this.material = material;

}

Component.create(MeshInstance, {
	skeleton: {
		get: function()
		{
			return this._skeleton;
		},

		set: function(value)
		{
			var pose = new SkeletonPose();
			pose.copyBindPose(value);
			this._bindSkeleton(value, pose, null);
		}
	},

	/**
	 * The global matrices defining the skeleton pose. This could be a Float32Array with flat matrix data, or a texture
	 * containing the data (depending on the capabilities). This is usually set by {@linkcode SkeletonAnimation}, and
	 * should not be handled manually.
	 *
	 * @ignore
	 */
	skeletonMatrices: {
		get: function()
		{
			return this.skeletonPose? this.skeletonPose.getBindMatrices(this._skeleton) : null;
		}
	},

	morphPose: {
		get: function() {
			return this._morphPose;
		},

		set: function(value) {
			var oldPose = this._morphPose;
			if (oldPose)
				oldPose.onChange.unbind(this._onMorphChanged);

			this._morphPose = value;

			if (this._morphPose) {
				this._morphPose.onChange.bind(this._onMorphChanged, this);
				this._onMorphChanged();
			}
			else if (oldPose)
				this._clearMorph();
		}
	},

	mesh: {
		get: function()
		{
			return this._mesh;
		},

		set: function(mesh)
		{
			if (this._mesh === mesh) return;

			if (this._mesh) {
				this._mesh.onLayoutChanged.unbind(this._onMaterialOrMeshChange);
				this._mesh.onBoundsChanged.unbind(this.invalidateBounds);
				this._mesh.onMorphDataCreated.unbind(this._initMorphData);
			}

			this._mesh = mesh;

			mesh.onLayoutChanged.bind(this._onMaterialOrMeshChange, this);
			mesh.onBoundsChanged.bind(this.invalidateBounds, this);
			mesh.onMorphDataCreated.bind(this._initMorphData, this);

			this._initMorphData();

			this._meshMaterialLinkInvalid = true;

			this.invalidateBounds();
		}
	},

	/**
	 * The {@linkcode Material} used to render the Mesh.
	 */
	material: {
		get: function()
		{
			return this._material;
		},

		set: function(value)
		{
			if (this._material)
				this._material.onChange.unbind(this._onMaterialOrMeshChange);

			this._material = value;

			if (this._material) {
				this._material.onChange.bind(this._onMaterialOrMeshChange, this);

				// TODO: Should this be set explicitly on the material by the user?
				this._material._setUseSkinning(!!this._skeleton);
				this._material._setUseMorphing(
					this._mesh.hasMorphData,
					this._mesh.hasMorphNormals
				);
			}

			this._meshMaterialLinkInvalid = true;
		}
	}
});

/**
 * Sets state for this mesh/material combination.
 * @param passType
 * @ignore
 */
MeshInstance.prototype.updateRenderState = function(passType)
{
	if (this._meshMaterialLinkInvalid)
		this._linkMeshWithMaterial();

	var vertexBuffers = this._mesh._vertexBuffers;
	this._mesh._indexBuffer.bind();

	var layout = this._vertexLayouts[passType];
	var morphPosAttributes = layout.morphPositionAttributes;
	var morphNormalAttributes = layout.morphNormalAttributes;
	var attribute;
	var gl = GL.gl;

	var len = morphPosAttributes.length;

	for (var i = 0; i < len; ++i) {
		attribute = morphPosAttributes[i];
		var buffer = this._morphPositions[i] || this._mesh._defaultMorphTarget;
		buffer.bind();

		gl.vertexAttribPointer(attribute.index, attribute.numComponents, gl.FLOAT, attribute.normalized, attribute.stride, attribute.offset);
	}

	if (this._morphNormals) {
		len = morphNormalAttributes.length;
		for (i = 0; i < len; ++i) {
			attribute = morphNormalAttributes[i];
			buffer = this._morphNormals[i] || this._mesh._defaultMorphTarget;
			buffer.bind();

			gl.vertexAttribPointer(attribute.index, attribute.numComponents, gl.FLOAT, false, attribute.stride, attribute.offset);
		}
	}

	var attributes = layout.attributes;
	len = layout._numAttributes;

	GL.enableAttributes(layout._numAttributes);

	for (i = 0; i < len; ++i) {
		attribute = attributes[i];

		if (attribute) {
			// external = in case of morph targets etc
			if (!attribute.external) {
				vertexBuffers[attribute.streamIndex].bind();
				gl.vertexAttribPointer(i, attribute.numComponents, gl.FLOAT, false, attribute.stride, attribute.offset);
			}
		}
		else {
			GL.gl.disableVertexAttribArray(i);
			// there seem to be some bugs in ANGLE with disabling vertex attribute arrays, so bind a dummy instead
			// vertexBuffers[0].bind();
			// gl.vertexAttribPointer(i, 1, gl.FLOAT, false, 4, 0);
		}
	}
};

/**
 * @ignore
 * @private
 */
MeshInstance.prototype._initVertexLayouts = function()
{
	this._vertexLayouts = new Array(MaterialPass.NUM_PASS_TYPES);
	for (var type = 0; type < MaterialPass.NUM_PASS_TYPES; ++type) {
		var pass = this._material.getPass(type);
		if (pass)
			this._vertexLayouts[type] = new VertexLayout(this._mesh, pass);
	}
};

/**
 * @ignore
 * @private
 */
MeshInstance.prototype._linkMeshWithMaterial = function()
{
	this._initVertexLayouts();

	this._meshMaterialLinkInvalid = false;
};

/**
 * @ignore
 * @private
 */
MeshInstance.prototype._onMaterialOrMeshChange = function()
{
	this._meshMaterialLinkInvalid = true;
};


/**
 * @ignore
 */
MeshInstance.prototype.toString = function()
{
	return "[MeshInstance(mesh=" + this._mesh.name + ")]";
};

/**
 * @ignore
 */
MeshInstance.prototype.acceptVisitor = function(visitor)
{
	visitor.visitMeshInstance(this, this.entity);
};

/**
 * @ignore
 * @private
 */
MeshInstance.prototype._onMorphChanged = function()
{
	for (var t = 0; t < 8; ++t) {
		var name = this._morphPose.getMorphTargetName(t);
		var target = null;

		if (name)
			target = this._mesh.getMorphTarget(name);

		if (target) {
			var weight = this._morphPose.getWeight(name);

			var pos = target.positionBuffer;
			var normal = target.hasNormals? target.normalBuffer : null;

			this._setMorphTarget(t, pos, normal, weight);
		}
		else {
			this._setMorphTarget(t, null, null, 0.0);
		}
	}
};

/**
 * @ignore
 * @private
 */
MeshInstance.prototype._clearMorph = function()
{
	for (var t = 0; t < 8; ++t) {
		this._setMorphTarget(t, null, null, 0);
	}
};

/**
 * @ignore
 */
MeshInstance.prototype._setMorphTarget = function(targetIndex, positionBuffer, normalBuffer, weight)
{
	if (targetIndex >= this._morphWeights.length) return;

	this._morphPositions[targetIndex] = positionBuffer;
	if (normalBuffer && this._morphNormals)
		this._morphNormals[targetIndex] = normalBuffer;

	this._morphWeights[targetIndex] = positionBuffer? weight : 0.0;
};

MeshInstance.prototype._updateBounds = function()
{
	this._bounds = this._mesh.bounds;
};

MeshInstance.prototype._initMorphData = function()
{
	this._morphPositions = null;
	this._morphNormals = null;
	this._morphWeights = null;

	if (!this._mesh.hasMorphData) return;

	this._morphPositions = [];

	var numMorphs = 8;

	if (this._mesh.hasMorphNormals) {
		this._morphNormals = [];
		numMorphs = 4;
	}

	this._morphWeights = new Float32Array(numMorphs);

	for (var i = 0; i < numMorphs; ++i) {
		this._morphWeights[i] = 0;
	}

	if (this._material) {
		this._material._setUseMorphing(
			this._mesh.hasMorphData,
			this._mesh.hasMorphNormals
		);
	}
};

MeshInstance.prototype.clone = function()
{
	var clone = new MeshInstance(this._mesh, this._material);
	clone.castShadows = this.castShadows;
	if (this.skeleton)
		clone.skeleton = this.skeleton;
	if (this.skeletonPose)
		clone.skeletonPose = this.skeletonPose.clone();
	return clone;
};


/**
 * @ignore
 */
MeshInstance.prototype._bindSkeleton = function(skeleton, pose, bindShapeMatrix)
{
	this._skeleton = skeleton;
	this.skeletonPose = pose;
	this.bindShapeMatrix = bindShapeMatrix;
	this.bindShapeMatrixInverse = null;

	if (bindShapeMatrix) {
		this.bindShapeMatrixInverse = new Matrix4x4();
		this.bindShapeMatrixInverse.inverseAffineOf(bindShapeMatrix);
	}

	if (this._material)
		this._material._setUseSkinning(!!this._skeleton);
};

export { MeshInstance };