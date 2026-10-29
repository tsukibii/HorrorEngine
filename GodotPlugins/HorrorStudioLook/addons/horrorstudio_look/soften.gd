## The softener (docs/VHS.md §5, the camhybrid tape): the picture soft by distance, almost sharp up close. A
## CompositorEffect run after the transparents (so the little things' digits, LEDs, steam and glows are softened
## with the room instead of painted over: a full-screen quad reading the screen texture lost them, the user's
## report of 2026-10-29): a compute pass blurring the camera's colour buffer by each pixel's depth, into a scratch
## texture and back. `HSSoften.attach(camera)` puts one on the camera's compositor; `set_amounts(near_m, far_m,
## soft, least)`; `HSSoften.detach(camera)` takes it off. A mirror's or a slot's camera has no compositor: untouched.
class_name HSSoften
extends CompositorEffect

const GLSL := """
#version 450
layout(local_size_x = 8, local_size_y = 8, local_size_z = 1) in;
layout(rgba16f, set = 0, binding = 0) uniform restrict writeonly image2D dst;
layout(set = 0, binding = 1) uniform sampler2D src;
layout(set = 0, binding = 2) uniform sampler2D depth_tex;
layout(push_constant, std430) uniform Params {
	vec2 size;
	float near_m;
	float far_m;
	float soft;
	float least;
	float znear;
	float zfar;
	float copy;
	float pad0;
	float pad1;
	float pad2;
} p;

void main() {
	ivec2 xy = ivec2(gl_GlobalInvocationID.xy);
	if (xy.x >= int(p.size.x) || xy.y >= int(p.size.y)) {
		return;
	}
	vec2 uv = (vec2(xy) + 0.5) / p.size;
	if (p.copy > 0.5 && p.copy < 1.5) {
		imageStore(dst, xy, texture(src, uv));
		return;
	}
	float d = texture(depth_tex, uv).r;                                   // reversed: 1 at the near plane, 0 at the far
	float lin = p.znear * p.zfar / max(p.znear + d * (p.zfar - p.znear), 1e-5);
	if (p.copy > 2.5) {                                                   // the raw depth (debug), ten times
		imageStore(dst, xy, vec4(vec3(d * 10.0), 1.0));
		return;
	}
	if (p.copy > 1.5) {                                                   // the depth view (debug): metres as grey, 10 m white
		imageStore(dst, xy, vec4(vec3(lin / 10.0), 1.0));
		return;
	}
	float k = smoothstep(p.near_m, p.far_m, lin);
	float r = mix(p.least, p.soft, k);
	vec2 px = r / p.size;
	vec4 c0 = texture(src, uv);
	vec3 c = c0.rgb * 0.28;
	c += texture(src, uv + vec2(px.x, 0.0)).rgb * 0.12;
	c += texture(src, uv - vec2(px.x, 0.0)).rgb * 0.12;
	c += texture(src, uv + vec2(0.0, px.y)).rgb * 0.12;
	c += texture(src, uv - vec2(0.0, px.y)).rgb * 0.12;
	c += texture(src, uv + px).rgb * 0.06;
	c += texture(src, uv - px).rgb * 0.06;
	c += texture(src, uv + vec2(px.x, -px.y)).rgb * 0.06;
	c += texture(src, uv - vec2(px.x, -px.y)).rgb * 0.06;
	imageStore(dst, xy, vec4(c, c0.a));
}
"""

var near_m := 0.9
var far_m := 7.0
var soft := 1.6
var least := 0.25
var rd: RenderingDevice
var shader: RID
var pipeline: RID
var sampler: RID
var ready_ := false
var complained := false
var frames := 0                 # the passes run (the checks read it)
var debug := 0                  # 2: the depth view instead of the blur (metres as grey); 3: the raw depth
var cam_near := 0.05            # the camera's planes, read on the main thread each frame (attach gives the camera)
var cam_far := 4000.0
var camera: Camera3D = null
var seen := {}                  # znear, zfar, size, format (the checks read it)


static func attach(cam: Camera3D) -> HSSoften:
	if cam.compositor == null:
		cam.compositor = Compositor.new()
	for e in cam.compositor.compositor_effects:
		if e is HSSoften:
			return e
	var s := HSSoften.new()
	s.camera = cam
	s.cam_near = cam.near
	s.cam_far = cam.far
	var fx: Array = cam.compositor.compositor_effects.duplicate()
	fx.append(s)
	cam.compositor.compositor_effects = fx
	return s


static func detach(cam: Camera3D) -> void:
	if cam == null or cam.compositor == null:
		return
	var fx: Array = cam.compositor.compositor_effects.filter(func(e): return not (e is HSSoften))
	cam.compositor.compositor_effects = fx


static func on(cam: Camera3D) -> HSSoften:
	if cam == null or cam.compositor == null:
		return null
	for e in cam.compositor.compositor_effects:
		if e is HSSoften:
			return e
	return null


func _init() -> void:
	effect_callback_type = CompositorEffect.EFFECT_CALLBACK_TYPE_POST_TRANSPARENT
	rd = RenderingServer.get_rendering_device()
	if rd != null:
		RenderingServer.call_on_render_thread(_build)


