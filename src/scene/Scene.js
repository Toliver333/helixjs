// basic version is non-hierarchical, for use with lights etc
/**
 *
 * @constructor
 */
HX.SceneNode = function()
{
    HX.Transform.call(this);
    this._name = null;
    this._worldTransformMatrix = new HX.Matrix4x4();
    this._worldBoundsInvalid = true;
    this._matrixInvalid = true;
    this._worldMatrixInvalid = true;
    this._parent = null;
    this._scene = null;
    this._worldBounds = this._createBoundingVolume();
    this._debugBounds = null;

    // used to determine sorting index for the render loop
    // models can use this to store distance to camera for more efficient rendering, lights use this to sort based on
    // intersection with near plane, etc
    this._renderOrderHint = 0.0;
};

HX.SceneNode.prototype = Object.create(HX.Transform.prototype);

Object.defineProperties(HX.SceneNode.prototype, {
    name: {
        get: function()
        {
            return this._name;
        },
        set: function(value)
        {
            this._name = value;
        }
    },
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

    worldMatrix: {
        get: function()
        {
            if (this._worldMatrixInvalid)
                this._updateWorldTransformationMatrix();

            return this._worldTransformMatrix;
        }
    },

    showDebugBounds: {
        get: function ()
        {
            return this._debugBounds !== null
        },
        set: function(value)
        {
            if (this.showDebugBounds === value) return;

            if (value) {
                this._debugBounds = this._worldBounds.getDebugModelInstance();
                this._updateDebugBounds();
            }
            else
                this._debugBounds = null;
        }
    }
});

HX.SceneNode.prototype._applyMatrix = function()
{
    HX.Transform.prototype._applyMatrix.call(this);
    this._invalidateWorldTransformationMatrix();
};

HX.SceneNode.prototype.findMaterialByName = function(name)
{
    var visitor = new HX.MaterialQueryVisitor(name);
    this.acceptVisitor(visitor);
    return visitor.foundMaterial;
};

HX.SceneNode.prototype.findNodeByName = function(name)
{
    return this._name === name? this : null;
};

HX.SceneNode.prototype._setScene = function(scene)
{
    this._scene = scene;
};

HX.SceneNode.prototype.acceptVisitor = function(visitor)
{
    if (this._debugBounds)
        this._debugBounds.acceptVisitor(visitor);
};

HX.SceneNode.prototype._invalidateTransformationMatrix = function ()
{
    HX.Transform.prototype._invalidateTransformationMatrix.call(this);
    this._invalidateWorldTransformationMatrix();
};

HX.SceneNode.prototype._invalidateWorldTransformationMatrix = function ()
{
    this._worldMatrixInvalid = true;
    this._invalidateWorldBounds();
};

HX.SceneNode.prototype._invalidateWorldBounds = function ()
{
    if (this._worldBoundsInvalid) return;

    this._worldBoundsInvalid = true;

    if (this._parent)
        this._parent._invalidateWorldBounds();
};

HX.SceneNode.prototype._updateWorldBounds = function ()
{
    if (this._debugBounds)
        this._updateDebugBounds();
};

HX.SceneNode.prototype._updateDebugBounds = function()
{
    var matrix = this._debugBounds.transformationMatrix;
    var bounds = this._worldBounds;

    matrix.scaleMatrix(bounds._halfExtentX * 2.0, bounds._halfExtentY * 2.0, bounds._halfExtentZ * 2.0);
    matrix.appendTranslation(bounds._centerX, bounds._centerY, bounds._centerZ);
    this._debugBounds.transformationMatrix = matrix;
};

HX.SceneNode.prototype._updateTransformationMatrix = function()
{
    HX.Transform.prototype._updateTransformationMatrix.call(this);
    this._invalidateWorldBounds();
};

HX.SceneNode.prototype._updateWorldTransformationMatrix = function()
{
    if (this._parent)
        this._worldTransformMatrix.product(this._parent.worldMatrix, this.transformationMatrix);
    else
        this._worldTransformMatrix.copyFrom(this.transformationMatrix);

    this._worldMatrixInvalid = false;
};

