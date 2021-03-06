import {GL} from "../core/GL";

// @author derschmale <http://www.derschmale.com>

/**
 * @param renderer The actual renderer doing the rendering.
 * @param passType
 * @param renderItems
 * @param data (optional) depending on the type of pass being rendered, data could contain extra stuff to be injected
 * For example. Dynamic dir lights will use this
 * @returns The index for the first unrendered renderItem in the list
 * @ignore
 */
export function renderPass(renderer, camera, passType, renderItems, data)
{
    var len = renderItems.length;
    var activePass = null;
    var lastMesh = null;

    for(var i = 0; i < len; ++i) {
        var renderItem = renderItems[i];
        var material = renderItem.material;
        var pass = material.getPass(passType);
        if (!pass) continue;
        var meshInstance = renderItem.meshInstance;

        if (pass !== activePass) {
            pass.updatePassRenderState(camera, renderer, data);
            activePass = pass;
            lastMesh = null;    // need to reset mesh data too
        }

        // make sure renderstate is propagated
        pass.updateInstanceRenderState(camera, renderItem, data);

        if (lastMesh !== meshInstance._mesh) {
            meshInstance.updateRenderState(passType);
            lastMesh = meshInstance._mesh;
        }

        var mesh = meshInstance._mesh;
        GL.drawElements(mesh.elementType, mesh._numIndices, 0, mesh._indexType);
    }

    GL.setBlendState(null);
    return len;
}