func set_amounts(near_m_: float, far_m_: float, soft_: float, least_: float = 0.25) -> void:
	near_m = near_m_
	far_m = far_m_
	soft = soft_
	least = least_


func _build() -> void:
	var src := RDShaderSource.new()
	src.source_compute = GLSL
	var spirv := rd.shader_compile_spirv_from_source(src)
	if spirv.compile_error_compute != "":
		push_error("HSSoften: " + spirv.compile_error_compute)
		return
	shader = rd.shader_create_from_spirv(spirv)
	if not shader.is_valid():
		return
	pipeline = rd.compute_pipeline_create(shader)
	var ss := RDSamplerState.new()
	ss.min_filter = RenderingDevice.SAMPLER_FILTER_LINEAR
	ss.mag_filter = RenderingDevice.SAMPLER_FILTER_LINEAR
	ss.repeat_u = RenderingDevice.SAMPLER_REPEAT_MODE_CLAMP_TO_EDGE
	ss.repeat_v = RenderingDevice.SAMPLER_REPEAT_MODE_CLAMP_TO_EDGE
	sampler = rd.sampler_create(ss)
	ready_ = pipeline.is_valid()


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and rd != null:
		if shader.is_valid():
			rd.free_rid(shader)              # the pipeline goes with it
		if sampler.is_valid():
			rd.free_rid(sampler)


func _render_callback(type: int, data: RenderData) -> void:
	if not ready_ or type != CompositorEffect.EFFECT_CALLBACK_TYPE_POST_TRANSPARENT:
		return
	if camera != null and is_instance_valid(camera):
		cam_near = camera.near
		cam_far = camera.far
	var buffers: RenderSceneBuffersRD = data.get_render_scene_buffers()
	if buffers == null:
		return
	var size: Vector2i = buffers.get_internal_size()
	var fmt: int = rd.texture_get_format(buffers.get_color_layer(0)).format
	if fmt != RenderingDevice.DATA_FORMAT_R16G16B16A16_SFLOAT:          # the shader writes rgba16f, Forward+'s colour buffer
		if not complained:
			complained = true
			push_warning("HSSoften: the colour buffer isn't RGBA16F (%d): no softening" % fmt)
		return
	if size.x < 1 or size.y < 1:
		return
	var usage := RenderingDevice.TEXTURE_USAGE_SAMPLING_BIT | RenderingDevice.TEXTURE_USAGE_STORAGE_BIT
	if not buffers.has_texture("HSSoften", "scratch"):
		buffers.create_texture("HSSoften", "scratch", RenderingDevice.DATA_FORMAT_R16G16B16A16_SFLOAT, usage, RenderingDevice.TEXTURE_SAMPLES_1, size, 1, 1, true, false)
	var scratch: RID = buffers.get_texture("HSSoften", "scratch")
	var znear: float = cam_near                                            # the camera's own: the compositor's projection (reversed Z) won't say
	var zfar: float = cam_far
	seen = {"znear": znear, "zfar": zfar, "size": size, "format": fmt, "views": buffers.get_view_count()}
	var groups := Vector3i((size.x - 1) / 8 + 1, (size.y - 1) / 8 + 1, 1)
	for view in buffers.get_view_count():
		var color: RID = buffers.get_color_layer(view)
		var depth: RID = buffers.get_depth_layer(view)
		# pass 1: the colour read, blurred by depth, into the scratch; pass 2: the scratch back into the colour
		_dispatch(_uniforms(scratch, color, depth), size, znear, zfar, float(debug) if debug > 0 else 0.0, groups)
		_dispatch(_uniforms(color, scratch, depth), size, znear, zfar, 1.0, groups)
	frames += 1


func _uniforms(dst: RID, src: RID, depth: RID) -> RID:
	var u0 := RDUniform.new()
	u0.uniform_type = RenderingDevice.UNIFORM_TYPE_IMAGE
	u0.binding = 0
	u0.add_id(dst)
	var u1 := RDUniform.new()
	u1.uniform_type = RenderingDevice.UNIFORM_TYPE_SAMPLER_WITH_TEXTURE
	u1.binding = 1
	u1.add_id(sampler)
	u1.add_id(src)
	var u2 := RDUniform.new()
	u2.uniform_type = RenderingDevice.UNIFORM_TYPE_SAMPLER_WITH_TEXTURE
	u2.binding = 2
	u2.add_id(sampler)
	u2.add_id(depth)
	return UniformSetCacheRD.get_cache(shader, 0, [u0, u1, u2])


func _dispatch(uset: RID, size: Vector2i, znear: float, zfar: float, mode: float, groups: Vector3i) -> void:
	var push := PackedFloat32Array([float(size.x), float(size.y), near_m, far_m, soft, least, znear, zfar, mode, 0.0, 0.0, 0.0]).to_byte_array()
	var cl := rd.compute_list_begin()
	rd.compute_list_bind_compute_pipeline(cl, pipeline)
	rd.compute_list_bind_uniform_set(cl, uset, 0)
	rd.compute_list_set_push_constant(cl, push, push.size())
	rd.compute_list_dispatch(cl, groups.x, groups.y, groups.z)
	rd.compute_list_end()
