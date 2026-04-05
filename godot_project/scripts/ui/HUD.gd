extends CanvasLayer

var world_ref: World = null
var _selected_colonist: Colonist = null

# Top bar refs
var _time_label: Label
var _resource_label: Label
var _job_count_label: Label

# Colonist list
var _colonist_list: VBoxContainer

# Selection info panel
var _info_panel: Panel
var _info_name: Label
var _info_job: Label
var _info_state: Label
var _hunger_bar: ProgressBar
var _energy_bar: ProgressBar
var _mood_label: Label

# Tooltip
var _tooltip: Label

func _ready() -> void:
	_build_ui()
	GameManager.resources_changed.connect(_refresh_resources)
	JobSystem.job_added.connect(_on_job_changed)
	JobSystem.job_completed.connect(_on_job_changed)

func setup(world: World) -> void:
	world_ref = world

# ─── UI builder ─────────────────────────────────────────────────────

func _build_ui() -> void:
	_build_top_bar()
	_build_left_panel()
	_build_info_panel()
	_build_tooltip()

func _build_top_bar() -> void:
	var top := Panel.new()
	top.name = "TopBar"
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.custom_minimum_size = Vector2(0, 44)
	add_child(top)

	# Style
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.08, 0.10, 0.92)
	style.border_width_bottom = 2
	style.border_color = Color(0.3, 0.3, 0.35)
	top.add_theme_stylebox_override("panel", style)

	_time_label = _make_label(top, Vector2(10, 12), "Day 1 | Spring | 06:00", 14)

	_resource_label = _make_label(top, Vector2(320, 12),
		"Wood: 0  |  Stone: 0  |  Food: 50", 14)
	_resource_label.add_theme_color_override("font_color", Color(0.9, 0.85, 0.5))

	_job_count_label = _make_label(top, Vector2(700, 12), "Jobs pending: 0", 12)
	_job_count_label.add_theme_color_override("font_color", Color(0.6, 0.8, 1.0))

	# Speed buttons
	var speed_labels := ["|| Pause", "> 1x", ">> 2.5x", ">>> 5x"]
	for i in speed_labels.size():
		var btn := Button.new()
		btn.text = speed_labels[i]
		btn.position = Vector2(900 + i * 88, 7)
		btn.size = Vector2(84, 30)
		var idx := i  # capture for closure
		btn.pressed.connect(func(): GameManager.set_speed(idx))
		top.add_child(btn)

	var hint := _make_label(top, Vector2(10, 28), "RMB: Designate/Cancel  |  MMB drag: Pan  |  Scroll: Zoom  |  LMB: Select", 10)
	hint.add_theme_color_override("font_color", Color(0.5, 0.5, 0.55))

func _build_left_panel() -> void:
	var panel := Panel.new()
	panel.name = "LeftPanel"
	panel.position = Vector2(0, 44)
	panel.custom_minimum_size = Vector2(185, 0)
	panel.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	panel.offset_top = 44
	panel.offset_right = 185

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.08, 0.10, 0.88)
	style.border_width_right = 2
	style.border_color = Color(0.3, 0.3, 0.35)
	panel.add_theme_stylebox_override("panel", style)
	add_child(panel)

	var title := _make_label(panel, Vector2(8, 6), "COLONISTS", 12)
	title.add_theme_color_override("font_color", Color(0.7, 0.9, 1.0))

	var scroll := ScrollContainer.new()
	scroll.position = Vector2(4, 26)
	scroll.size = Vector2(177, 500)
	panel.add_child(scroll)

	_colonist_list = VBoxContainer.new()
	_colonist_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_colonist_list)

func _build_info_panel() -> void:
	_info_panel = Panel.new()
	_info_panel.name = "InfoPanel"
	_info_panel.position = Vector2(190, 620)
	_info_panel.size = Vector2(320, 95)
	_info_panel.visible = false

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.08, 0.10, 0.92)
	style.border_width_top = 2
	style.border_color = Color(0.4, 0.6, 1.0)
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	_info_panel.add_theme_stylebox_override("panel", style)
	add_child(_info_panel)

	_info_name = _make_label(_info_panel, Vector2(10, 6), "Colonist", 15)
	_info_name.add_theme_color_override("font_color", Color(0.9, 0.95, 1.0))

	_info_state = _make_label(_info_panel, Vector2(200, 8), "Idle", 12)
	_info_state.add_theme_color_override("font_color", Color(0.6, 1.0, 0.6))

	_info_job = _make_label(_info_panel, Vector2(10, 26), "Job: None", 12)
	_info_job.add_theme_color_override("font_color", Color(0.8, 0.8, 0.6))

	# Hunger
	_make_label(_info_panel, Vector2(10, 45), "Hunger", 11)
	_hunger_bar = _make_progress_bar(_info_panel, Vector2(62, 45), Vector2(240, 14),
		Color(0.2, 0.7, 0.2))

	# Energy
	_make_label(_info_panel, Vector2(10, 63), "Energy", 11)
	_energy_bar = _make_progress_bar(_info_panel, Vector2(62, 63), Vector2(240, 14),
		Color(0.2, 0.5, 0.9))

	_mood_label = _make_label(_info_panel, Vector2(10, 80), "Mood: Content", 11)
	_mood_label.add_theme_color_override("font_color", Color(0.9, 0.8, 0.4))

