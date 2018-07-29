(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('cannon'), require('helix')) :
	typeof define === 'function' && define.amd ? define('HX', ['exports', 'cannon', 'helix'], factory) :
	(factory((global.HX = global.HX || {}),global.CANNON,global.HX));
}(this, (function (exports,CANNON$1,HX$1) { 'use strict';

function SubShape(shape, offset, orientation)
{
	this.shape = shape;
	this.offset = offset || new HX.Float4();
	this.orientation = orientation;
}

function CompoundShape()
{
	this._shapes = [];
}

CompoundShape.prototype = {
	get shapes() { return this._shapes; },

	addShape: function(shape, offset, orientation)
	{
		this._shapes.push(new SubShape(shape, offset, orientation));
	}
};

/**
 * @ignore
 *
 * @author derschmale <http://www.derschmale.com>
 */
function Collider()
{
    // these can be set by subclasses
    this._center = null;
    this._orientation = null;
    this._positionOffset = null;
}

Collider.prototype = {

    /**
     * @ignore
     */
    createRigidBody: function(sceneBounds)
    {
        var shape = this.createShape(sceneBounds);
        var body = new CANNON$1.Body({
            mass: 50 * this.volume()
        });

        if (!this._center) this._center = sceneBounds.center;

        if (shape instanceof CompoundShape) {
            var shapes = shape.shapes;
            for (var i = 0; i < shapes.length; ++i) {
                var subShape = shapes[i];
                var c = HX.Float4.add(this._center, subShape.offset);
                var q = undefined;
                if (this._orientation) {
                    q = this._orientation.clone();
                }
                if (subShape.orientation) {
                    if (q)
                        q.append(subShape.orientation);
                    else
                        q = subShape.orientation.clone();
                }

			    body.addShape(subShape.shape, c, q);
			}
        }
        else
            body.addShape(shape, this._center, this._orientation);

        return body;
    },

	/**
	 * @ignore
     */
    createShape: function(sceneBounds)
    {
        throw new Error("Abstract method called!");
    },

    /**
     * @ignore
     */
    volume: function()
    {
        throw new Error("Abstract method called!");
    }

};

/**
 * @classdesc
 *
 * A box-shaped collider.
 *
 * @constructor
 *
 * @param {Float4} [min] The minimum coordinates of the box in local object space. If omitted, will use the object bounds.
 * @param {Float4} [max] The maximum coordinates of the box in local object space. If omitted, will use the object bounds.
 *
 * @author derschmale <http://www.derschmale.com>
 */
function BoxCollider(min, max)
{
    Collider.call(this);
    if (min && max) {
        this._halfExtents = HX.Float4.subtract(max, min).scale(.5);
        this._center = HX.Float4.add(max, min).scale(.5);
    }
}

BoxCollider.prototype = Object.create(Collider.prototype);

BoxCollider.prototype.volume = function()
{
    return 8 * (this._halfExtents.x * this._halfExtents.y * this._halfExtents.z);
};

BoxCollider.prototype.createShape = function(sceneBounds)
{
    if (!this._halfExtents)
        this._halfExtents = sceneBounds.getHalfExtents();

    var vec3 = new CANNON$1.Vec3();
    vec3.copy(this._halfExtents);
    return new CANNON$1.Box(vec3);
};

/**
 * @classdesc
 *
 * A sphere-shaped collider.
 *
 * @constructor
 *
 * @param {number} [radius] The radius of the sphere. If omitted, will use the object bounds.
 *
 * @author derschmale <http://www.derschmale.com>
 */
function SphereCollider(radius, center)
{
    Collider.call(this);
    this._radius = radius;
    this._center = center;
    if (radius !== undefined && center === undefined) {
        this._center = new HX.Float4();
    }
}

SphereCollider.prototype = Object.create(Collider.prototype);

SphereCollider.prototype.volume = function()
{
    var radius = this._radius;
    return .75 * Math.PI * radius * radius * radius;
};

SphereCollider.prototype.createShape = function(sceneBounds)
{
    this._radius = this._radius || sceneBounds.getRadius();
    return new CANNON$1.Sphere(this._radius);
};

/**
 * @classdesc
 * RigidBody is a component allowing a scene graph object to have physics simulations applied to it. Requires
 * {@linkcode PhysicsSystem}. At this point, entities using RigidBody need to be added to the root of the scenegraph (or
 * have parents without transformations)!
 *
 * @property {boolean} ignoreRotation When set to true, the rigid body does not take on the rotation of its entity. This is useful
 * for a player controller camera.
 * @property {Number} ignoreRotation The mass of the target object.
 * @property {Number} linearDamping How much an object linear movement slows down over time
 * @property {Number} angularDamping How much an object rotational movement slows down over time
 * @property {PhysicsMaterial} material The PhysicsMaterial defining friction and restitution.
 *
 * @constructor
 * @param collider The Collider type describing the shape of how to object interacts with the world. If omitted, it will
 * take a shape based on the type of bounds assigned to the target object.
 * @param mass The mass of the target object. If omitted, it will venture a guess based on the bounding volume.*
 * @param material An optional PhysicsMaterial defining the friction and restitution parameters of the surface
 *
 * @author derschmale <http://www.derschmale.com>
 */
function RigidBody(collider, mass, material)
{
    HX$1.Component.call(this);
    this._collider = collider;
    this._body = null;
    this._ignoreRotation = false;

    this._mass = mass;

    this._linearDamping = 0.01;
    this._angularDamping = 0.01;
	this._material = material;
}


HX$1.Component.create(RigidBody, {
	ignoreRotation: {
        get: function()
        {
            return this._ignoreRotation;
        },

        set: function(value)
        {
			this._ignoreRotation = value;

			// disable rotational physics altogether
			if (this._body)
				this._body.fixedRotation = value;
			// 	this._body.angularDamping = value? 1.0 : this._angularDamping;
        }
    },

    body: {
        get: function() {
            return this._body;
        }
    },

    mass: {
        get: function()
        {
            return this._mass;
        },

        set: function(value)
        {
            this._mass = value;
            if (this._body) {
				this._body.mass = value;
				this._body.updateMassProperties();
			}
        }
    },

    linearDamping: {
        get: function()
        {
            return this._linearDamping;
        },

        set: function(value)
        {
            this._linearDamping = value;
            if (this._body) this._body.linearDamping = value;
        }
    },

    angularDamping: {
        get: function()
        {
            return this._angularDamping;
        },

        set: function(value)
        {
            this._angularDamping = value;

			// disable rotational physics altogether if ignoreRotation is set
			// if (this._body)
            	// this._body.angularDamping = this._ignoreRotation? 1.0 : value;
        }
    },

    material: {
	    get: function()
        {
            return this._material;
        },

        set: function(value)
        {
            this._material = value;

            if (this._body)
            	this._body.material = value? value._cannonMaterial : null;
        }
    }
});

RigidBody.prototype.addImpulse = function(v, pos)
{
    // if no position is set, just
	if (pos) {
		this._body.applyImpulse(v, pos);
	}
	else {
		var vel = this._body.velocity;
		vel.x += v.x;
		vel.y += v.y;
		vel.z += v.z;
	}
};

RigidBody.prototype.addForce = function(v, pos)
{
    if (pos) {
		this._body.applyForce(v, pos);
	}
	else {
        var f = this._body.force;
        f.x += v.x;
        f.y += v.y;
        f.z += v.z;
    }
};

RigidBody.prototype.onAdded = function()
{
    this._createBody();
};

RigidBody.prototype.onRemoved = function()
{
};

RigidBody.prototype.prepTransform = function()
{
	var entity = this._entity;
	var body = this._body;

	var p = entity.position;

	var offs = this._collider._positionOffset;
	if (offs)
		body.position.set(p.x + offs.x, p.y + offs.y, p.z + offs.z);
	else
		body.position.set(p.x, p.y, p.z);

	if (this._ignoreRotation) {
		body.quaternion.set(0, 0, 0, 1);
	}
	else {
		var q = entity.rotation;
		body.quaternion.set(q.x, q.y, q.z, q.w);
	}
};

RigidBody.prototype.applyTransform = function()
{
    if (this._mass === 0.0)
        return;

    var entity = this._entity;
    var body = this._body;

	if (this._collider._positionOffset)
		HX$1.Float4.subtract(body.position, this._collider._positionOffset, entity.position);
    else
        entity.position = body.position;

    if (!this._ignoreRotation)
        entity.rotation = body.quaternion;
};

RigidBody.prototype._createBody = function()
{
    var entity = this._entity;

    var bounds;
    if (entity instanceof HX$1.ModelInstance) {
        bounds = entity.localBounds;
    }
    else {
        var matrix = new HX$1.Matrix4x4();
        matrix.inverseAffineOf(entity.worldMatrix);
        bounds = new HX$1.BoundingAABB();
        bounds.transformFrom(entity.worldBounds, matrix);
    }

    if (!this._collider)
        this._collider = bounds instanceof HX$1.BoundingAABB? new BoxCollider() : new SphereCollider();

    this._body = this._collider.createRigidBody(bounds);

    if (this._mass !== undefined)
        this._body.mass = this._mass;

    if (this._material !== undefined)
		this._body.material = this._material._cannonMaterial;

    this._body.linearDamping = this._linearDamping;
    this._body.angularDamping = this._angularDamping;

    this._body.position.copy(entity.position);

	this._body.fixedRotation = this._ignoreRotation;
    if (!this._ignoreRotation)
        this._body.quaternion.copy(entity.rotation);

	this._body.updateMassProperties();
};

/**
 * PhysicsSystem is an {@linkcode EntitySystem} allowing physics simulations (based on cannonjs).
 *
 * @property fixedTimeStep If 0, it uses the frame delta times which is not recommended for stability reasons.
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
 */
function PhysicsSystem()
{
    HX$1.EntitySystem.call(this);

    this._world = new CANNON$1.World();
    this._gravity = -9.81; // m/s²
    this._world.gravity.set(0, 0, this._gravity);
    this._world.solver.tolerance = .0001;
    this._world.solver.iterations = 10;
    this._fixedTimeStep = 1000/60;
    this._world.broadphase = new CANNON$1.SAPBroadphase(this._world);
    // this._world.broadphase = new CANNON.NaiveBroadphase(this._world);

    // this._world.quatNormalizeFast = true;
    // this._world.quatNormalizeSkip = 2;

    this._components = [];
}

PhysicsSystem.prototype = Object.create(HX$1.EntitySystem.prototype, {
    gravity: {
        get: function() {
            return this._gravity;
        },

        set: function(value) {
            this._gravity = value;

            if (value instanceof HX$1.Float4)
                this._world.gravity.set(value.x, value.y, value.z);
            else
                this._world.gravity.set(0, value, 0);
        }
    },

    fixedTimeStep: {
        get: function() {
            return this._fixedTimeStep;
        },

        set: function(value) {
            this._fixedTimeStep = value;
        }
    }
});

PhysicsSystem.prototype.onStarted = function()
{
    this._colliders = this.getEntitySet([RigidBody]);
    this._colliders.onEntityAdded.bind(this._onEntityAdded, this);
    this._colliders.onEntityRemoved.bind(this._onEntityRemoved, this);

    var len = this._colliders.numEntities;
    for (var i = 0; i < len; ++i) {
        var entity = this._colliders.getEntity(i);
        this._onEntityAdded(entity);
    }
};

PhysicsSystem.prototype.onStopped = function()
{
    this._colliders.onEntityAdded.unbind(this._onEntityAdded);
    this._colliders.onEntityRemoved.unbind(this._onEntityRemoved);
};

PhysicsSystem.prototype._onEntityAdded = function(entity)
{
    var component = entity.getFirstComponentByType(RigidBody);
    // for faster access
    this._components.push(component);

    this._world.addBody(component.body);
};

PhysicsSystem.prototype._onEntityRemoved = function(entity)
{
    var component = entity.getFirstComponentByType(RigidBody);
    this._world.removeBody(component.body);
    var index = this._components.indexOf(component);
    this._components.splice(index, 1);
};

// we're updating here to enforce order of updates
PhysicsSystem.prototype.onUpdate = function(dt)
{
	var len = this._components.length;

	for (var i = 0; i < len; ++i) {
		this._components[i].prepTransform();
	}

    this._world.step(this._fixedTimeStep * .001);

    for (i = 0; i < len; ++i) {
        this._components[i].applyTransform();
    }
};

/**
 * @classdesc
 *
 * A capsule-shaped collider.
 *
 * @constructor
 *
 * @param {number} [radius] The radius of the capsule. If omitted, will use the object bounds.
 * @param {number} [height] The height of the capsule. If omitted, will use the object bounds.
 *
 * @author derschmale <http://www.derschmale.com>
 */
function CapsuleCollider(radius, height, center)
{
    Collider.call(this);
    this._radius = radius;
    this._height = height;
    this._center = center;
    if (this._height < 2.0 * this._radius) this._height = 2.0 * this._radius;
    if (radius !== undefined && center === undefined) {
        this._center = new HX.Float4();
    }
}

CapsuleCollider.prototype = Object.create(Collider.prototype);

CapsuleCollider.prototype.volume = function()
{
    var radius = this._radius;
    var cylHeight = this._height - 2 * this._radius;
    var sphereVol = .75 * Math.PI * radius * radius * radius;
    var cylVol = Math.PI * radius * radius * cylHeight;
    return cylVol + sphereVol;
};

CapsuleCollider.prototype.createShape = function(sceneBounds)
{
	var cylHeight = this._height - 2 * this._radius;
    this._radius = this._radius || sceneBounds.getRadius();
    var shape = new CompoundShape();
    var sphere = new CANNON$1.Sphere(this._radius);
	shape.addShape(sphere, new HX.Float4(0, 0, -cylHeight * .5));
	shape.addShape(sphere, new HX.Float4(0, 0, cylHeight * .5));
	shape.addShape(new CANNON$1.Cylinder(this._radius, this._radius, cylHeight, 10));
    return shape;
};

/**
 * @classdesc
 *
 * A collider along an infinite plane.
 *
 * @constructor
 *
 * @param {number} [height] The height of the sphere. If omitted, will use the object bounds.
 *
 * @author derschmale <http://www.derschmale.com>
 */
function InfinitePlaneCollider(height)
{
    Collider.call(this);
    if (height) this._center = new HX.Float4(0, 0, height);
}

InfinitePlaneCollider.prototype = Object.create(Collider.prototype);

InfinitePlaneCollider.prototype.volume = function()
{
    return 0;
};

InfinitePlaneCollider.prototype.createShape = function(sceneBounds)
{
    return new CANNON.Plane();
};

/**
 *
 * @param {Array|Texture2D} heightData An Array containing numbers, or a Texture2D containing texture data (this can be slow because of the data that needs to be read back).
 * @param {number} worldSize The size of the height map width in world coordinates
 * @param {number} minHeight The minimum height in the heightmap (only used if heightData is a texture)
 * @param {number} maxHeight The maximum height in the heightmap (only used if heightData is a texture)
 * @param {boolean} rgbaEnc Indicates the data in the texture are [0 - 1] numbers encoded over the RGBA channels (only used if heightData is a texture)
 * @constructor
 */
function HeightfieldCollider(heightData, worldSize, minHeight, maxHeight, rgbaEnc)
{
	Collider.call(this);

	if (heightData instanceof HX.Texture2D) {
		if (maxHeight === undefined) maxHeight = 1;
		if (minHeight === undefined) minHeight = 0;

		this._heightData = this._convertHeightMap(heightData, maxHeight - minHeight, rgbaEnc);
	}
	else {
		this._heightData = heightData;
		minHeight = this._shiftHeightData();
	}

	this._heightMapWidth = this._heightData.length;
	this._heightMapHeight = this._heightData[0].length;
	this._worldSize = worldSize;
	this._elementSize = this._worldSize / (this._heightMapWidth - 1);
	this._positionOffset = new HX.Float4(-this._elementSize * this._heightMapWidth * .5, -this._elementSize * this._heightMapHeight * .5, minHeight, 0);
}

HeightfieldCollider.prototype = Object.create(Collider.prototype);

HeightfieldCollider.prototype.volume = function ()
{
	return 0;
};

HeightfieldCollider.prototype.createShape = function (sceneBounds)
{
	return new CANNON$1.Heightfield(this._heightData, {
		elementSize: this._elementSize
	});
};

/**
 * @private
 * @ignore
 */
HeightfieldCollider.prototype._convertHeightMap = function (map, scale, rgbaEnc)
{
	var w = map.width;
	var h = map.height;
	var tex = new HX.Texture2D();
	tex.initEmpty(w, h, HX.TextureFormat.RGBA, map.dataType);
	var fbo = new HX.FrameBuffer(tex);
	fbo.init();
	HX.GL.setRenderTarget(fbo);
	HX.GL.clear();
	HX.BlitTexture.execute(map);

	var len = w * h * 4;

	var data;
	if (map.dataType === HX.DataType.FLOAT)
		data = new Float32Array(len);
	else if (map.dataType === HX.DataType.UNSIGNED_BYTE)
		data = new Uint8Array(len);
	else
		throw new Error("Invalid dataType!");

	HX.GL.gl.readPixels(0, 0, w, h, HX.TextureFormat.RGBA, map.dataType, data);

	var arr = [];

	if (rgbaEnc) scale /= 255.0;

	for (var x = 0; x < w; ++x) {
		arr[x] = [];
		for (var y = 0; y < h; ++y) {
			// var y2 = h - y - 1;
			// var x2 = w - x - 1;
			var i = (x + y * w) << 2;
			var val = data[i];

			if (rgbaEnc)
				val += data[i + 1] / 255.0 + data[i + 2] / 65025.0 + data[i + 3] / 16581375.0;

			arr[x][y] = val * scale;
		}
	}

	return arr;
};

HeightfieldCollider.prototype._shiftHeightData = function()
{
	var data = this._heightData;
	var w = data.width;
	var h = data.height;

	var minZ = 0.0;

	for (var x = 0; x < w; ++x) {
		for (var y = 0; y < h; ++y) {
			if (data[x][y] < minZ) {
				minZ = data[x][y];
			}
		}
	}

	if (minZ === 0.0) return;

	for (var x = 0; x < w; ++x) {
		for (var y = 0; y < h; ++y) {
			data[x][y] += minZ;
		}
	}

	return minZ;
};

/**
 * PhysicsMaterial represents the physical "material" a RigidBody is made of, defining friction and restitution ("bounciness").
 * @param friction Defines how hard it is to move an object resting on this material.
 * @param restitution Defines how much an object that hits the material bounces.
 * @constructor
 */
function PhysicsMaterial(friction, restitution)
{
	this._cannonMaterial = new CANNON.Material({
		friction: friction,
		restitution: restitution
	});
}

PhysicsMaterial.prototype = {
	/**
	 * Defines how hard it is to move an object resting on this material.
	 */
	get friction()
	{
		return this._cannonMaterial.friction;
	},

	set friction(value)
	{
		this._cannonMaterial.friction = value;
	},

	/**
	 * The "bounciness" of this material.
	 */
	get restitution()
	{
		return this._cannonMaterial.restitution;
	},

	set restitution(value)
	{
		this._cannonMaterial.restitution = value;
	}
};

function PlayerController()
{
	HX.Component.call(this);
	this._move = new HX.Float2();
	this._walkForce = 50.0;
	this._runForce = 100.0;
	this._movementForce = this._walkForce;
	this._jumpForce = 10.0;
	this._pitch = 0.0;
	this._yaw = 0.0;
	this._mouseX = 0;
	this._mouseY = 0;
	this._jump = 0;

	this._onKeyDown = null;
	this._onKeyUp = null;
}

HX.Component.create(PlayerController, {
	walkForce: {
		get: function()
		{
			return this._walkForce;
		},

		set: function(value)
		{
			this._movementForce = value;
			this._walkForce = value;
		}
	},

	runForce: {
		get: function()
		{
			return this._runForce;
		},

		set: function(value)
		{
			this._runForce = value;
		}
	},

	jumpForce: {
		get: function()
		{
			return this._jumpForce;
		},

		set: function(value)
		{
			this._jumpForce = value;
		}
	},

	pitch: {
		get: function()
		{
			return this._pitch;
		},

		set: function(value)
		{
			this._pitch = value;
		}
	},

	yaw: {
		get: function()
		{
			return this._yaw;
		},

		set: function(value)
		{
			this._yaw = value;
		}
	}
});

/**
 * @ignore
 */
PlayerController.prototype.onAdded = function(dt)
{
	var self = this;

	this._onKeyDown = function(event) {
		var keyCode = ("which" in event) ? event.which : event.keyCode;

		switch (keyCode) {
			case 16:
				self._movementForce = self._runForce;
				break;
			case 32:
				self._jump = self._jumpForce;
				break;
			case 87:
				self._setForward(1.0);
				break;
			case 83:
				self._setForward(-1.0);
				break;
			case 65:
				self._setStride(-1.0);
				break;
			case 68:
				self._setStride(1.0);
				break;
			default:
			// nothing
		}
	};

	this._onKeyUp = function(event) {
		var keyCode = ("which" in event) ? event.which : event.keyCode;

		switch (keyCode) {
			case 16:
				self._movementForce = self._walkForce;
				break;
			case 87:
			case 83:
				self._setForward(0.0);
				break;
			case 65:
			case 68:
				self._setStride(0.0);
				break;
			default:
			// nothing
		}
	};

	this._onMouseMove = function(event)
	{
		event = event || window.event;

		self._addPitch((self._mouseY-event.clientY) / 100);
		self._addYaw(-(self._mouseX-event.clientX) / 100);

		self._mouseX = event.clientX;
		self._mouseY = event.clientY;
	};

	this._onMouseDown = function(event)
	{
		self._mouseX = event.clientX;
		self._mouseY = event.clientY;
		HX.META.TARGET_CANVAS.addEventListener("mousemove", self._onMouseMove);
	};

	this._onMouseUp = function(event)
	{
		HX.META.TARGET_CANVAS.removeEventListener("mousemove", self._onMouseMove);
	};

	document.addEventListener("keydown", this._onKeyDown);
	document.addEventListener("keyup", this._onKeyUp);
	HX.META.TARGET_CANVAS.addEventListener("mousedown", this._onMouseDown);
	HX.META.TARGET_CANVAS.addEventListener("mouseup", this._onMouseUp);
};

/**
 * @ignore
 */
PlayerController.prototype.onRemoved = function(dt)
{
	document.removeEventListener("keydown", this._onKeyDown);
	document.removeEventListener("keyup", this._onKeyUp);
	HX.META.TARGET_CANVAS.removeEventListener("mousemove", this._onMouseMove);
	HX.META.TARGET_CANVAS.removeEventListener("mousedown", this._onMouseDown);
	HX.META.TARGET_CANVAS.removeEventListener("mouseup", this._onMouseUp);
};

/**
 * @ignore
 */
PlayerController.prototype.onUpdate = function(dt)
{
	var x = new HX.Float2();
	var y = new HX.Float2();
	var p = new HX.Float4();

	return function(dt)
	{
		this._rigidBody = this.entity.getFirstComponentByType(RigidBody);

		var extr = Math.PI * .5 - 0.001;
		if (this._pitch < -extr) this._pitch = -extr;
		else if (this._pitch > extr) this._pitch = extr;

		this.entity.rotation.fromPitchYawRoll(this._pitch, this._yaw, 0.0);

		var matrix = this.entity.matrix;

		var m = matrix._m;
		x.set(m[0], m[1]);
		y.set(m[4], m[5]);
		x.normalize();
		y.normalize();
		p.x = (this._move.x * x.x + this._move.y * y.x) * this._movementForce;
		p.y = (this._move.x * x.y + this._move.y * y.y) * this._movementForce;
		p.z = 0.0;
		this._rigidBody.addForce(p);

		if (this._jump) {
			p.x = 0;
			p.y = 0;
			p.z = this._jump;
			this._rigidBody.addImpulse(p);
			this._jump = 0;
		}
	}
}();

/**
 * @ignore
 */
PlayerController.prototype._setForward = function(ratio)
{
	this._move.y = ratio;
};

/**
 * @ignore
 */
PlayerController.prototype._setStride = function(ratio)
{
	this._move.x = ratio;
};

/**
 * @ignore
 */
PlayerController.prototype._addPitch = function(value)
{
	this._pitch += value;
};

/**
 * @ignore
 */
PlayerController.prototype._addYaw = function(value)
{
	this._yaw += value;
};

exports.PhysicsSystem = PhysicsSystem;
exports.RigidBody = RigidBody;
exports.BoxCollider = BoxCollider;
exports.CapsuleCollider = CapsuleCollider;
exports.SphereCollider = SphereCollider;
exports.InfinitePlaneCollider = InfinitePlaneCollider;
exports.HeightfieldCollider = HeightfieldCollider;
exports.PhysicsMaterial = PhysicsMaterial;
exports.PlayerController = PlayerController;

Object.defineProperty(exports, '__esModule', { value: true });

})));
