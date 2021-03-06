import * as HX from "helix";
import * as CANNON from "cannon";
import {Collider} from "./Collider";

/**
 * HeightfieldCollider is a {@linkcode Collider} that works with heightfield data.
 * @param {Array|Texture2D} heightData An Array containing numbers, or a Texture2D containing texture data (this can be
 * slow because of the data that needs to be read back).
 * @param {number} worldSize The size of the height map width in world coordinates
 * @param {number} minHeight The minimum height in the heightmap (only used if heightData is a texture)
 * @param {number} maxHeight The maximum height in the heightmap (only used if heightData is a texture)
 * @param {boolean} rgbaEnc Indicates the data in the texture are [0 - 1] numbers encoded over the RGBA channels (only
 * used if heightData is a texture)
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
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
	this._center = new HX.Float4(-this._elementSize * this._heightMapWidth * .5, -this._elementSize * this._heightMapHeight * .5, minHeight, 0);
}

HeightfieldCollider.prototype = Object.create(Collider.prototype);

HeightfieldCollider.prototype.volume = function ()
{
	return 0;
};

HeightfieldCollider.prototype.createShape = function (bounds)
{
	return new CANNON.Heightfield(this._heightData, {
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
	var data = HX.TextureUtils.getData(map);

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

	for (x = 0; x < w; ++x) {
		for (y = 0; y < h; ++y) {
			data[x][y] += minZ;
		}
	}

	return minZ;
};

export {HeightfieldCollider};