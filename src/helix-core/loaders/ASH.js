import {Importer} from "./Importer";
import {Float4} from "../math/Float4";
import {SphericalHarmonicsRGB} from "../math/SphericalHarmonicsRGB";

/**
 * @classdesc
 * ASH is an Importer for files containing spherical harmonics functions, as generated by Knald's Lys. Yields a
 * {@linkcode SphericalHarmonicsRGB} object.
 *
 * @constructor
 *
 * @extends Importer
 *
 * @author derschmale <http://www.derschmale.com>
 */
function ASH()
{
    Importer.call(this);
}

ASH.prototype = Object.create(Importer.prototype);

ASH.prototype.parse = function(data, target)
{
    target = target || new SphericalHarmonicsRGB();

    var lines = data.split("\n");
	var numLines = lines.length;
	var level = -1;

	for (var i = 0; i < numLines; ++i) {
		var line = parseLine(lines[i]);
        if (!line) continue;
        if (line.label === "l") {
            level = line.index;
        }
        else if (line.label === "m")
            target.setWeight(level, line.index, line.value);
	}

    this._notifyComplete(target);
};

function parseLine(line)
{
	line = line.replace(/^\s+|\s+$/g, "");
	if (line.length === 0 || line.charAt(0) === "#") return null;
	var data = line.split("=", 2);
	var valueField = data[1].split(":", 2);

	var o = {
	    label: data[0].charAt(0),
        index: parseInt(valueField[0]),
        value: null
    };

	if (o.label === "m") {
		var valueData = valueField[1].match(/\S+/g);
		// TODO: We probably need to rotate the SH representation to fit our Z-up orientation
		o.value = new Float4(parseFloat(valueData[0]), parseFloat(valueData[1]), parseFloat(valueData[2]));
    }

	return o;
}

export { ASH };