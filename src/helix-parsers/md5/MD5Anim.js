HX.MD5Anim = function()
{
    HX.AssetParser.call(this, HX.SkeletonClip);
    this._hierarchy = null;
    this._baseFrame = null;
    this._activeFrame = null;
    this._numJoints = 0;

    this._correctionQuad = new HX.Quaternion();
    this._correctionQuad.fromAxisAngle(HX.Float4.X_AXIS, -Math.PI *.5);
};

HX.MD5Anim.prototype = Object.create(HX.AssetParser.prototype);

HX.MD5Anim.prototype.parse = function(data, target)
{
    this._hierarchy = [];
    this._baseFrame = [];
    this._target = target;

    // assuming a valid file, validation isn't our job
    var lines = data.split("\n");
    var len = lines.length;
    var lineFunction = null;

    for (var i = 0; i < len; ++i) {
        // remove leading & trailing whitespace
        var line = lines[i].replace(/^\s+|\s+$/g, "");
        var tokens = line.split(/\s+/);

        if (tokens[0] === "//" || tokens[0] === "")
            continue;

        if (lineFunction) {
            lineFunction.call(this, tokens);
            if (tokens[0] === "}") lineFunction = null;
        }
        else switch (tokens[0]) {
            case "commandline":
            case "numFrames":
            case "MD5Version":
            case "numAnimatedComponents":
                break;
            case "numJoints":
                this._numJoints = parseInt(tokens[1]);
                break;
            case "frameRate":
                target.frameRate = parseInt(tokens[1]);
                break;
            case "hierarchy":
                lineFunction = this._parseHierarchy;
                break;
            case "bounds":
                lineFunction = this._parseBounds;
                break;
            case "baseframe":
                lineFunction = this._parseBaseFrame;
                break;
            case "frame":
                this._activeFrame = new HX.MD5Anim._FrameData();
                lineFunction = this._parseFrame;
                break;

        }
    }

    this._notifyComplete(target);
};

HX.MD5Anim.prototype._parseHierarchy = function(tokens)
{
    if (tokens[0] === "}") return;
    var data = new HX.MD5Anim._HierachyData();
    data.name = tokens[0].substring(1, tokens[0].length - 1);
    data.parent = parseInt(tokens[1]);
    data.flags = parseInt(tokens[2]);
    data.startIndex = parseInt(tokens[3]);
    this._hierarchy.push(data);
};

HX.MD5Anim.prototype._parseBounds = function(tokens)
{
    // don't do anything with bounds for now
};

HX.MD5Anim.prototype._parseBaseFrame = function(tokens)
{
    if (tokens[0] === "}") return;
    var baseFrame = new HX.MD5Anim._BaseFrameData();
    var pos = baseFrame.pos;
    pos.x = parseFloat(tokens[1]);
    pos.y = parseFloat(tokens[2]);
    pos.z = parseFloat(tokens[3]);
    var quat = baseFrame.quat;
    quat.x = parseFloat(tokens[6]);
    quat.y = parseFloat(tokens[7]);
    quat.z = parseFloat(tokens[8]);
    quat.w = 1.0 - quat.x*quat.x - quat.y*quat.y - quat.z*quat.z;
    if (quat.w < 0.0) quat.w = 0.0;
    else quat.w = -Math.sqrt(quat.w);
    this._baseFrame.push(baseFrame);
};

HX.MD5Anim.prototype._parseFrame = function(tokens)
{
    if (tokens[0] === "}") {
        this._translateFrame();
        return;
    }

    var len = tokens.length;
    for (var i = 0; i < len; ++i) {
        this._activeFrame.components.push(parseFloat(tokens[i]));
    }
};

HX.MD5Anim.prototype._translateFrame = function()
{
    var skeletonPose = new HX.SkeletonPose();

    for (var i = 0; i < this._numJoints; ++i) {
        var pose = new HX.SkeletonJointPose();
        var hierarchy = this._hierarchy[i];
        var base = this._baseFrame[i];
        var flags = hierarchy.flags;
        var pos = base.pos;
        var quat = base.quat;
        var comps = this._activeFrame.components;

        var j = hierarchy.startIndex;

        if (flags & 1) pos.x = comps[j];
        if (flags & 2) pos.y = comps[j+1];
        if (flags & 4) pos.z = comps[j+2];
        if (flags & 8) quat.x = comps[j+3];
        if (flags & 16) quat.y = comps[j+4];
        if (flags & 32) quat.z = comps[j+5];

        var w = 1.0 - quat.x * quat.x - quat.y * quat.y - quat.z * quat.z;
        quat.w = w < 0.0 ? 0.0 : -Math.sqrt(w);

        // transform root joints only
        if (hierarchy.parent < 0) {
            pose.orientation.multiply(this._correctionQuad, quat);
            pose.translation = this._correctionQuad.rotate(pos);
        }
        else {
            pose.orientation.copyFrom(quat);
            pose.translation.copyFrom(pos);
        }

        //pose.orientation.y = -pose.orientation.y;
        //pose.orientation.z = -pose.orientation.z;
        //pose.translation.x = -pose.translation.x;

        skeletonPose.jointPoses.push(pose);
    }

    this._target.addFrame(skeletonPose);
};

HX.MD5Anim._HierachyData = function()
{
    this.name = null;
    this.parent = -1;
    this.flags = 0;
    this.startIndex = 0;
};

HX.MD5Anim._BaseFrameData = function()
{
    this.pos = new HX.Float4();
    this.quat = new HX.Quaternion();
};

HX.MD5Anim._FrameData = function()
{
    this.components = [];
}