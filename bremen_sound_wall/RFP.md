# OH, BREMEN — Sound Wall · Visual RFP

## 1. 비전 요약

마이크 입력에 반응하는 실시간 3D 비주얼 익스피리언스.
어둠 속에서 소리가 살아있는 생명체처럼 자라나는 느낌.
사이키델릭 + 바이오 오가닉의 교차점. 소리가 클수록 더 밀도 있고 화려해진다.

---

## 2. 비주얼 레퍼런스 요약 (fix 폴더 기준)

| 레퍼런스 | 핵심 특징 |
|----------|-----------|
| 네온 실루엣 (021da6...) | 어두운 배경 위 폭발하는 네온 헤일로, 스파클 |
| 네온 코스모스 (02733d...) | 검정 배경, 소프트 글로우 블롭, 네온 라인 스트로크 |
| 네온 일러스트 (35ae7b...) | 다크 그라디언트 배경, 유기적 튜브/구체, 두꺼운 네온 아웃라인 |
| 바이오 오가닉 (376cd5...) | 그라디언트 하늘, 홀로그래픽 촉수·스파이크 생명체 |
| 생물발광 데이터 아트 (66221e...) | 검정 배경, 원형 구성, 해파리+파티클 밀집 |
| 우주 플로라 (e40a58...) | 검정 별빛 배경, 네온 꽃/유기체, 줄기에서 빛 방출 |
| 홀로그래픽 크롬 (f44ddc...) | 액체 금속 + 무지개 이리데슨트, 필름 그레인 |

### 공통 비주얼 DNA
- **배경**: 검정 또는 짙은 다크 그라디언트
- **색감**: 형광 네온 — 핫핑크, 시안, 노랑-그린, 오렌지
- **빛**: 물체가 빛을 "발산" — Additive Blending, Bloom
- **형태**: 유기적·생물학적 — 블롭, 촉수, 균류, 해파리 실루엣
- **밀도**: 소리가 커질수록 화면이 가득 차야 함

---

## 2-B. 인터랙션 & 감도 스펙 (추가 확정)

### 파티클 지속 / Q키 클리어
- 파티클은 자동으로 사라지지 않는다 — 화면에 **누적·정착**
- 소리를 낼수록 "벽"처럼 채워지는 경험
- **Q 키** 입력 시 전체 클리어 → 빈 캔버스로 초기화
- 파티클 정착 후 투명도: `0.25` (AdditiveBlending으로 겹칠수록 밝아짐)

### 음성 전용 밴드 감도
- 유저는 악기 없이 **목소리만** 사용 — 일반 음악 기준 밴드 범위 부적합
- 목소리 주파수 특성:
  - 기본 주파수(F0): 80–300Hz (남성), 160–500Hz (여성)
  - 모음 포르만트: 300–2000Hz (가장 풍부)
  - 자음·기식음: 2000–8000Hz
- **조정된 밴드**:
  - `bass`: 80–400Hz (성대 진동, 저음 포르만트) → 에너지 작으므로 ×1.8 boost
  - `mid` : 400–2000Hz (모음·멜로디)
  - `high`: 2000–8000Hz (자음·sibilant)
- **타입 선택 방식**: 절대 우세가 아닌 **밴드 에너지 비율에 따른 확률적 선택**
  → 목소리처럼 mid가 항상 우세한 경우에도 blob/ring이 섞여 나옴

---

## 3. 현재 코드 vs. 목표 상태

| 항목 | 현재 (AS-IS) | 목표 (TO-BE) |
|------|-------------|--------------|
| 배경색 | 오렌지 `#ed7327` | 검정 `#000000` |
| 파티클 색상 | 고정 검정 | 주파수 기반 네온 컬러 |
| 블렌딩 | `NormalBlending` | `AdditiveBlending` |
| 파티클 텍스처 | 소프트 블랙 blob | 유기적 형태 (spiky, tentacle) |
| 파티클 탐색 | `Array.find()` O(N) | 인덱스 기반 풀 큐 O(1) |
| 렌더링 방식 | `THREE.Sprite` × 2000개 draw call | `THREE.Points` 단일 draw call |
| 오디오 분석 | amplitude / frequency / complexity | bass / mid / high 3밴드 분리 |
| 카메라 | OrbitControls (마우스로 돌아감) | 자동 회전 or 고정 + subtle drift |
| 배경 연출 | 없음 | 배경 Bloom glow layer 추가 |

---

## 4. 구현 태스크 (우선순위 순)

