class_name ColonistNeeds
extends Node

signal hunger_critical()
signal energy_critical()

# Per-second drain at speed x1 (scaled by game speed)
const HUNGER_DRAIN := 0.8
const ENERGY_DRAIN := 0.5

var hunger: float = 100.0
var energy: float = 100.0
var mood: float = 75.0

var _hunger_crit_fired: bool = false
var _energy_crit_fired: bool = false

func _process(delta: float) -> void:
	var multiplier: float = GameManager.speed_multipliers[GameManager.speed_index]
	if multiplier == 0.0:
		return

	var scaled := delta * multiplier * 0.05  # slow drain so game is playable

	hunger = maxf(0.0, hunger - HUNGER_DRAIN * scaled)
	energy = maxf(0.0, energy - ENERGY_DRAIN * scaled)

	# Mood influenced by needs satisfaction
	var satisfaction := (hunger + energy) / 200.0
	mood = lerpf(mood, satisfaction * 100.0, delta * 0.1)

	# Fire critical signals once when threshold crossed
	if hunger < 20.0 and not _hunger_crit_fired:
		_hunger_crit_fired = true
		hunger_critical.emit()
	elif hunger >= 30.0:
		_hunger_crit_fired = false

	if energy < 20.0 and not _energy_crit_fired:
		_energy_crit_fired = true
		energy_critical.emit()
	elif energy >= 30.0:
		_energy_crit_fired = false

func eat(amount: float) -> void:
	hunger = minf(100.0, hunger + amount)

func rest(amount: float) -> void:
	energy = minf(100.0, energy + amount)

func get_mood_label() -> String:
	if mood > 75:
		return "Happy"
	elif mood > 50:
		return "Content"
	elif mood > 25:
		return "Unhappy"
	return "Miserable"
