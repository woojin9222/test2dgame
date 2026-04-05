class_name Colonist
extends Node2D

const MOVE_SPEED := 80.0  # pixels per second
const WORK_RATE := 12.0   # work units per second

enum State { IDLE, MOVING, WORKING, EATING, SLEEPING, WANDERING }

var colonist_name: String = "Unnamed"
var body_color: Color = Color.CYAN
var world_ref: World = null

var state: State = State.IDLE
var needs: ColonistNeeds
var current_job: Job = null
var current_path: PackedVector2Array = PackedVector2Array()
var path_index: int = 0

var _job_timer: float = 0.0
var _wander_timer: float = 0.0
var _work_timer: float = 0.0

func _ready() -> void:
	needs = ColonistNeeds.new()
	needs.name = "Needs"
	add_child(needs)
	needs.hunger_critical.connect(_on_hunger_critical)
	needs.energy_critical.connect(_on_energy_critical)

func _draw() -> void:
	# Shadow
	draw_ellipse(Vector2(0, 8), Vector2(10, 4), Color(0, 0, 0, 0.3))

	# Body
	draw_circle(Vector2.ZERO, 10, body_color)
	draw_circle(Vector2.ZERO, 10, Color.WHITE, false, 1.5)

	# Head indicator dot (state color)
	var dot_color := _get_state_color()
	draw_circle(Vector2(0, -14), 4, dot_color)
	draw_circle(Vector2(0, -14), 4, Color.WHITE, false, 1.0)

	# Hunger bar
	_draw_bar(Vector2(-12, 13), 24, 3, needs.hunger / 100.0,
		Color.GREEN if needs.hunger > 30 else Color.RED)
	# Energy bar
	_draw_bar(Vector2(-12, 18), 24, 3, needs.energy / 100.0,
		Color.DODGER_BLUE if needs.energy > 30 else Color.ORANGE)

func _draw_bar(pos: Vector2, w: float, h: float, fill: float, color: Color) -> void:
	draw_rect(Rect2(pos.x, pos.y, w, h), Color(0.1, 0.1, 0.1))
	if fill > 0:
		draw_rect(Rect2(pos.x, pos.y, w * fill, h), color)

func _get_state_color() -> Color:
	match state:
		State.WORKING:  return Color.YELLOW
		State.EATING:   return Color.ORANGE
		State.SLEEPING: return Color.CORNFLOWER_BLUE
		State.MOVING:   return Color.CYAN
		State.WANDERING: return Color.LIGHT_GREEN
		_:              return Color.WHITE

func _process(delta: float) -> void:
	match state:
		State.IDLE:      _process_idle(delta)
		State.MOVING:    _process_moving(delta)
		State.WORKING:   _process_working(delta)
		State.EATING:    _process_eating(delta)
		State.SLEEPING:  _process_sleeping(delta)
		State.WANDERING: _process_wandering(delta)
	queue_redraw()

# ─── State processors ───────────────────────────────────────────────

func _process_idle(delta: float) -> void:
	_job_timer += delta
	if _job_timer >= 0.5:
		_job_timer = 0.0
		_seek_job()
		return

	_wander_timer += delta
	if _wander_timer >= 4.0:
		_wander_timer = 0.0
		_start_wandering()

func _process_moving(delta: float) -> void:
	if current_path.is_empty() or path_index >= current_path.size():
		_on_arrive()
		return

	var target_world := current_path[path_index]
	var diff := target_world - position
	var dist := diff.length()

	if dist < 3.0:
		path_index += 1
		if path_index >= current_path.size():
			_on_arrive()
	else:
		position += diff.normalized() * MOVE_SPEED * delta

func _process_working(delta: float) -> void:
	if current_job == null or current_job.is_complete:
		_finish_job()
		return

	_work_timer += delta
	if _work_timer >= 0.25:
		_work_timer = 0.0
		var work_amount := WORK_RATE * 0.25
		var done := current_job.do_work(work_amount)

		# Damage the target resource
		if current_job.target != null and is_instance_valid(current_job.target):
			if current_job.target.has_method("take_damage"):
				current_job.target.take_damage(int(work_amount))
		elif done:
			_finish_job()

		if done or current_job.is_complete:
			_finish_job()

