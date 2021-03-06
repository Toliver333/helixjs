import {SceneNode} from "../scene/SceneNode";
import {Signal} from "../core/Signal";
import {Bitfield} from "../core/Bitfield";
import {BoundingAABB} from "../scene/BoundingAABB";
import {MeshInstance} from "../mesh/MeshInstance";
import {Messenger} from "../core/Messenger";

/**
 * @classdesc
 * Entity represents a node in the Scene graph that can have {@linkcode Component} objects added to it, which can
 * define its behavior in a modular way.
 *
 * @property {BoundingVolume} worldBounds The bounding volume for this entity in world coordinates. This does not include
 * children.
 *
 * @property {Messenger} messenger The Messenger to which elements can listen for certain names Signals related to this Entity.
 *
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
 */
function Entity(components)
{
	SceneNode.call(this);

	this.messenger = new Messenger();

	// components
	this._componentHash = new Bitfield();
	this._components = [];
	this._requiresUpdates = false;
	this._onComponentsChange = new Signal();

	this._boundsInvalid = true;
	this._worldBoundsInvalid = true;
	this._worldBounds = this._createBoundingVolume();
	this._bounds = this._createBoundingVolume();

	if (components instanceof Array) {
		for (var i = 0; i < components.length; ++i) {
			this.addComponent(components[i]);
		}
	}
	else if (components) {
		this.addComponent(components);
	}

	this._SceneNode_invalidateWorldMatrix = SceneNode.prototype._invalidateWorldMatrix;
	this._SceneNode_setScene = SceneNode.prototype._setScene;
}

Entity.prototype = Object.create(SceneNode.prototype, {
	worldBounds: {
		get: function()
		{
			if (this._worldBoundsInvalid) {
				this._updateWorldBounds();
				this._worldBoundsInvalid = false;
			}

			return this._worldBounds;
		}
	},
	bounds: {
		get: function()
		{
			if (this._boundsInvalid) {
				this._updateBounds();
				this._boundsInvalid = false;
			}

			return this._bounds;
		}
	}
});

Entity.prototype.findMaterialByName = function(name)
{
	for (var i = 0, len = this._components.length; i < len; ++i) {
		var component = this._components[i];
		if (component instanceof MeshInstance && component.material.name === name)
			return component.material;
	}

	return SceneNode.prototype.findMaterialByName.call(this, name);
};

/**
 * Adds a single {@linkcode Component} object to the Entity.
 */
Entity.prototype.addComponent = function(component)
{
	if (component.entity)
		throw new Error("Component already added to an entity!");

	var oldHash = this._componentHash;
	this._componentHash = this._componentHash.clone();

	this._components.push(component);
	this._componentHash.setBit(component.COMPONENT_ID);

	this._requiresUpdates = this._requiresUpdates || (!!component.onUpdate);

	component.entity = this;
	if (component.enabled)
		component.onAdded();

	if (component.bounds)
		this.invalidateBounds();

	this._onComponentsChange.dispatch(this, oldHash);
};

/**
 * @ignore
 */
Entity.prototype._invalidateWorldMatrix = function()
{
	this._SceneNode_invalidateWorldMatrix();

	this._invalidateWorldBounds();

	if (this._scene)
		this._scene._partitioning.markEntityForUpdate(this);
};

/**
 * Marks the bounds as invalid, causing them to be recalculated when next queried.
 */
Entity.prototype.invalidateBounds = function ()
{
	this._boundsInvalid = true;
	this._invalidateWorldBounds();
};

/**
 * @ignore
 */
Entity.prototype._invalidateWorldBounds = function ()
{
	this._worldBoundsInvalid = true;
};

/**
 * @ignore
 */
Entity.prototype._updateWorldBounds = function ()
{
	this._worldBounds.transformFrom(this.bounds, this.worldMatrix);
};

/**
 * @ignore
 */
Entity.prototype._updateBounds = function ()
{
	var components = this._components;

	this._bounds.clear();

	for (var i = 0, len = components.length; i < len; ++i) {
		var bounds = components[i].bounds;

		if (bounds)
			this._bounds.growToIncludeBound(bounds);
	}
};


/**
 * Removes a single Component from the Entity.
 */
Entity.prototype.removeComponent = function(component)
{
	var requiresUpdates = false;
	var j = 0;
	var newComps = [];

	var oldHash = this._componentHash;
	this._componentHash = new Bitfield();

	// not splicing since we need to regenerate _requiresUpdates anyway by looping
	for (var i = 0, len = this._components.length; i < len; ++i) {
		var c = this._components[i];
		if (c !== component) {
			newComps[j++] = c;
			requiresUpdates = requiresUpdates || !!component.onUpdate;
			this._componentHash.setBit(c.COMPONENT_ID);
		}
	}

	this._requiresUpdates = requiresUpdates;

	this._onComponentsChange.dispatch(this, oldHash);

	this._components = newComps;
	component.entity = null;

	if (component.enabled)
		component.onRemoved();

	if (component.bounds)
		this.invalidateBounds();
};

