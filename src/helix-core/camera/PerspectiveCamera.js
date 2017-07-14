import {Camera} from "./Camera";

/**
 * @extends Camera
 *
 * @classdesc
 * PerspectiveCamera is a Camera used for rendering with perspective.
 *
 * @property {number} verticalFOV The vertical field of view in radians.
 *
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
 */
function PerspectiveCamera()
{
    Camera.call(this);

    this._vFOV = 1.047198;  // radians!
    this._aspectRatio = 0;
};


PerspectiveCamera.prototype = Object.create(Camera.prototype, {
    verticalFOV: {
        get: function()
        {
            return this._vFOV;
        },
        set: function(value)
        {
            this._vFOV = value;
            this._invalidateProjectionMatrix();
        }
    }
});

/**
 * @ignore
 */
PerspectiveCamera.prototype._setAspectRatio = function(value)
{
    if (this._aspectRatio === value) return;

    this._aspectRatio = value;
    this._invalidateProjectionMatrix();
};

/**
 * @ignore
 */
PerspectiveCamera.prototype._setRenderTargetResolution = function(width, height)
{
    Camera.prototype._setRenderTargetResolution.call(this, width, height);
    this._setAspectRatio(width / height);
};

/**
 * @ignore
 */
PerspectiveCamera.prototype._updateProjectionMatrix = function()
{
    this._projectionMatrix.fromPerspectiveProjection(this._vFOV, this._aspectRatio, this._nearDistance, this._farDistance);
    this._projectionMatrixDirty = false;
};

export { PerspectiveCamera };