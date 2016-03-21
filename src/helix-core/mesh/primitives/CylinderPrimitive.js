HX.CylinderPrimitive = HX.Primitive.define();

/**
 * The alignment dictates which access should be parallel to the sides of the cylinder
 * @type {number}
 */
HX.CylinderPrimitive.ALIGN_X = 1;
HX.CylinderPrimitive.ALIGN_Y = 2;
HX.CylinderPrimitive.ALIGN_Z = 3;

HX.CylinderPrimitive._generate = function(target, definition)
{
    definition = definition || {};
    var alignment = definition.alignment || HX.CylinderPrimitive.ALIGN_Y;
    var numSegmentsH = definition.numSegmentsH || 1;
    var numSegmentsW = definition.numSegmentsW || 1;
    var radius = definition.radius || 1;
    var height = definition.height || 1;
    var doubleSided = definition.doubleSided === undefined? false : definition.doubleSided;

    var positions = target.positions;
    var uvs = target.uvs;
    var normals = target.normals;
    var indices = target.indices;

    var rcpNumSegmentsW = 1/numSegmentsW;
    var rcpNumSegmentsH = 1/numSegmentsH;

    // sides
    for (var hi = 0; hi <= numSegmentsH; ++hi) {
        var h = (hi*rcpNumSegmentsH - .5)*height;
        for (var ci = 0; ci <= numSegmentsW; ++ci) {
            var angle = ci * rcpNumSegmentsW * Math.PI * 2;
            var nx = Math.sin(angle);
            var ny = Math.cos(angle);
            var cx = nx * radius;
            var cy = ny * radius;

            switch (alignment) {
                case HX.CylinderPrimitive.ALIGN_X:
                    positions.push(-h, cx, -cy);
                    if (normals) normals.push(0, nx, -ny);
                    break;
                case HX.CylinderPrimitive.ALIGN_Y:
                    positions.push(cx, h, -cy);
                    if (normals) normals.push(nx, 0, -ny);
                    break;
                case HX.CylinderPrimitive.ALIGN_Z:
                    positions.push(cx, cy, h);
                    if (normals) normals.push(nx, ny, 0);
                    break;
            }

            if (uvs) uvs.push(1.0 - ci*rcpNumSegmentsW, hi*rcpNumSegmentsH);
        }
    }

    for (var hi = 0; hi < numSegmentsH; ++hi) {
        for (var ci = 0; ci < numSegmentsW; ++ci) {
            var w = numSegmentsW + 1;
            var base = ci + hi*w;

            indices.push(base, base + w, base + w + 1);
            indices.push(base, base + w + 1, base + 1);

            if (doubleSided) {
                indices.push(base, base + w + 1, base + w);
                indices.push(base, base + 1, base + w + 1);
            }
        }
    }


    // top & bottom
    var indexOffset = positions.length / 3;
    var halfH = height * .5;
    for (var ci = 0; ci < numSegmentsW; ++ci) {
        var angle = ci * rcpNumSegmentsW * Math.PI * 2;
        var u = Math.sin(angle);
        var v = Math.cos(angle);
        var cx = u * radius;
        var cy = v * radius;

        u = -u * .5 + .5;
        v = v * .5 + .5;

        switch (alignment) {
            case HX.CylinderPrimitive.ALIGN_X:
                positions.push(halfH, cx, -cy);
                positions.push(-halfH, cx, -cy);

                if (normals) {
                    normals.push(1, 0, 0);
                    normals.push(-1, 0, 0);
                }

                if (uvs) {
                    uvs.push(v, 1.0 - u);
                    uvs.push(1.0 - v,  1.0 - u);
                }
                break;

            case HX.CylinderPrimitive.ALIGN_Y:
                positions.push(cx, -halfH, -cy);
                positions.push(cx, halfH, -cy);

                if (normals) {
                    normals.push(0, -1, 0);
                    normals.push(0, 1, 0);
                }

                if (uvs) {
                    uvs.push(u, v);
                    uvs.push(u, 1.0 - v);
                }
                break;

            //[ 1, 0,  0 ] [ x ] = [  x ]
            //[ 0, 0, -1 ] [ y ] = [ -z ]
            //[ 0, 1,  0 ] [ z ] = [  y ]
            case HX.CylinderPrimitive.ALIGN_Z:
                positions.push(cx, cy, -halfH);
                positions.push(cx, cy, halfH);

                if (normals) {
                    normals.push(0, 0, -1);
                    normals.push(0, 0, 1);
                }

                if (uvs) {
                    uvs.push(u, v);
                    uvs.push(1.0 - u, v);
                }
                break;
        }
    }

    for (var ci = 1; ci < numSegmentsW - 1; ++ci) {
        var offset = ci << 1;
        indices.push(indexOffset, indexOffset + offset, indexOffset + offset + 2);
        indices.push(indexOffset + 1, indexOffset + offset + 3, indexOffset + offset + 1);
    }
};