/**
 * Adds multiple {@linkcode Component} objects to the Entity.
 * @param {Array} components An array of components to add.
 */
Entity.prototype.addComponents = function(components)
{
	for (var i = 0; i < components.length; ++i)
		this.addComponent(components[i]);
};

/**
 * Removes multiple {@linkcode Component} objects from the Entity.
 * @param {Array} components A list of components to remove.
 */
Entity.prototype.removeComponents = function(components)
{
	for (var i = 0; i < components.length; ++i) {
		this.removeComponent(components[i]);
	}
};

/**
 * @inheritDoc
 */
Entity.prototype.destroy = function()
{
	SceneNode.prototype.destroy.call(this);
	if (this._components)
		this.removeComponents(this._components);
};


/**
 * Returns whether or not the Entity has a component of a given type assigned to it.
 */
Entity.prototype.hasComponentType = function(type)
{
	return this._componentHash.contains(type.COMPONENT_ID);
};

/**
 * Returns the first Component of a given type
 */
Entity.prototype.getFirstComponentByType = function(type)
{
	for (var i = 0, len = this._components.length; i < len; ++i) {
		var comp = this._components[i];
		if (comp instanceof type)
			return comp;
	}
	return null;
};

/**
 * Returns an array of all Components with a given type.
 */
Entity.prototype.getComponentsByType = function(type)
{
	var collection = [];
	for (var i = 0, len = this._components.length; i < len; ++i) {
		var comp = this._components[i];
		if (comp instanceof type) collection.push(comp);
	}
	return collection;
};

/**
 * Return the Component with a given name.
 */
Entity.prototype.getComponentByName = function(name)
{
	for (var i = 0, len = this._components.length; i < len; ++i) {
		var comp = this._components[i];
		if (comp.name === name) return comp;
	}
	return null;
};

/**
 * @ignore
 */
Entity.prototype.update = function(dt)
{
	var components = this._components;
	for (var i = 0, len = components.length; i < len; ++i) {
		var component = components[i];
		if (component.enabled && component.onUpdate) {
			component.onUpdate(dt);
		}
	}
};

/**
 * @ignore
 */
Entity.prototype._setScene = function(scene)
{
	if (this._scene) {
		this._scene.entityEngine.unregisterEntity(this);
		this._scene.partitioning.unregisterEntity(this);
	}

	if (scene) {
		scene.entityEngine.registerEntity(this);
		scene.partitioning.registerEntity(this);
	}

	this._SceneNode_setScene(scene);
	this._invalidateWorldBounds();
};

/**
 * @ignore
 */
Entity.prototype._createBoundingVolume = function()
{
	return new BoundingAABB();
};

/**
 * @ignore
 */
Entity.prototype.acceptVisitor = function(visitor, isMainCollector)
{
	var components = this._components;
	for (var i = 0, len = components.length; i < len; ++i) {
		var component = components[i];
		if (component.acceptVisitor && component.enabled) {
			component.acceptVisitor(visitor, isMainCollector);
		}
	}
};

/**
 * @ignore
 */
Entity.prototype.copyFrom = function(src)
{
	SceneNode.prototype.copyFrom.call(this, src);

	for (var i = 0, len = src._components.length; i < len; ++i) {
		this.addComponent(src._components[i].clone());
	}
};

/**
 * @inheritDoc
 */
Entity.prototype.clone = function()
{
	var clone = new Entity();
	clone.copyFrom(this);
	return clone;
};

/**
 * @inheritDoc
 */
Entity.prototype._bindSkeleton = function(skeleton, pose, root)
{
	var bindShapeMatrix;

	for (var i = 0, len = this._components.length; i < len; ++i) {
		var comp = this._components[i];
		if (comp._bindSkeleton) {
			if (skeleton && !bindShapeMatrix && root !== this) {
				bindShapeMatrix = root.worldMatrix.clone();
				bindShapeMatrix.invertAffine();
				bindShapeMatrix.prependAffine(this.worldMatrix);
			}

			comp._bindSkeleton(skeleton, pose, bindShapeMatrix);
		}
	}

	SceneNode.prototype._bindSkeleton.call(this, skeleton, pose, root);
};

/**
 * @ignore
 */
Entity.prototype._updateChildAdded = function(child)
{
	SceneNode.prototype._updateChildAdded.call(this, child);
	this.invalidateBounds();
};


/**
 * @ignore
 */
Entity.prototype._assignMorphPose = function(value)
{
	SceneNode.prototype._assignMorphPose(value);

	for (var i = 0, len = this._components.length; i < len; ++i) {
		var comp = this._components[i];
		if (comp instanceof MeshInstance) {
			comp.morphPose = value;
		}
	}
};

export { Entity };