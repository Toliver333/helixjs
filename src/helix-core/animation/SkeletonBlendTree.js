/**
 *
 * @constructor
 */
HX.SkeletonBlendTree = function(rootNode, skeleton)
{
    this._skeleton = skeleton;
    this._rootNode = rootNode;
    this._matrices = null;
    this._globalPose = new HX.SkeletonPose();
    if (skeleton) this.skeleton = skeleton;
};

HX.SkeletonBlendTree.prototype =
{
    get skeleton() { return this._skeleton; },
    set skeleton(value)
    {
        this._skeleton = value;
        this._matrices = [];
        for (var i = 0; i < value.numJoints; ++i) {
            this._matrices[i] = new HX.Matrix4x4();
            this._globalPose.jointPoses[i] = new HX.SkeletonJointPose();
        }

    },

    get rootJointDeltaPosition() { return this._rootNode.rootJointDeltaPosition; },

    get rootNode() { return this._rootNode; },
    set rootNode(value) { this._rootNode = value; },

    get matrices() { return this._matrices; },

    update: function(dt)
    {
        if (this._rootNode.update(dt)) {
            this._updateGlobalPose();
            this._updateMatrices();
            return true;
        }
        return false;
    },

    _updateGlobalPose: function()
    {
        var skeleton = this._skeleton;
        var numJoints = skeleton.numJoints;
        var rootPose = this._rootNode._pose.jointPoses;
        var globalPose = this._globalPose.jointPoses;

        var p = new HX.Matrix4x4();
        var c = new HX.Matrix4x4();
        var pp = new HX.Transform();
        var cc = new HX.Transform();
        var sc = new HX.Float4();

        for (var i = 0; i < numJoints; ++i) {
            var localJointPose = rootPose[i];
            var globalJointPose = globalPose[i];
            var joint = skeleton.getJoint(i);

            if (joint.parentIndex < 0)
                globalJointPose.copyFrom(localJointPose);
            else {
                // this doesn't seem to work for MD5, but it should
                var parentPose = globalPose[joint.parentIndex];
                pp.position.copyFrom(parentPose.position);
                pp.rotation.copyFrom(parentPose.rotation);
                pp.scale.set(parentPose.scale, parentPose.scale, parentPose.scale);
                cc.position.copyFrom(localJointPose.position);
                cc.rotation.copyFrom(localJointPose.rotation);
                cc.scale.set(localJointPose.scale, localJointPose.scale, localJointPose.scale);
                p.compose(pp);
                c.compose(cc);
                c.append(p);

                /*var gTr = globalJointPose.position;
                var ptr = parentPose.position;
                var pQuad = parentPose.rotation;
                pQuad.rotate(localJointPose.position, gTr);
                gTr.x += ptr.x;
                gTr.y += ptr.y;
                gTr.z += ptr.z;
                globalJointPose.rotation.multiply(pQuad, localJointPose.rotation);
                globalJointPose.scale = parentPose.scale * localJointPose.scale;*/

                c.decompose(globalJointPose.position, globalJointPose.rotation, sc);
                //globalJointPose.scale = sc.x;
            }
        }
    },

    _updateMatrices: function()
    {
        var len = this._skeleton.numJoints;
        var matrices = this._matrices;
        var poses = this._globalPose.jointPoses;
        var skeleton = this._skeleton;
        for (var i = 0; i < len; ++i) {
            var pose = poses[i];
            var mtx = matrices[i];
            mtx.copyFrom(skeleton.getJoint(i).inverseBindPose);

            var sc = pose.scale;
            mtx.appendScale(sc, sc, sc);
            mtx.appendQuaternion(pose.rotation);
            mtx.appendTranslation(pose.position);
        }
    }
};
