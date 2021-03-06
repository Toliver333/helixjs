import * as HX from "helix";

/**
 * @classdesc
 *
 * BufferGeometryJSON loads three.js' JSON BufferGeometry format.
 *
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
 */
function THREEBufferGeometry()
{
    HX.Importer.call(this);
}

THREEBufferGeometry.prototype = Object.create(HX.Importer.prototype);

THREEBufferGeometry.prototype.parse = function(data, target)
{
    target = target || new HX.Mesh();
    var json = JSON.parse(data);
    if (json.type !== "BufferGeometry") {
        this._notifyFailure("JSON does not contain correct BufferGeometry data! (type property is not BufferGeometry)");
        return;
    }
    HX.Mesh.createDefaultEmpty(target);

    this.parseAttributes(json.data.attributes, target);
    this.parseIndices(json.data.index, target);

    var flags = json.data.attributes.normal? HX.NormalTangentGenerator.MODE_NORMALS : 0;
    flags |= json.data.attributes.tangent? HX.NormalTangentGenerator.MODE_TANGENTS : 0;
    if (flags) {
        var gen = new HX.NormalTangentGenerator();
        gen.generate(target, flags);
    }

    this._notifyComplete(target);
};

THREEBufferGeometry.prototype.parseAttributes = function(attributes, mesh)
{
    var map = {
        "position": "hx_position",
        "normal": "hx_normal",
        "tangent": "hx_tangent",
        "uv": "hx_texCoord"
    };

    // assume position is always present
    var numVertices = attributes.position.array.length / attributes.position.itemSize;

    for (var name in attributes) {
        if (!attributes.hasOwnProperty(name)) continue;
        if (!map.hasOwnProperty(name)) {
            mesh.addVertexAttribute(name, attributes[name].itemSize);
            if (attributes[name].type !== "Float32Array") {
                this._notifyFailure("Unsupported vertex attribute data type!");
            }
        }
    }

    var stride = mesh.getVertexStride(0);

    var data = new Float32Array(numVertices * stride);

    for (name in attributes) {
        if (!attributes.hasOwnProperty(name)) continue;
        var attrib = attributes[name];
        var mappedName = map[name] || name;
        var def = mesh.getVertexAttributeByName(mappedName);

        var itemSize = attrib.itemSize;
        var j = 0;
        var len = attrib.array.length;
        var offset = def.offset;

        var flip = false;
        if (name === "position" || name === "normal" || name === "tangent") {
            flip = true;
        }

        while (j < len) {
            for (var i = 0; i < itemSize; ++i)
                data[offset + i] = attrib.array[j++];

            if (flip) {
                var z = data[offset + 1];
                var y = data[offset + 2];

                data[offset + 1] = y;
                data[offset + 2] = z;
            }
            offset += stride;
        }
    }

    mesh.setVertexData(data, 0);
};

THREEBufferGeometry.prototype.parseIndices = function(indexData, mesh)
{
    var indices;
    switch (indexData.type) {
        case "Uint16Array":
            indices = new Uint16Array(indexData.array);
            break;
        case "Uint32Array":
            indices = new Uint32Array(indexData.array);
            break;
        default:
            this._notifyFailure("Unsupported index type " + indexData.type);
    }

    mesh.setIndexData(indices);
};

export { THREEBufferGeometry };