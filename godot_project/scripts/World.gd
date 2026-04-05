class_name World
extends Node2D

const TILE_SIZE := 32
const MAP_WIDTH := 80
const MAP_HEIGHT := 60

enum TileType {
	GRASS = 0,
	DIRT = 1,
	STONE = 2,
	DEEP_STONE = 3,
	WATER = 4
}

const TILE_COLORS: Dictionary = {
	0: Color(0.30, 0.58, 0.20),  # GRASS
	1: Color(0.58, 0.44, 0.28),  # DIRT
	2: Color(0.52, 0.52, 0.54),  # STONE
	3: Color(0.30, 0.30, 0.34),  # DEEP_STONE
	4: Color(0.20, 0.40, 0.78)   # WATER
}

var tile_map: Array = []
var astar: AStarGrid2D
var resource_nodes: Array = []
var colonists: Array = []
var designated_tiles: Dictionary = {}

signal resource_designated(tile_pos: Vector2i)

func _ready() -> void:
	generate_world()
	_setup_astar()

func generate_world() -> void:
	tile_map.resize(MAP_HEIGHT)
	for y in MAP_HEIGHT:
		tile_map[y] = []
		tile_map[y].resize(MAP_WIDTH)
		for x in MAP_WIDTH:
			tile_map[y][x] = TileType.GRASS

	var noise := FastNoiseLite.new()
	noise.seed = randi()
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 0.04

	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			var val: float = noise.get_noise_2d(x, y)
			if val < -0.45:
				tile_map[y][x] = TileType.WATER
			elif val < -0.10:
				tile_map[y][x] = TileType.DIRT
			elif val > 0.35:
				if val > 0.55:
					tile_map[y][x] = TileType.DEEP_STONE
				else:
					tile_map[y][x] = TileType.STONE

	# Ensure safe walkable area at map center for colonist spawn
	var cx := MAP_WIDTH / 2
	var cy := MAP_HEIGHT / 2
	for dy in range(-5, 6):
		for dx in range(-5, 6):
			var tx := cx + dx
			var ty := cy + dy
			if tx >= 0 and tx < MAP_WIDTH and ty >= 0 and ty < MAP_HEIGHT:
				tile_map[ty][tx] = TileType.GRASS

	queue_redraw()

func _setup_astar() -> void:
	astar = AStarGrid2D.new()
	astar.region = Rect2i(0, 0, MAP_WIDTH, MAP_HEIGHT)
	astar.cell_size = Vector2(TILE_SIZE, TILE_SIZE)
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_NEVER
	astar.update()

	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			if tile_map[y][x] == TileType.WATER:
				astar.set_point_solid(Vector2i(x, y), true)

func _draw() -> void:
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			var tt: int = tile_map[y][x]
			draw_rect(
				Rect2(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE),
				TILE_COLORS[tt]
			)
			# Subtle grid
			draw_rect(
				Rect2(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE),
				Color(0, 0, 0, 0.08),
				false
			)

	# Draw designations (yellow tint)
	for tile_pos in designated_tiles:
		draw_rect(
			Rect2(tile_pos.x * TILE_SIZE, tile_pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE),
			Color(1.0, 1.0, 0.0, 0.28)
		)

func get_tile(x: int, y: int) -> int:
	if x < 0 or x >= MAP_WIDTH or y < 0 or y >= MAP_HEIGHT:
		return -1
	return tile_map[y][x]

func is_walkable(x: int, y: int) -> bool:
	if x < 0 or x >= MAP_WIDTH or y < 0 or y >= MAP_HEIGHT:
		return false
	if tile_map[y][x] == TileType.WATER:
		return false
	return not astar.is_point_solid(Vector2i(x, y))

func world_to_tile(world_pos: Vector2) -> Vector2i:
	return Vector2i(int(world_pos.x / TILE_SIZE), int(world_pos.y / TILE_SIZE))

func tile_to_world(tile_pos: Vector2i) -> Vector2:
	return Vector2(
		tile_pos.x * TILE_SIZE + TILE_SIZE * 0.5,
		tile_pos.y * TILE_SIZE + TILE_SIZE * 0.5
	)

func get_path(from_pos: Vector2, to_pos: Vector2) -> PackedVector2Array:
	var from_tile := world_to_tile(from_pos)
	var to_tile := world_to_tile(to_pos)

	if not is_walkable(to_tile.x, to_tile.y):
		to_tile = find_nearest_walkable(to_tile)
		if to_tile == Vector2i(-1, -1):
			return PackedVector2Array()

	if not is_walkable(from_tile.x, from_tile.y):
		from_tile = find_nearest_walkable(from_tile)
		if from_tile == Vector2i(-1, -1):
			return PackedVector2Array()

	return astar.get_point_path(from_tile, to_tile)

func find_nearest_walkable(tile_pos: Vector2i) -> Vector2i:
	for radius in range(1, 6):
		for dx in range(-radius, radius + 1):
			for dy in range(-radius, radius + 1):
				if abs(dx) != radius and abs(dy) != radius:
					continue
				var check := Vector2i(tile_pos.x + dx, tile_pos.y + dy)
				if is_walkable(check.x, check.y):
					return check
	return Vector2i(-1, -1)

func set_tile_solid(tile_pos: Vector2i, solid: bool) -> void:
	if tile_pos.x >= 0 and tile_pos.x < MAP_WIDTH and tile_pos.y >= 0 and tile_pos.y < MAP_HEIGHT:
		astar.set_point_solid(tile_pos, solid)

func add_resource_node(node: Node2D) -> void:
	resource_nodes.append(node)
	var tile_pos := world_to_tile(node.position)
	astar.set_point_solid(tile_pos, true)

func remove_resource_node(node: Node2D) -> void:
	resource_nodes.erase(node)
	var tile_pos := world_to_tile(node.position)
	astar.set_point_solid(tile_pos, false)
	designated_tiles.erase(tile_pos)
	queue_redraw()

func designate_resource(resource_node: Node2D) -> void:
	var tile_pos := world_to_tile(resource_node.position)
	if tile_pos in designated_tiles:
		# Toggle off
		designated_tiles.erase(tile_pos)
		resource_node.is_designated = false
		queue_redraw()
		return

	designated_tiles[tile_pos] = true
	resource_node.is_designated = true
	queue_redraw()

	var job_type: Job.JobType
	if resource_node.resource_type == ResourceNode.ResourceType.TREE:
		job_type = Job.JobType.CHOP_TREE
	else:
		job_type = Job.JobType.MINE_ROCK

	var job := Job.new(job_type, tile_to_world(tile_pos), resource_node)
	JobSystem.add_job(job)
	resource_designated.emit(tile_pos)

func get_resource_at(tile_pos: Vector2i) -> Node2D:
	for node in resource_nodes:
		if is_instance_valid(node) and world_to_tile(node.position) == tile_pos:
			return node
	return null

func get_nearest_colonist_pos() -> Vector2:
	if colonists.is_empty():
		return tile_to_world(Vector2i(MAP_WIDTH / 2, MAP_HEIGHT / 2))
	var nearest: Node2D = colonists[0]
	return nearest.position