// override for better matches
HX.SceneNode.prototype._createBoundingVolume = function()
{
    return new HX.BoundingAABB();
};

HX.SceneNode.prototype.toString = function()
{
    return "[SceneNode(name=" + this._name + ")]";
};

/**
 * Creates a new Scene object
 * @param rootNode (optional) A rootnode to be used, allowing different partition types to be used as the root.
 * @constructor
 */
HX.Scene = function(rootNode)
{
    // the default partition is a BVH node
    //  -> or this may need to become an infinite bound node?
    this._rootNode = rootNode || new HX.GroupNode();
    this._rootNode._setScene(this);
    this._skybox = null;
    this._entityEngine = new HX.EntityEngine();
};

HX.Scene.prototype = {
    constructor: HX.Scene,

    get skybox() { return this._skybox; },
    set skybox(value) { this._skybox = value; },

    // TODO: support regex for partial matches
    findNodeByName: function(name)
    {
        return this._rootNode.findNodeByName(name);
    },

    // TODO: support regex for partial matches
    findMaterialByName: function(name)
    {
        return this._rootNode.findMaterialByName(name);
    },

    attach: function(child)
    {
        this._rootNode.attach(child);
    },

    detach: function(child)
    {
        this._rootNode.detach(child);
    },

    get numChildren()
    {
        return this._rootNode.numChildren;
    },

    getChild: function(index)
    {
        return this._rootNode.getChild(index);
    },

    contains: function(child)
    {
        this._rootNode.contains(child);
    },

    acceptVisitor: function(visitor)
    {
        visitor.visitScene(this);
        // assume root node will always qualify
        this._rootNode.acceptVisitor(visitor);
    },

    get entityEngine()
    {
        return this._entityEngine;
    }
};


/**
 *
 * @constructor
 */
HX.GroupNode = function()
{
    HX.SceneNode.call(this);

    // child entities (scene nodes)
    this._children = [];
};

HX.GroupNode.prototype = Object.create(HX.SceneNode.prototype,
    {
        numChildren: {
            get: function() { return this._children.length; }
        }
    });


HX.GroupNode.prototype.findNodeByName = function(name)
{
    var node = HX.SceneNode.prototype.findNodeByName.call(this, name);
    if (node) return node;
    var len = this._children.length;
    for (var i = 0; i < len; ++i) {
        node = this._children[i].findNodeByName(name);
        if (node) return node;
    }
};

HX.GroupNode.prototype.attach = function(child)
{
    if (child._parent)
        throw new Error("Child is already parented!");

    child._parent = this;
    child._setScene(this._scene);

    this._children.push(child);
    this._invalidateWorldBounds();
};

HX.GroupNode.prototype.detach = function(child)
{
    var index = this._children.indexOf(child);

    if (index < 0)
        throw new Error("Trying to remove a scene object that is not a child");

    child._parent = null;

    this._children.splice(index, 1);
    this._invalidateWorldBounds();
};

HX.GroupNode.prototype.getChild = function(index) { return this._children[index]; };

HX.GroupNode.prototype.acceptVisitor = function(visitor)
{
    HX.SceneNode.prototype.acceptVisitor.call(this, visitor);

    var len = this._children.length;
    for (var i = 0; i < len; ++i) {
        var child = this._children[i];

        if (visitor.qualifies(child))
            child.acceptVisitor(visitor);
    }
};

HX.GroupNode.prototype._invalidateWorldTransformationMatrix = function()
{
    HX.SceneNode.prototype._invalidateWorldTransformationMatrix.call(this);

    var len = this._children.length;
    for (var i = 0; i < len; ++i)
        this._children[i]._invalidateWorldTransformationMatrix();
};

HX.GroupNode.prototype._updateWorldBounds = function()
{
    var len = this._children.length;

    for (var i = 0; i < len; ++i)
        this._worldBounds.growToIncludeBound(this._children[i].worldBounds);

    HX.SceneNode.prototype._updateWorldBounds.call(this);
};

HX.GroupNode.prototype._setScene = function(scene)
{
    HX.SceneNode.prototype._setScene.call(this, scene);

    var len = this._children.length;

    for (var i = 0; i < len; ++i)
        this._children[i]._setScene(scene);
};