func _build_tooltip() -> void:
	_tooltip = Label.new()
	_tooltip.name = "Tooltip"
	_tooltip.position = Vector2(200, 50)
	_tooltip.visible = false
	_tooltip.add_theme_font_size_override("font_size", 13)
	_tooltip.add_theme_color_override("font_color", Color(1, 1, 0.6))
	add_child(_tooltip)

# ─── Per-frame update ────────────────────────────────────────────────

func _process(_delta: float) -> void:
	if world_ref == null:
		return

	_refresh_time()
	_refresh_colonist_list()

	if _selected_colonist != null and is_instance_valid(_selected_colonist):
		_refresh_info_panel()
	else:
		_info_panel.visible = false
		_selected_colonist = null

# ─── Refresh methods ─────────────────────────────────────────────────

func _refresh_time() -> void:
	_time_label.text = "Day %d | %s | %s   Year %d" % [
		GameManager.day,
		GameManager.get_season_name(),
		GameManager.get_time_string(),
		GameManager.year
	]

func _refresh_resources() -> void:
	_resource_label.text = "Wood: %d  |  Stone: %d  |  Food: %d" % [
		GameManager.wood_stockpile,
		GameManager.stone_stockpile,
		GameManager.food_stockpile
	]

func _on_job_changed(_job: Job) -> void:
	_job_count_label.text = "Jobs pending: %d" % JobSystem.pending_jobs.size()

func _refresh_colonist_list() -> void:
	if world_ref == null:
		return

	var colonists := world_ref.colonists
	var children := _colonist_list.get_children()

	# Add missing buttons
	while children.size() < colonists.size():
		var btn := Button.new()
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		btn.custom_minimum_size = Vector2(0, 36)
		_colonist_list.add_child(btn)
		children = _colonist_list.get_children()

	# Update labels
	for i in colonists.size():
		var col: Colonist = colonists[i]
		if not is_instance_valid(col):
			continue
		var btn: Button = children[i]
		var h := int(col.needs.hunger)
		var e := int(col.needs.energy)
		btn.text = "%s\nH:%d E:%d  %s" % [col.colonist_name, h, e, col.get_state_name()]
		var cap_idx := i  # closure capture
		if not btn.pressed.is_connected(_on_colonist_button):
			btn.pressed.connect(_on_colonist_button.bind(cap_idx))

func _refresh_info_panel() -> void:
	var col := _selected_colonist
	_info_name.text = col.colonist_name
	_info_state.text = col.get_state_name()
	_info_job.text = "Job: " + col.get_job_name()
	_hunger_bar.value = col.needs.hunger
	_energy_bar.value = col.needs.energy
	_mood_label.text = "Mood: " + col.needs.get_mood_label() + " (%.0f%%)" % col.needs.mood

# ─── Event handlers ──────────────────────────────────────────────────

func _on_colonist_button(idx: int) -> void:
	if world_ref == null:
		return
	if idx < world_ref.colonists.size():
		show_colonist_info(world_ref.colonists[idx])

func show_colonist_info(colonist: Colonist) -> void:
	_selected_colonist = colonist
	_info_panel.visible = true

func hide_colonist_info() -> void:
	_selected_colonist = null
	_info_panel.visible = false

func show_tooltip(msg: String) -> void:
	_tooltip.text = msg
	_tooltip.visible = true

func hide_tooltip() -> void:
	_tooltip.visible = false

# ─── Helpers ─────────────────────────────────────────────────────────

func _make_label(parent: Control, pos: Vector2, text: String, size: int) -> Label:
	var lbl := Label.new()
	lbl.position = pos
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", size)
	parent.add_child(lbl)
	return lbl

func _make_progress_bar(parent: Control, pos: Vector2, sz: Vector2, color: Color) -> ProgressBar:
	var pb := ProgressBar.new()
	pb.position = pos
	pb.size = sz
	pb.max_value = 100.0
	pb.value = 100.0
	pb.show_percentage = false

	var fill_style := StyleBoxFlat.new()
	fill_style.bg_color = color
	pb.add_theme_stylebox_override("fill", fill_style)

	var bg_style := StyleBoxFlat.new()
	bg_style.bg_color = Color(0.15, 0.15, 0.18)
	pb.add_theme_stylebox_override("background", bg_style)

	parent.add_child(pb)
	return pb
