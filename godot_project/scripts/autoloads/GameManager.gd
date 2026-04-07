extends Node

signal day_changed(day: int)
signal hour_changed(hour: int)
signal season_changed(season_name: String)
signal resources_changed()

enum Season { SPRING = 0, SUMMER = 1, AUTUMN = 2, WINTER = 3 }

const DAYS_PER_SEASON := 15
const REAL_SECONDS_PER_GAME_HOUR := 2.5

var hour: int = 6
var day: int = 1
var year: int = 1
var season: Season = Season.SPRING

# 0=paused, 1=normal, 2=fast, 3=ultra
var speed_index: int = 1
var speed_multipliers: Array[float] = [0.0, 1.0, 2.5, 5.0]
var _hour_timer: float = 0.0

var total_colonists: int = 0
var wood_stockpile: int = 0
var stone_stockpile: int = 0
var food_stockpile: int = 50

func _process(delta: float) -> void:
	var multiplier: float = speed_multipliers[speed_index]
	if multiplier == 0.0:
		return

	_hour_timer += delta * multiplier

	if _hour_timer >= REAL_SECONDS_PER_GAME_HOUR:
		_hour_timer -= REAL_SECONDS_PER_GAME_HOUR
		hour += 1
		hour_changed.emit(hour)

		if hour >= 24:
			hour = 0
			day += 1
			day_changed.emit(day)

			if day > DAYS_PER_SEASON:
				day = 1
				season = ((season + 1) % 4) as Season
				if season == Season.SPRING:
					year += 1
				season_changed.emit(get_season_name())

func get_season_name() -> String:
	match season:
		Season.SPRING: return "Spring"
		Season.SUMMER: return "Summer"
		Season.AUTUMN: return "Autumn"
		Season.WINTER: return "Winter"
	return ""

func get_time_string() -> String:
	return "%02d:00" % hour

func set_speed(idx: int) -> void:
	speed_index = clamp(idx, 0, speed_multipliers.size() - 1)

func add_resource(type: String, amount: int) -> void:
	match type:
		"wood":
			wood_stockpile += amount
		"stone":
			stone_stockpile += amount
		"food":
			food_stockpile += amount
	resources_changed.emit()

func consume_food(amount: float) -> bool:
	if food_stockpile >= int(amount):
		food_stockpile -= int(amount)
		resources_changed.emit()
		return true
	return false
