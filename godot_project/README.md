# Colony Survival — RimWorld-style Game (Godot 4)

## 요구 사항
- **Godot Engine 4.2+** ([godotengine.org](https://godotengine.org/download))

## 실행 방법
1. Godot 4 설치
2. Godot 에디터에서 **Import** → `godot_project/project.godot` 선택
3. **F5** 또는 ▶ 버튼으로 실행

---

## 조작 방법

| 입력 | 동작 |
|------|------|
| **마우스 우클릭** (나무/바위) | 수확 지정 / 취소 |
| **마우스 좌클릭** (콜로니스트) | 콜로니스트 선택 |
| **가운데 버튼 드래그** | 화면 이동 |
| **마우스 휠** | 줌 인/아웃 |
| **W/A/S/D 또는 방향키** | 카메라 이동 |
| **|| / > / >> / >>>** (UI 버튼) | 게임 속도 조절 |

---

## 게임 시스템

### 세계 생성
- 80×60 타일 맵 (노이즈 기반 절차적 생성)
- 타일 종류: 잔디, 흙, 돌, 심층암, 물
- 나무 ~220그루, 바위 ~110개 랜덤 배치

### 콜로니스트 AI
- **상태**: 대기 → 이동 → 작업 → 식사 → 수면 → 배회
- **욕구 시스템**: 배고픔(Hunger), 체력(Energy), 기분(Mood)
- 배고픔/체력이 임계치 아래로 내려가면 자동으로 먹고 잠
- A* 경로 탐색으로 목표 위치 이동

### 작업 시스템 (JobSystem)
- 우선순위 큐 기반
- 작업 종류: 나무 베기, 바위 채굴, 운반, 건설
- 콜로니스트가 자동으로 대기 작업 수령

### 자원
- **나무** → Wood +8~18
- **바위** → Stone +5~14
- 수확 시 화면에 부유 텍스트 표시

### UI
- 상단 바: 날짜/계절/시간, 자원 현황, 게임 속도 버튼
- 좌측 패널: 콜로니스트 목록 (배고픔/체력 실시간 표시)
- 하단 패널: 선택된 콜로니스트 상세 정보

---

## 파일 구조

```
godot_project/
├── project.godot
├── scenes/
│   └── Main.tscn
└── scripts/
    ├── Main.gd              # 진입점, 카메라, 입력
    ├── World.gd             # 타일맵, A* 경로찾기
    ├── Job.gd               # 작업 데이터 클래스
    ├── autoloads/
    │   ├── GameManager.gd   # 시간, 자원, 게임 속도
    │   └── JobSystem.gd     # 작업 큐 싱글턴
    ├── entities/
    │   ├── Colonist.gd      # 콜로니스트 AI + 렌더링
    │   ├── ColonistNeeds.gd # 욕구 시스템
    │   └── ResourceNode.gd  # 나무/바위
    └── ui/
        └── HUD.gd           # 게임 UI 오버레이
```
