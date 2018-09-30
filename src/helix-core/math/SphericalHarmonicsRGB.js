import {Color} from "../core/Color";

var sh_1_4 = Math.sqrt(1.0 / (4.0 * Math.PI));
var sh_1_3 = Math.sqrt(1.0 / (3.0 * Math.PI));
var sh_15_64 = Math.sqrt(15.0 / (64.0 * Math.PI));
var sh_5_256 = Math.sqrt(5.0 / (256.0 * Math.PI));
var sh_15_256 = Math.sqrt(15.0 / (256.0 * Math.PI));
var sh_15_128 = Math.sqrt(5.0 / (128.0 * Math.PI));

var shConstants = [
	sh_1_4,

	-sh_1_3,
	sh_1_3,
	-sh_1_3,

	sh_15_64,
	-sh_15_64,
	sh_5_256,
	-sh_15_128,
	sh_15_256
];

/**
 * @classdesc
 *
 * SphericalHarmonicsRGB represents an L2 spherical harmonics approximation, storing 27 floats as an approximation for a
 * low-frequency function on the unit sphere domain mapping to colour values.
 *
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
 */
function SphericalHarmonicsRGB()
{
	// coefficients are premultiplied with the SH constant values!
	this._coefficients = new Float32Array(27);

	for (var i = 0; i < 27; ++i)
		this._coefficients[i] = 0;
}

SphericalHarmonicsRGB.prototype = {
	/**
	 * Assigns the weight for a given SH basis function
	 * @param level The SH level from 0 to 2
	 * @param index The index of the base function for the current level. For level 0, this must be 0. Otherwise it's in the range [-level, level]
	 * @param value A Float4 object containing the three weights in xyz.
	 */
	setWeight: function(level, index, value)
	{
		var i = this._getCoeffIndex(level, index);
		var i3 = i * 3;
		this._coefficients[i3] = shConstants[i] * value.x;
		this._coefficients[i3 + 1] = shConstants[i] * value.y;
		this._coefficients[i3 + 2] = shConstants[i] * value.z;
	},

	/**
	 * Evaluates the SH representation and returns the value at the given direction.
	 * @param vector The direction vector for which we're evaluating the function. This is expected to be normalized.
	 * @param {Color} [target] An optional target to store the evaluated value
	 */
	evaluate: function(vector, target)
	{
		// TODO: Rotate the coefficients when parsing ASH files instead of swizzling
		var x = vector.x;
		var y = vector.z;	// flip YZ because SH is encoded with Y-up
		var z = vector.y;
		var c = this._coefficients;

		target = target || new Color();

		// L0 + L1
		target.r = c[0] + c[3] * y + c[6] * z + c[9] * x;
		target.g = c[1] + c[4] * y + c[7] * z + c[10] * x;
		target.b = c[2] + c[5] * y + c[8] * z + c[11] * x;

		// L2
		var xy = x * y, yz = y * z, zz = 3.0 * z * z - 1.0, xz = x * z, xxyy = x*x - y*y;

		target.r += c[12] * xy + c[15] * yz + c[18] * zz + c[21] * xz + c[24] * xxyy;
		target.g += c[13] * xy + c[16] * yz + c[19] * zz + c[22] * xz + c[25] * xxyy;
		target.b += c[14] * xy + c[17] * yz + c[20] * zz + c[23] * xz + c[26] * xxyy;

		return target;
	},

	/**
	 * @ignore
	 * @private
	 */
	_getCoeffIndex: function(level, index)
	{
		// level * level is the amount of coefficients *before* the current level
		// (level 0 --> 0, level1 --> 1, level2 --> 4)
		// index + level is the offset from signed indices to unsigned for the current level
		return level * level + index + level;
	}
};

export { SphericalHarmonicsRGB };