### TASK 1 — 배경 + 블렌딩 + 네온 컬러 적용 ⚡ 최우선
**목표**: 분위기를 즉각적으로 바꾸는 가장 임팩트 높은 변경

- [ ] `scene.background` → `#000000` (검정)
- [ ] `style.css` 배경색 → 검정으로 변경
- [ ] `SpriteMaterial.blending` → `THREE.AdditiveBlending`
- [ ] `SpriteMaterial.color` → 오디오 데이터 기반 HSL 컬러로 변경
  - bass 강함 → 오렌지/레드 (`hsl(15~30, 100%, 60%)`)
  - mid 강함 → 핫핑크/마젠타 (`hsl(300~330, 100%, 60%)`)
  - high 강함 → 시안/민트 (`hsl(170~200, 100%, 70%)`)
- [ ] `audio.js` — bass / mid / high 3밴드 분리 추가

---

### TASK 2 — 렌더링 아키텍처 교체 (Sprite → Points)
**목표**: 2000개 draw call → 1개, 성능 대폭 개선

- [ ] `THREE.BufferGeometry` + `position` / `color` / `size` attribute 구성
- [ ] `THREE.ShaderMaterial` (커스텀 vertex/fragment shader)
  - vertex: `gl_PointSize` = audio amplitude * scale
  - fragment: 소프트 원형 블롭 + additive glow
- [ ] Sprite pool 로직 → BufferGeometry attribute 업데이트 방식으로 전환
- [ ] 파티클 인덱스 큐 도입 (O(1) 재활용)

---

### TASK 3 — 유기적 파티클 형태 + 텍스처 다양화
**목표**: "살아있는 생명체" 느낌의 형태

- [ ] `brushes.js` — 텍스처 종류 확장:
  - `createBlobTexture()` — 기존 소프트 원형
  - `createSpikyTexture()` — 방사형 스파이크 (sun-like)
  - `createRingTexture()` — 속이 빈 링
- [ ] 오디오 밴드에 따라 텍스처 타입 선택
  - bass → blob (크고 무거운)
  - mid → spiky (폭발적)
  - high → ring (가볍고 투명)
- [ ] 파티클 스폰 시 약간의 회전 `sprite.material.rotation` 랜덤 적용

---

### TASK 4 — 스폰 패턴 개선 (Trail / Organic Flow)
**목표**: 랜덤 산발이 아닌, 소리의 흐름을 따라가는 유기적 궤적

- [ ] 스폰 포지션을 오디오 파형(waveform)에 따라 곡선으로 배치
  - `analyser.getByteTimeDomainData()` 활용
  - 파형을 X축 곡선으로 매핑
- [ ] 파티클이 중심에서 방사형으로 퍼지는 패턴 추가
- [ ] `velocity`에 소용돌이(curl noise) 성분 추가 → 흐르는 느낌

---

### TASK 5 — 카메라 + 배경 연출
**목표**: 조용할 때도 살아있는 화면

- [ ] OrbitControls 비활성화 (또는 damping만 유지)
- [ ] 카메라 subtle auto-drift — 매우 느린 sin 곡선으로 미세하게 움직임
- [ ] 배경 ambient glow layer:
  - `THREE.Mesh` + `PlaneGeometry` + 커스텀 shader
  - 오디오 amplitude에 따라 배경 중앙에서 글로우 pulse

---

### TASK 6 — UI/UX 정리
**목표**: 레퍼런스 무드에 맞는 오버레이

- [ ] 오버레이 폰트 → 모노스페이스 또는 미니멀 산세리프
- [ ] 배경 오렌지 → 검정으로 변경
- [ ] 버튼 스타일 → 네온 아웃라인 스타일 (글로우 border)
- [ ] 로고 위치/크기 재조정

---

## 5. 기술 스택 (변경 없음)

- Three.js `r160` (CDN importmap)
- Vanilla JS ES Modules
- Web Audio API (FFT)
- GLSL (ShaderMaterial / vertex + fragment)

---

## 6. 컬러 팔레트

```
배경:     #000000
Bass:     hsl(20,  100%, 55%)  — 오렌지/레드
Mid:      hsl(315, 100%, 60%)  — 핫핑크
High:     hsl(185, 100%, 65%)  — 시안
Accent:   hsl(60,  100%, 65%)  — 옐로우
Bloom:    rgba(255,255,255,0.05) — 화이트 글로우 오버레이
```

---

## 7. 작업 순서 권장

```
TASK 1 → TASK 2 → TASK 3 → TASK 4 → TASK 5 → TASK 6
(즉각 비주얼 임팩트) → (성능) → (형태) → (동작) → (연출) → (UI)
```
