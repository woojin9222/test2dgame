extends Node2D

const TILE_SIZE := 32
const MAP_WIDTH := 80
const MAP_HEIGHT := 60

const NUM_TREES  := 220
const NUM_ROCKS  := 110
const NUM_COLONISTS := 3

var world: World
var camera: Camera2D
var hud: CanvasLayer

var selected_colonist: Colonist = null

# Camera panning state
var _panning: bool = false
var _pan_start_mouse: Vector2
var _pan_start_cam: Vector2

# Selection highlight
var _hover_tile: Vector2i = Vector2i(-1, -1)

func _ready() -> void:
	_create_camera()
	_create_world()
	_spawn_resources()
	_spawn_colonists()
	_create_hud()

# ─── Scene construction ──────────────────────────────────────────────

func _create_camera() -> void:
	camera = Camera2D.new()
	camera.name = "Camera"
	camera.position = Vector2(MAP_WIDTH * TILE_SIZE / 2.0, MAP_HEIGHT * TILE_SIZE / 2.0)
	camera.zoom = Vector2(1.6, 1.6)
	add_child(camera)

func _create_world() -> void:
	world = World.new()
	world.name = "World"
	add_child(world)

func _spawn_resources() -> void:
	var res_root := Node2D.new()
	res_root.name = "Resources"
	world.add_child(res_root)

	# Trees on grass tiles
	var tree_count := 0
	var attempts := 0
	while tree_count < NUM_TREES and attempts < NUM_TREES * 5:
		attempts += 1
		var x := randi_range(1, MAP_WIDTH - 2)
		var y := randi_range(1, MAP_HEIGHT - 2)
		if world.get_tile(x, y) == World.TileType.GRASS and world.is_walkable(x, y):
			var node := _make_resource(ResourceNode.ResourceType.TREE, x, y)
			res_root.add_child(node)
			world.add_resource_node(node)
			tree_count += 1

	# Rocks on stone tiles
	var rock_count := 0
	attempts = 0
	while rock_count < NUM_ROCKS and attempts < NUM_ROCKS * 5:
		attempts += 1
		var x := randi_range(1, MAP_WIDTH - 2)
		var y := randi_range(1, MAP_HEIGHT - 2)
		var tile := world.get_tile(x, y)
		if (tile == World.TileType.STONE or tile == World.TileType.DEEP_STONE) and world.is_walkable(x, y):
			var node := _make_resource(ResourceNode.ResourceType.ROCK, x, y)
			res_root.add_child(node)
			world.add_resource_node(node)
			rock_count += 1

func _make_resource(type: ResourceNode.ResourceType, tx: int, ty: int) -> ResourceNode:
	var node := ResourceNode.new()
	node.resource_type = type
	node.position = Vector2(tx * TILE_SIZE + TILE_SIZE * 0.5, ty * TILE_SIZE + TILE_SIZE * 0.5)
	node.died.connect(_on_resource_died)
	return node

func _spawn_colonists() -> void:
	var col_root := Node2D.new()
	col_root.name = "Colonists"
	world.add_child(col_root)

	var cx := MAP_WIDTH / 2
	var cy := MAP_HEIGHT / 2

	var names := ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank"]
	var colors := [
		Color.CYAN, Color.YELLOW, Color(1.0, 0.5, 1.0),
		Color.ORANGE, Color.LIGHT_GREEN, Color.TOMATO
	]

	for i in NUM_COLONISTS:
		var tx := cx + randi_range(-4, 4)
		var ty := cy + randi_range(-4, 4)
		# Ensure walkable
		if not world.is_walkable(tx, ty):
			tx = cx
			ty = cy

		var col := Colonist.new()
		col.colonist_name = names[i % names.size()]
		col.body_color = colors[i % colors.size()]
		col.position = Vector2(tx * TILE_SIZE + TILE_SIZE * 0.5, ty * TILE_SIZE + TILE_SIZE * 0.5)
		col.world_ref = world
		col_root.add_child(col)
		world.colonists.append(col)

	GameManager.total_colonists = NUM_COLONISTS

func _create_hud() -> void:
	hud = load("res://scripts/ui/HUD.gd").new()
	hud.name = "HUD"
	add_child(hud)
	hud.setup(world)

# ─── Input ───────────────────────────────────────────────────────────

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		_handle_mouse_button(event)
	elif event is InputEventMouseMotion:
		if _panning:
			var delta := event.position - _pan_start_mouse
			camera.position = _pan_start_cam - delta / camera.zoom

func _handle_mouse_button(event: InputEventMouseButton) -> void:
	match event.button_index:
		MOUSE_BUTTON_MIDDLE:
			_panning = event.pressed
			if event.pressed:
				_pan_start_mouse = event.position
				_pan_start_cam = camera.position

		MOUSE_BUTTON_WHEEL_UP:
			camera.zoom = (camera.zoom * 1.12).clamp(Vector2(0.25, 0.25), Vector2(4.0, 4.0))

		MOUSE_BUTTON_WHEEL_DOWN:
			camera.zoom = (camera.zoom * 0.89).clamp(Vector2(0.25, 0.25), Vector2(4.0, 4.0))

		MOUSE_BUTTON_LEFT:
			if event.pressed:
				_handle_left_click()

		MOUSE_BUTTON_RIGHT:
			if event.pressed:
				_handle_right_click()

func _handle_left_click() -> void:
	var world_pos := get_global_mouse_position()

	# Try to select a colonist
	for col in world.colonists:
		if not is_instance_valid(col):
			continue
		if col.position.distance_to(world_pos) < 14.0:
			selected_colonist = col
			if hud:
				(hud as Node).call("show_colonist_info", col)
			return

	# Deselect
	selected_colonist = null
	if hud:
		(hud as Node).call("hide_colonist_info")

func _handle_right_click() -> void:
	var world_pos := get_global_mouse_position()

	# Find nearest resource node within click range
	var best_dist := 22.0
	var best_node: ResourceNode = null
	for res in world.resource_nodes:
		if not is_instance_valid(res):
			continue
		var d := (res as Node2D).position.distance_to(world_pos)
		if d < best_dist:
			best_dist = d
			best_node = res

	if best_node != null:
		world.designate_resource(best_node)
		if hud:
			var msg := "Designated" if best_node.is_designated else "Cancelled"
			(hud as Node).call("show_tooltip", msg + ": " + (
				"Chop tree" if best_node.resource_type == ResourceNode.ResourceType.TREE
				else "Mine rock"
			))
			# Hide tooltip after 2 seconds
			var timer := get_tree().create_timer(2.0)
			timer.timeout.connect(func(): if is_instance_valid(hud): (hud as Node).call("hide_tooltip"))

# ─── Camera WASD/arrow key movement ─────────────────────────────────

func _process(delta: float) -> void:
	_camera_keyboard(delta)

func _camera_keyboard(delta: float) -> void:
	var dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):    dir.y -= 1
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):  dir.y += 1
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):  dir.x -= 1
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT): dir.x += 1

	if dir != Vector2.ZERO:
		var speed := 400.0 / camera.zoom.x
		camera.position += dir.normalized() * speed * delta

# ─── Callbacks ───────────────────────────────────────────────────────

func _on_resource_died(node: ResourceNode) -> void:
	world.remove_resource_node(node)
