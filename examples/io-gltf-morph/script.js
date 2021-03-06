/**
 * @author derschmale <http://www.derschmale.com>
 */

var project = new DemoProject();

window.onload = function ()
{
    var options = new HX.InitOptions();
    options.hdr = true;
    options.defaultLightingModel = HX.LightingModel.GGX_FULL;
    project.init(document.getElementById('webglContainer'), options);
};

project.queueAssets = function(assetLibrary)
{
    assetLibrary.queueAsset("scene", "AnimatedMorphCube/AnimatedMorphCube.gltf", HX.AssetLibrary.Type.ASSET, HX_IO.GLTF);
    assetLibrary.queueAsset("skybox", "skyboxes/river_rocks/river_rocks_1k.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG, {equiToCube: true});
	assetLibrary.queueAsset("irradiance", "skyboxes/river_rocks/river_rocks_sh.ash", HX.AssetLibrary.Type.ASSET, HX.ASH);
};

project.onInit = function()
{
    this.gltf = this.assetLibrary.get("scene");
    this.scene = this.gltf.defaultScene;

    this.camera.nearDistance = .1;
    this.camera.farDistance = 3000.0;

    var orbitController = new OrbitController();
    orbitController.azimuth = -0.5;
    orbitController.minRadius = .02;
    orbitController.maxRadius = 5000;
    orbitController.zoomSpeed = .1;
    orbitController.touchZoomSpeed = .01;
    orbitController.radius = 3;
    this.camera.addComponent(orbitController);

	var dirLight = new HX.Entity(new HX.DirectionalLight());
	this.scene.attach(dirLight);

    var skyboxTexture = this.assetLibrary.get("skybox");
    var irradianceTexture = this.assetLibrary.get("irradiance");

    // use it as skybox
    var skybox = new HX.Skybox(skyboxTexture);
    this.scene.skybox = skybox;

    var bloom = new HX.Bloom(100);
    bloom.thresholdLuminance = 1.0;
    this.camera.addComponent(bloom);

    // use the same texture as environment map
    var lightProbe = new HX.LightProbe(irradianceTexture, skyboxTexture);
    this.scene.attach(new HX.Entity(lightProbe));
};