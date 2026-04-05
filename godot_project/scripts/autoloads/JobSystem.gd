extends Node

signal job_added(job: Job)
signal job_completed(job: Job)
signal job_cancelled(job: Job)

var pending_jobs: Array[Job] = []
var all_jobs: Array[Job] = []

func add_job(job: Job) -> void:
	pending_jobs.append(job)
	all_jobs.append(job)
	_sort_jobs()
	job_added.emit(job)

func _sort_jobs() -> void:
	pending_jobs.sort_custom(func(a: Job, b: Job) -> bool:
		return a.priority > b.priority
	)

func get_next_job(colonist: Node) -> Job:
	for job in pending_jobs:
		if job.assigned_to == null:
			job.assigned_to = colonist
			pending_jobs.erase(job)
			return job
	return null

func complete_job(job: Job) -> void:
	pending_jobs.erase(job)
	all_jobs.erase(job)
	job.is_complete = true
	job_completed.emit(job)

func cancel_job(job: Job) -> void:
	pending_jobs.erase(job)
	all_jobs.erase(job)
	job.assigned_to = null
	job_cancelled.emit(job)

func return_job(job: Job) -> void:
	if job == null or job.is_complete:
		return
	if job not in pending_jobs:
		job.assigned_to = null
		pending_jobs.append(job)
		_sort_jobs()

func has_pending_jobs() -> bool:
	return pending_jobs.size() > 0

func clear_all_jobs() -> void:
	pending_jobs.clear()
	all_jobs.clear()
