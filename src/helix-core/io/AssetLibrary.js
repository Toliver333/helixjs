import {Signal} from "../core/Signal";
import {AssetLoader} from "./AssetLoader";

/**
 * @constructor
 * @param {string} basePath The base path or url to load the assets from. All filenames will have this value prepended.
 * @param {string} [crossOrigin] An optional cross origin string. This is used when loading images from a different domain.
 *
 * @classdesc
 * AssetLibrary provides a way to load a collection of assets. These can be textures, models, plain text, json, ...
 * Assets need to be queued with a given ID and loading starts when requested. When loading completes, the ID can be used
 * to retrieve the loaded asset.
 *
 * @example
 * var assetLibrary = new AssetLibrary("assets/");
 * assetLibrary.queueAsset("some-model", "models/some-model.obj", HX.AssetLibrary.Type.ASSET, HX.OBJ);
 * assetLibrary.queueAsset("some-texture", "textures/some_texture.png", HX.AssetLibrary.Type.ASSET, HX.PNG);
 * assetLibrary.onComplete.bind(onAssetsLoaded);
 * assetLibrary.onProgress.bind(onAssetsProgress);
 * assetLibrary.load();
 *
 * function onAssetsLoaded()
 * {
 * // do something
 * }
 *
 * function onAssetsProgress(ratio)
 * {
 *      var percent = ratio * 100
 * }
 *
 * @author derschmale <http://www.derschmale.com>
 */

function AssetLibrary(basePath, crossOrigin)
{
    this._numLoaded = 0;
    this._queue = [];
    this._assets = {};
    if (basePath && basePath.charAt(basePath.length - 1) !== "/") basePath += "/";
    this._basePath = basePath || "";
    this._onComplete = new Signal(/* void */);
    this._onProgress = new Signal(/* number */);
    this._crossOrigin = crossOrigin;
}

/**
 * The type of asset to load. For example: <code>AssetLibrary.Type.JSON</code> for a JSON object.
 * @enum
 */
AssetLibrary.Type = {
    /**
     * A JSON data object.
     */
    JSON: 0,

    /**
     * An asset.
     */
    ASSET: 1,

    /**
     * A plain text file.
     */
    PLAIN_TEXT: 2
};

AssetLibrary.prototype =
{
    /**
     * The {@linkcode Signal} dispatched when all assets have completed loading. Its payload object is a reference to
     * the assetLibrary itself.
     * @see {@linkcode Signal}.
     */
    get onComplete()
    {
        return this._onComplete;
    },

    /**
     * The {@linkcode Signal} dispatched when all assets have completed loading. Its payload is the ratio of loaded
     * objects for 0 to 1.
     * @see {@linkcode Signal}
     */
    get onProgress()
    {
        return this._onProgress;
    },

    /**
     * The base path relative to which all the filenames are defined. This value is set in the constructor.
     */
    get basePath()
    {
        return this._basePath;
    },

    /**
     * The cross origin string passed to the constructor.
     */
    get crossOrigin()
    {
        return this._crossOrigin;
    },

    /**
     * Adds an asset to the loading queue.
     * @param {string} id The ID that will be used to retrieve the asset when loaded.
     * @param {string} filename The filename relative to the base path provided in the constructor.
     * @param {AssetLibrary.Type} type The type of asset to be loaded.
     * @param {parser} The parser used to parse the loaded data.
     * @param {target} An optional empty target to contain the parsed asset. This allows lazy loading.
     * @see {@linkcode AssetLibrary.Type}
     */
    queueAsset: function(id, filename, type, parser, target)
    {
        this._queue.push({
            id: id,
            filename: this._basePath + filename,
            type: type,
            parser: parser,
            target: target
        });
    },

    /**
     * Start loading all the assets. Every time a single asset finished loading, <code>onProgress</code> is dispatched.
     * When all assets have finished loading, <code>onComplete</code> is dispatched.
     */
    load: function()
    {
        if (this._queue.length === 0) {
            this.onComplete.dispatch();
            return;
        }

        var asset = this._queue[this._numLoaded];

        switch (asset.type) {
            case AssetLibrary.Type.JSON:
                this._json(asset.filename, asset.id);
                break;
            case AssetLibrary.Type.PLAIN_TEXT:
                this._plainText(asset.filename, asset.id);
                break;
            case AssetLibrary.Type.ASSET:
                this._asset(asset.filename, asset.id, asset.parser, asset.target);
                break;
            default:
                throw new Error("Unknown asset type " + asset.type + "!");
        }
    },

    /**
     * Retrieves a loaded asset from the asset library. This method should only be called once <code>onComplete</code>
     * has been dispatched.
     * @param {string} id The ID assigned to the loaded asset when calling <code>queueAsset</code>
     * @returns {*} The loaded asset.
     */
    get: function(id) { return this._assets[id]; },

    _json: function(file, id)
    {
        var self = this;
        var loader = new XMLHttpRequest();
        loader.overrideMimeType("application/json");
        loader.open('GET', file, true);
        loader.onreadystatechange = function()
        {
            if (loader.readyState === 4 && loader.status === 200) {
                self._assets[id] = JSON.parse(loader.responseText);
                self._onAssetLoaded();
            }
        };
        loader.send(null);
    },

    _plainText: function(file, id)
    {
        var self = this;
        var loader = new XMLHttpRequest();
        loader.overrideMimeType("application/json");
        loader.open('GET', file, true);
        loader.onreadystatechange = function()
        {
            if (loader.readyState === 4 && loader.status === 200) {
                self._assets[id] = loader.responseText;
                self._onAssetLoaded();
            }
        };

        loader.send(null);
    },

    _asset: function(file, id, parser, target)
    {
        var loader = new AssetLoader(parser);
        loader.options = loader.options || {};
        loader.options.crossOrigin = this._crossOrigin;
        loader.onComplete.bind(function()
        {
            this._onAssetLoaded();
        }, this);

        this._assets[id] = loader.load(file, target);
    },

    _onAssetLoaded: function()
    {
        this._onProgress.dispatch(this._numLoaded / this._queue.length);

        if (++this._numLoaded === this._queue.length)
            this._onComplete.dispatch(this);
        else
            this.load();
    }
};

export { AssetLibrary };