func _process_eating(delta: float) -> void:
	var multiplier := GameManager.speed_multipliers[GameManager.speed_index]
	needs.eat(delta * 25.0 * max(multiplier, 1.0))
	if needs.hunger >= 90.0:
		state = State.IDLE

func _process_sleeping(delta: float) -> void:
	var multiplier := GameManager.speed_multipliers[GameManager.speed_index]
	needs.rest(delta * 18.0 * max(multiplier, 1.0))
	if needs.energy >= 90.0:
		state = State.IDLE

func _process_wandering(delta: float) -> void:
	if current_path.is_empty() or path_index >= current_path.size():
		state = State.IDLE
		return

	var target_world := current_path[path_index]
	var diff := target_world - position
	var dist := diff.length()

	if dist < 3.0:
		path_index += 1
	else:
		position += diff.normalized() * (MOVE_SPEED * 0.5) * delta

# ─── Job logic ──────────────────────────────────────────────────────

func _seek_job() -> void:
	# Needs take priority
	if needs.hunger < 20.0:
		state = State.EATING
		return
	if needs.energy < 20.0:
		state = State.SLEEPING
		return

	var job := JobSystem.get_next_job(self)
	if job != null:
		_assign_job(job)

func _assign_job(job: Job) -> void:
	if world_ref == null:
		JobSystem.return_job(job)
		return

	current_job = job
	var path := world_ref.get_path(position, job.location)

	if path.is_empty():
		JobSystem.return_job(job)
		current_job = null
		state = State.IDLE
		return

	current_path = path
	path_index = 0
	state = State.MOVING

func _on_arrive() -> void:
	current_path = PackedVector2Array()
	path_index = 0

	if current_job != null:
		# Check job target is still valid
		if current_job.target != null and not is_instance_valid(current_job.target):
			JobSystem.complete_job(current_job)
			current_job = null
			state = State.IDLE
		else:
			state = State.WORKING
	else:
		state = State.IDLE

func _finish_job() -> void:
	if current_job != null:
		JobSystem.complete_job(current_job)
		current_job = null
	state = State.IDLE

func _start_wandering() -> void:
	if world_ref == null:
		return

	var tile_pos := world_ref.world_to_tile(position)
	var range_tiles := 6

	for _attempt in range(15):
		var dx := randi_range(-range_tiles, range_tiles)
		var dy := randi_range(-range_tiles, range_tiles)
		var target_tile := Vector2i(tile_pos.x + dx, tile_pos.y + dy)

		if world_ref.is_walkable(target_tile.x, target_tile.y):
			var path := world_ref.get_path(position, world_ref.tile_to_world(target_tile))
			if not path.is_empty():
				current_path = path
				path_index = 0
				state = State.WANDERING
				return

# ─── Need callbacks ─────────────────────────────────────────────────

func _on_hunger_critical() -> void:
	_interrupt_for_need()
	state = State.EATING

func _on_energy_critical() -> void:
	if needs.hunger > 30.0:
		_interrupt_for_need()
		state = State.SLEEPING

func _interrupt_for_need() -> void:
	if current_job != null:
		JobSystem.return_job(current_job)
		current_job = null
	current_path = PackedVector2Array()

# ─── Info ────────────────────────────────────────────────────────────

func get_state_name() -> String:
	match state:
		State.IDLE:      return "Idle"
		State.MOVING:    return "Moving"
		State.WORKING:   return "Working"
		State.EATING:    return "Eating"
		State.SLEEPING:  return "Sleeping"
		State.WANDERING: return "Wandering"
	return "Unknown"

func get_job_name() -> String:
	if current_job == null:
		return "None"
	match current_job.type:
		Job.JobType.CHOP_TREE:  return "Chopping tree"
		Job.JobType.MINE_ROCK:  return "Mining rock"
		Job.JobType.HAUL_RESOURCE: return "Hauling"
		Job.JobType.BUILD:      return "Building"
		_: return "Working"
