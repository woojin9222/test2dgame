class_name ResourceNode
extends Node2D

enum ResourceType { TREE, ROCK }

const TREE_COLOR    := Color(0.10, 0.48, 0.12)
const TRUNK_COLOR   := Color(0.44, 0.28, 0.10)
const ROCK_COLOR    := Color(0.54, 0.54, 0.58)
const ROCK_DARK     := Color(0.38, 0.38, 0.42)

var resource_type: ResourceType = ResourceType.TREE
var health: int = 80
var max_health: int = 80
var is_designated: bool = false

signal died(node: ResourceNode)

func _ready() -> void:
	if resource_type == ResourceType.ROCK:
		max_health = 150
		health = 150

func _draw() -> void:
	if is_designated:
		# Designation ring
		draw_circle(Vector2.ZERO, 15, Color(1.0, 0.9, 0.0, 0.35))

	if resource_type == ResourceType.TREE:
		_draw_tree()
	else:
		_draw_rock()

	# Health bar (only when damaged)
	if health < max_health:
		var ratio := float(health) / float(max_health)
		draw_rect(Rect2(-12, 14, 24, 3), Color(0.15, 0.15, 0.15))
		var bar_color := Color.GREEN if ratio > 0.5 else (Color.YELLOW if ratio > 0.25 else Color.RED)
		draw_rect(Rect2(-12, 14, 24.0 * ratio, 3), bar_color)

func _draw_tree() -> void:
	# Trunk
	draw_rect(Rect2(-3, 2, 6, 9), TRUNK_COLOR)
	# Canopy (layered circles for depth)
	draw_circle(Vector2(-2, -5), 9, TREE_COLOR * Color(0.7, 0.7, 0.7, 1))
	draw_circle(Vector2(2, -6), 9, TREE_COLOR * Color(0.85, 0.85, 0.85, 1))
	draw_circle(Vector2(0, -8), 10, TREE_COLOR)
	# Highlight
	draw_circle(Vector2(-2, -10), 4, TREE_COLOR * Color(1.3, 1.3, 1.3, 1))

func _draw_rock() -> void:
	# Rock shape (polygon)
	var pts := PackedVector2Array([
		Vector2(-11, 5), Vector2(-13, -1), Vector2(-7, -11),
		Vector2(3, -13), Vector2(13, -5), Vector2(11, 6), Vector2(1, 9)
	])
	draw_colored_polygon(pts, ROCK_COLOR)
	# Shadow side
	var shadow_pts := PackedVector2Array([
		Vector2(1, 9), Vector2(11, 6), Vector2(13, -5), Vector2(7, 0), Vector2(3, 8)
	])
	draw_colored_polygon(shadow_pts, ROCK_DARK)
	# Highlight
	draw_circle(Vector2(-4, -5), 3, Color(0.75, 0.75, 0.78))

func take_damage(amount: int) -> void:
	health -= amount
	queue_redraw()
	if health <= 0:
		_on_death()

func _on_death() -> void:
	# Add resources to global stockpile
	if resource_type == ResourceType.TREE:
		var amount := randi_range(8, 18)
		GameManager.add_resource("wood", amount)
		_spawn_drop_label("+" + str(amount) + " Wood")
	else:
		var amount := randi_range(5, 14)
		GameManager.add_resource("stone", amount)
		_spawn_drop_label("+" + str(amount) + " Stone")

	died.emit(self)
	queue_free()

func _spawn_drop_label(text: String) -> void:
	# Create a floating label to show the resource gain
	var label := Label.new()
	label.text = text
	label.position = position + Vector2(-20, -20)
	label.add_theme_color_override("font_color",
		Color.YELLOW if resource_type == ResourceType.TREE else Color.LIGHT_GRAY)
	label.add_theme_font_size_override("font_size", 13)
	get_parent().add_child(label)

	# Tween the label upward and fade out
	var tween := label.create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - 30, 1.2)
	tween.tween_property(label, "modulate:a", 0.0, 1.2)
	tween.chain().tween_callback(label.queue_free)
