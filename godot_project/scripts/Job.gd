class_name Job
extends RefCounted

enum JobType {
	CHOP_TREE,
	MINE_ROCK,
	HAUL_RESOURCE,
	BUILD,
	EAT,
	SLEEP,
	IDLE
}

var type: JobType
var location: Vector2
var tile_position: Vector2i
var target: Node = null
var priority: int = 5
var assigned_to: Node = null
var is_complete: bool = false
var work_required: float = 100.0
var work_done: float = 0.0

func _init(job_type: JobType, pos: Vector2, job_target: Node = null) -> void:
	type = job_type
	location = pos
	tile_position = Vector2i(int(pos.x / 32), int(pos.y / 32))
	target = job_target

	match type:
		JobType.CHOP_TREE:
			work_required = 80.0
			priority = 5
		JobType.MINE_ROCK:
			work_required = 150.0
			priority = 5
		JobType.HAUL_RESOURCE:
			work_required = 20.0
			priority = 6
		JobType.BUILD:
			work_required = 100.0
			priority = 7
		JobType.EAT:
			work_required = 10.0
			priority = 10
		JobType.SLEEP:
			work_required = 200.0
			priority = 9

func do_work(amount: float) -> bool:
	work_done += amount
	if work_done >= work_required:
		is_complete = true
		return true
	return false

func get_progress() -> float:
	if work_required <= 0:
		return 1.0
	return work_done / work_required
