/**
 * @author derschmale <http://www.derschmale.com>
 */

var project = new DemoProject();

project.queueAssets = function(assetLibrary)
{
    assetLibrary.queueAsset("skybox-specular", "skyboxes/river_rocks/river_rocks_1k.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG_EQUIRECTANGULAR);
    assetLibrary.queueAsset("skybox-irradiance", "skyboxes/river_rocks/river_rocks_irradiance.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG_EQUIRECTANGULAR);
    assetLibrary.queueAsset("floor-albedo", "crytek-sponza/textures_pbr/Sponza_Ceiling_diffuse.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG);
    assetLibrary.queueAsset("floor-normals", "crytek-sponza/textures_pbr/Sponza_Ceiling_normal.png", HX.AssetLibrary.Type.ASSET, HX.JPG);
    assetLibrary.queueAsset("floor-specular", "crytek-sponza/textures_pbr/Sponza_Ceiling_roughness.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG);
};

project.onInit = function()
{
    this.scene.startSystem(new HX.PhysicsSystem());
    initCamera(this.camera);
    initScene(this.scene, this.assetLibrary);
};

window.onload = function ()
{
    var options = new HX.InitOptions();
    options.maxSkeletonJoints = 39;
    options.useSkinningTexture = true;
    options.defaultLightingModel = HX.LightingModel.GGX;
    options.ambientOcclusion = new HX.SSAO();
    options.ambientOcclusion.radius = 4.0;
    options.ambientOcclusion.fallOffDistance = 6.0;
    project.init(document.getElementById('webglContainer'), options);
};

function initCamera(camera)
{
    camera.nearDistance = .3;
    camera.farDistance = 20.0;

    var orbitController = new HX.OrbitController();
    orbitController.lookAtTarget.y = 1.2;
    orbitController.speed = 10.0;
    orbitController.radius = 5.0;
    orbitController.maxRadius = 100.0;
    camera.addComponent(orbitController);
}

function initScene(scene, assetLibrary)
{
    var skyboxSpecularTexture = assetLibrary.get("skybox-specular");
    var skyboxIrradianceTexture = assetLibrary.get("skybox-irradiance");

    var lightProbe = new HX.LightProbe(skyboxIrradianceTexture, skyboxSpecularTexture);
    scene.attach(lightProbe);

    var light = new HX.DirectionalLight();
    scene.attach(light);

    var lights = [lightProbe, light];

    // textures are from http://www.alexandre-pestana.com/pbr-textures-sponza/
    var material = new HX.BasicMaterial();
    material.colorMap = assetLibrary.get("floor-albedo");
    material.normalMap = assetLibrary.get("floor-normals");
    material.specularMap = assetLibrary.get("floor-specular");
    material.fixedLights = lights;

    var primitive = new HX.PlanePrimitive(
        {
            numSegmentsW: 10,
            numSegmentsH: 10,
            width: 50,
            height: 50,
            scaleU: 50,
            scaleV: 50
        });

    var floorInstance = new HX.ModelInstance(primitive, material);
    var collider = new HX.RigidBodyComponent(HX.RigidBodyComponent.TYPE_INFINITE_PLANE);
    collider.mass = 0;
    floorInstance.addComponent(collider);
    scene.attach(floorInstance);


    // top level of specular texture is the original skybox texture
    var skybox = new HX.Skybox(skyboxSpecularTexture);
    scene.skybox = skybox;


    material = new HX.BasicMaterial();
    material.fixedLights = lights;
    primitive = new HX.SpherePrimitive({radius: .25});

    for (var x = -1; x <= 1; ++x) {
        for (var y = 0; y < 10; ++y) {
            for (var z = -1; z <= 1; ++z) {
                var modelInstance = new HX.ModelInstance(primitive, material);

                modelInstance.position.set(x + Math.random() - .5, 1.0 + y * 2.0, z + Math.random() - .5);

                collider = new HX.RigidBodyComponent();
                collider.linearDamping = .2;
                collider.angularDamping = .2;
                modelInstance.addComponent(collider);

                scene.attach(modelInstance);
            }
        }
    }
}