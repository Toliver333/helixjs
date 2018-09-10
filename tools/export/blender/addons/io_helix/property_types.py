# see loaders/HX.js for the values that are expected for each type

# common properties
NULL = 0
NAME = 1
URL = 2
CAST_SHADOWS = 3
COLOR = 4
COLOR_ALPHA = 5

# header (meta) properties
VERSION = 10
GENERATOR = 11
PAD_ARRAYS = 12
DEFAULT_SCENE_INDEX = 13
LIGHTING_MODE = 14

# mesh properties
NUM_VERTICES = 20
NUM_INDICES = 21
ELEMENT_TYPE = 22
INDEX_TYPE = 23
INDEX_DATA = 24
VERTEX_ATTRIBUTE = 25
VERTEX_STREAM_DATA = 26

# scene node / entity properties
POSITION = 30
ROTATION = 31
SCALE = 32
VISIBLE = 33

# light properties
INTENSITY = 40
RADIUS = 41
SPOT_ANGLES = 42

# texture properties
WRAP_MODE = 50
FILTER = 51

# material properties
# COLOR = 4
USE_VERTEX_COLORS = 60
ALPHA = 61
EMISSIVE_COLOR = 62
SPECULAR_MAP_MODE = 63
METALLICNESS = 64
SPECULAR_REFLECTANCE = 65
ROUGHNESS = 66
ROUGHNESS_RANGE = 67
ALPHA_THRESHOLD = 68
LIGHTING_MODEL = 69
CULL_MODE = 70
BLEND_STATE = 71
WRITE_DEPTH = 72
WRITE_COLOR = 73

# blend state properties
BLEND_STATE_SRC_FACTOR = 80
BLEND_STATE_DST_FACTOR = 81
BLEND_STATE_OPERATOR = 82
BLEND_STATE_SRC_FACTOR_ALPHA = 83
BLEND_STATE_DST_FACTOR_ALPHA = 84
BLEND_STATE_OPERATOR_ALPHA = 85

# camera properties
CLIP_DISTANCES = 90
FOV = 91

# skeleton / bone properties
INVERSE_BIND_POSE = 100