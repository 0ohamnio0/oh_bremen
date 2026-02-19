# OH, BREMEN — Sound Wall · 개발 진행 상황

> **새 에이전트 인수인계 문서.** 이 파일과 `RFP.md`를 먼저 읽고, 필요하면 소스 파일을 직접 읽어 확인할 것.
> 로컬 서버를 실행한 뒤 `http://localhost:5500` 에서 즉시 테스트 가능.

---

## 0. 빠른 시작

```bash
# 로컬 서버 실행 (Bremen 폴더 기준)
cd /d/oh_bremen-main/bremen_sound_wall
python -m http.server 5500
# → http://localhost:5500

# 이미 실행 중이면 재시작
taskkill //F //IM python.exe && python -m http.server 5500
```

- 브라우저에서 마이크 권한 허용 → START 버튼 클릭 → 목소리 입력
- **Q 키**: 화면 전체 클리어 (파티클 + 라인 모두 초기화)

---

## 1. 프로젝트 기본 정보

| 항목 | 내용 |
|------|------|
| 경로 | `D:\oh_bremen-main\bremen_sound_wall\` |
| 스택 | Three.js r160 (CDN importmap), Vanilla JS ES Modules, Web Audio API, GLSL |
| 렌더링 | `THREE.Points` 단일 draw call (5000 파티클 풀) + `THREE.TubeGeometry` 라인 |
| 카메라 | `THREE.OrthographicCamera` (viewH=20 world units, 원근감 없음) |
| 오디오 | Web Audio API, fftSize=2048, smoothingTimeConstant=0.75 |

### 파일 구조

```
bremen_sound_wall/
├── index.html              # 진입점 (importmap: three → CDN r160)
├── css/
│   └── style.css           # body background:#000, 오버레이 스타일
├── js/
│   ├── main.js             # ★ 핵심 — App 클래스 전체
│   ├── audio.js            # AudioAnalyzer 클래스
│   └── brushes.js          # ShapeType 상수 (BLOB=0, SPIKY=1, RING=2)
├── assets/
│   ├── 1212.png            # 로고 이미지 (오버레이에 사용)
│   ├── brush_blob.png      # [선택] 커스텀 BLOB 브러시 PNG — 없으면 canvas 폴백
│   ├── brush_spiky.png     # [선택] 커스텀 SPIKY 브러시 PNG
│   └── brush_ring.png      # [선택] 커스텀 RING 브러시 PNG
├── RFP.md                  # 비주얼 방향, 전체 태스크 목록, 컬러 팔레트
└── PROGRESS.md             # 이 파일
```

---

## 2. 완료된 작업 전체 목록

### ✅ TASK 1 — 배경 + AdditiveBlending + 네온 컬러

- `scene.background = new THREE.Color(0x000000)` — 검정 배경
- `style.css` 배경 → 검정
- 파티클 텍스처 흰색 기준 → `vColor` 틴팅으로 네온 발색
- `audio.js`에 bass/mid/high 3밴드 분리 추가

### ✅ TASK 2 — 렌더링 아키텍처 교체 (Sprite → Points)

- `THREE.Sprite` × 2000개 draw call → **`THREE.Points` 단일 draw call**
- `freeQueue.pop()` O(1) 파티클 재활용
- `BufferGeometry` attributes: `position`, `aColor`, `size`, `opacity`, `aType`, `aRot`
- 커스텀 GLSL `ShaderMaterial` (vertex + fragment)

### ✅ TASK 3 — 파티클 형태 다양화 (Blob / Spiky / Ring)

- `brushes.js`에 `ShapeType = {BLOB:0, SPIKY:1, RING:2}` export
- Fragment shader: 타입별 텍스처 샘플링 (+ canvas 폴백)
- 파티클 자동 소멸 없음, Q키 클리어, maxParticles=5000

### ✅ 음성 전용 밴드 감도 개선

- bass: 80–400Hz (×1.8 boost), mid: 400–2000Hz, high: 2000–8000Hz
- 밴드 에너지 비율 기반 확률적 타입 선택 (mid가 항상 우세해도 blob/ring 섞임)

### ✅ 좌표계 정리 — Z축 완전 제거 + OrthographicCamera

- 모든 파티클/라인 Z=0 (XY 평면만 사용)
- OrbitControls 완전 제거
- `THREE.OrthographicCamera(viewH=20)` 교체 → 원근감/깊이 착시 없음
- 리사이즈: `camera.left/right/top/bottom` + `updateProjectionMatrix()` 직접 갱신

### ✅ 라인 시스템 추가

- `THREE.CatmullRomCurve3` → `THREE.TubeGeometry` 곡선 라인
- `THREE.AdditiveBlending` → 네온 글로우
- `renderOrder = layerCounter++` → 생성 순서대로 레이어 쌓임 (파티클-라인 교차 가능)
- 40프레임마다 생성, amplitude > 0.04 조건, 최대 80개

### ✅ 스폰 포지션 시스템 (pause-based)

- `spawnCX / spawnCY`: 현재 스폰 중심점
- 목소리 입력 **중**: 이 중심점 주변에 파티클+라인 연속 생성
- **14프레임 무음** 감지 시 → `spawnCX/CY` 화면 내 랜덤 새 위치로 이동
- 이동 범위: `viewW × 0.80`, `viewH × 0.80` (화면 가장자리 여백 유지)

### ✅ 컬러 팔레트 다양화 + frequency/complexity 연동

- **4종 팔레트 프리셋** — 페이지 로드마다 랜덤 선택 (`this.palette = PALETTES[random]`)
- `frequency` (피치 0–1): 같은 밴드 내 alt 색상 선택 확률 변조
- `complexity` (스펙트럼 피크 수 0–1): dark/white 서브컬러 등장 확률 (3%–17%)
- 글로우 효과: 내부 코어 밝힘 + 외곽 halo (fragment shader 내부)
- 라인에 `AdditiveBlending` → 겹칠수록 밝아지는 네온 효과

### ✅ 커스텀 브러시 텍스처 시스템

- canvas로 폴백 텍스처 즉시 생성 후, `THREE.TextureLoader`로 PNG 비동기 로드 시도
- 파일 없어도 에러 없음 (silent fail → canvas 폴백 유지)
- Fragment shader: `texture2D(uTexBlob/Spiky/Ring, ruv)` 샘플링 + `vColor` 틴팅
- 커스텀 PNG 배치 경로: `assets/brush_blob.png`, `brush_spiky.png`, `brush_ring.png`
  - 권장 스펙: 256×256 이상 PNG, 투명 배경, 흰색/밝은 형태 (vColor가 tint로 적용)

### ✅ TASK 4 — 스폰 패턴 개선 (Waveform Trail + Organic Flow)

- `audio.js`: `getByteTimeDomainData()` 추가 → `waveform: Uint8Array(2048)` 반환
  - 128 = 무음 기준, 0–255 범위
- `spawnParticles()`: 파형 기반 방사형 커브 생성 후 그 위에 파티클 스폰
  - 48개 샘플 포인트, 방사형(각도=i/48×2π), 반경=baseR + val×waveAmp
  - baseR = viewH×0.04 + amplitude×viewH×0.18 (소리 크기 반영)
  - waveAmp = amplitude×viewH×0.22 (파형 왜곡 폭)
- 속도: **방사형 outward + tangential swirl** (curl noise 근사)
  - 방사 벡터 `(nx, ny)` + 접선 벡터 `(-ny, nx)` 조합
  - `swirl = 0.20 + complexity × 0.55` → 복잡한 소리일수록 소용돌이 강해짐
  - `speed = 0.012 + amplitude × 0.028`
  - 드래그: velocity `*= 0.97` (updateParticles)

---

## 3. 현재 코드 구조 (완전판)

### `audio.js` — AudioAnalyzer

```javascript
class AudioAnalyzer {
    constructor()
        // this.audioContext, analyser, dataArray, waveArray, source, isReady

    async init()
        // getUserMedia → createAnalyser (fftSize=2048, smoothing=0.75)
        // dataArray  = Uint8Array(frequencyBinCount = 1024)  ← frequency domain
        // waveArray  = Uint8Array(fftSize = 2048)            ← time domain

    getAudioData() → {
        amplitude,   // 0–1: 전체 음량 (avg/255 + max/255×0.5 의 max)
        frequency,   // 0–1: 피크 주파수 / 8000Hz (maxValue<30이면 0)
        complexity,  // 0–1: 스펙트럼 피크 개수 / 20 (값>100인 로컬 최대)
        bass,        // 0–1: 80–400Hz 평균, ×1.8 boost
        mid,         // 0–1: 400–2000Hz 평균
        high,        // 0–1: 2000–8000Hz 평균
        waveform,    // Uint8Array(2048) 참조 — 128=무음, 0–255
    }
    // waveform은 내부 배열 참조 → spawnParticles에서 즉시 소비해야 함
    // !isReady일 때 waveform: null 반환 → spawnParticles에서 가드 처리됨
}
```

### `brushes.js` — ShapeType 상수

```javascript
export const ShapeType = { BLOB: 0, SPIKY: 1, RING: 2 };
// TextureGenerator 클래스도 있으나 현재 미사용 (main.js에서 직접 canvas 생성)
```

### `main.js` — App 클래스 (핵심)

#### 모듈 레벨

```javascript
const PALETTES = [
    // 4종 프리셋, 각각 bass[2], mid[3], high[3], dark[2] 색상 배열
    { bass:[0xffbe0b,0xfb5607], mid:[0xff006e,0x8338ec,0xaffc41], high:[0x3a86ff,0x1dd3b0,0xb2ff9e], dark:[0x3c1642,0x086375] },
    { bass:[0xff3300,0xff6600], mid:[0xff0099,0xcc00ff,0xffee00], high:[0x00ccff,0x00ff88,0x99ffee], dark:[0x440011,0x002244] },
    { bass:[0x00ffcc,0x00ddff], mid:[0xcc00ff,0x8800ee,0xffff00], high:[0x00ff44,0x44ffdd,0xccff88], dark:[0x003322,0x220044] },
    { bass:[0xffd700,0xff8800], mid:[0xff44aa,0xff0055,0xddff00], high:[0x00eeff,0x7700ff,0xaaffcc], dark:[0x554400,0x001133] },
];

function pickColor(bass, mid, high, freq, complexity, palette, _c)
    // 1. subChance = 0.03 + complexity×0.14
    // 2. rSpec < subChance×0.35 → dark 컬러
    // 3. rSpec < subChance      → 흰색(0xFFFFFF)
    // 4. rColor < bass          → palette.bass[useAlt?1:0]  (useAlt: random < freq×0.65)
    // 5. rColor < bass+mid      → palette.mid[0/1/2] (rand + freq×0.2 기반)
    // 6. else                   → palette.high[0/1/2] (rand + freq×0.15 기반)
```

#### constructor()

```javascript
// 카메라
this.viewH = 20                           // world units 세로
this.viewW = viewH × (width/height)       // 비율 유지
camera = THREE.OrthographicCamera(−viewW/2, viewW/2, viewH/2, −viewH/2, 0.1, 1000)
camera.position.set(0, 0, 10)

// 팔레트 & 스폰 중심
this.palette  = PALETTES[random]
this.spawnCX  = random × viewW × 0.80     // 초기 스폰 중심 X
this.spawnCY  = random × viewH × 0.80     // 초기 스폰 중심 Y

// 무음 감지
this.voiceActive   = false
this.silenceFrames = 0

// 레이어 카운터
this.layerCounter  = 1   // 라인 renderOrder에 사용

// 라인
this.activeLines   = []
this.maxLines      = 80
this.lineTimer     = 0

// initPool() → _loadBrushTextures() → addEvents()
```

#### initPool()

```javascript
// CPU 배열 (Float32Array/Uint8Array, 모두 maxParticles=5000 크기)
positions[5000×3], colors[5000×3], sizes[5000], opacities[5000]
types[5000], rotations[5000], velocities[5000×3]
ages[5000], baseScales[5000], rotSpeeds[5000], active[5000 Uint8]
freeQueue = [0..4999]  ← O(1) 재활용

// BufferGeometry attributes
'position' (3), 'aColor' (3), 'size' (1), 'opacity' (1), 'aType' (1), 'aRot' (1)

// ShaderMaterial
uniforms: { uTexBlob, uTexSpiky, uTexRing: { value: null } }

// vertex shader
gl_PointSize = size × (400.0 / −mvPosition.z)
// → OrthoCam z=-10이므로: gl_PointSize = size × 40 (고정 배율)

// fragment shader
// 1. 회전 UV: gl_PointCoord를 vRot만큼 회전
// 2. vType < 0.5 → uTexBlob, < 1.5 → uTexSpiky, else → uTexRing
// 3. alpha = tex.a × vOpacity; if alpha < 0.001: discard
// 4. color = vColor × max(tex.rgb)  ← 흰 텍스처에 네온 틴팅
// 5. core glow: smoothstep(0.42, 0.0, r) × 0.38 → 중심 밝힘
// 6. halo: smoothstep(0.50, 0.30, r) × vOpacity × 0.20

// 주의: blending = THREE.NormalBlending (AdditiveBlending 아님!)
// 파티클 풀 renderOrder = 0 (라인보다 아래)
```

#### _makeCanvasBlobTex() / _makeCanvasSpikyTex() / _makeCanvasRingTex()

```
BLOB:  256×256, 방사형 흰색 그라디언트 (r=1.0→0.88→0.42→0.10→0)
SPIKY: 256×256, 10개 스파인 (중심→끝 Linear gradient) + 중심 소프트 도트
RING:  256×256, r1=0.50c → r2=0.88c 환형 (0→0.9→0.9→0.25→0)
```

#### _loadBrushTextures()

```javascript
// 1. canvas 폴백 즉시 세팅 (uTexBlob/Spiky/Ring에 CanvasTexture)
// 2. TextureLoader.load('assets/brush_*.png')
//    성공 → uniform.value 교체
//    실패 → silent (canvas 폴백 유지)
```

#### spawnParticles(audioData)

```javascript
if (amplitude <= 0.01) return;

// ─ 파형 커브 생성 (TASK 4) ─
N = 48, step = floor(waveform.length / 48)
baseR  = viewH×0.04 + amplitude×viewH×0.18   // 기본 반경
waveAmp = amplitude×viewH×0.22               // 파형 편차 반경
for i in 0..47:
    val   = (waveform[i×step] − 128) / 128   // −1..1
    angle = i/48 × 2π
    r     = max(0.05, baseR + val×waveAmp)
    curveX[i] = spawnCX + cos(angle)×r
    curveY[i] = spawnCY + sin(angle)×r×0.8   // 세로 0.8 압축

// ─ 파티클 스폰 ─
count = floor(5 + amplitude×20)
for each particle:
    ci = random(0..47)
    jitter = 0.25 + random×0.35
    position = (curveX[ci] ± jitter, curveY[ci] ± jitter×0.8, 0)

    // 속도 (방사형 + swirl)
    (dx, dy) = position − (spawnCX, spawnCY)
    dist = sqrt(dx²+dy²) + 0.001
    (nx, ny) = (dx, dy)/dist      // radial
    (tx, ty) = (−ny, nx)          // tangential
    speed = 0.012 + amplitude×0.028
    swirl = 0.20 + complexity×0.55
    velocity = (nx + tx×swirl)×speed, (ny + ty×swirl)×speed, 0

    // 크기 (3단계 분포)
    sRoll < 0.10: sv = 3.5+rand×4.0    (대형 10%)
    sRoll < 0.28: sv = 0.10+rand×0.30  (소형 18%)
    else:         sv = 0.90+rand×2.20  (중형 72%)
    baseScale = amplitude×4×sv
    size = baseScale

    // 타입 (밴드 비율 확률)
    rType < bass        → BLOB,  rotSpeed=0
    rType < bass+mid    → SPIKY, rotSpeed=±0.025
    else                → RING,  rotSpeed=±0.012
    rotation = random×2π

    // 컬러: pickColor() 호출
    opacity = 0.65, active = 1, age = 0
```

#### updateParticles()

```javascript
// 매 프레임 active 파티클만 처리
position += velocity
velocity *= 0.97      // drag
rotation += rotSpeed

if age < 120:
    age++
    opacity = 0.65 − 0.35×(age/120)    // 0.65 → 0.30
    size    = baseScale × (1 + age×0.001)  // 약간 성장
// age >= 120: 정착 (opacity 0.30 유지, 더 이상 업데이트 안 함)
```

#### spawnLine(audioData)

```javascript
if activeLines.length >= 80: return
style = random()  → 3가지 스타일
  style < 0.35: numCtrl=3, 긴 스트로크 (stepSize 5–10, radius 0.13–0.22)
  style < 0.65: numCtrl=4, 중간 곡선  (stepSize 2.5–5.5, radius 0.10–0.17)
  else:         numCtrl=7–11, 짧고 구불구불 (stepSize 0.8–2.0, radius 0.07–0.12)

ctrl[0] = (spawnCX±1.5, spawnCY±1.5, 0)
이후 각 포인트: 이전 포인트 + (dx×step + jitter)

CatmullRomCurve3 → TubeGeometry(curve, segments, radius, radialSegs=6, false)
MeshBasicMaterial(AdditiveBlending, opacity=0.65–0.90, depthWrite=false, depthTest=false)
mesh.renderOrder = layerCounter++
scene.add(mesh)
```

#### animate()

```javascript
requestAnimationFrame(animate)
audioData = audioAnalyzer.getAudioData()

spawnParticles(audioData)   // 파형 커브 스폰
updateParticles()            // 이동, 드래그, 에이징

// 무음 감지
if amplitude > 0.015:
    voiceActive=true, silenceFrames=0
else if voiceActive:
    silenceFrames++
    if silenceFrames >= 14:
        voiceActive=false
        spawnCX/CY = new random position (viewW×0.80, viewH×0.80)

// 라인 생성
lineTimer++
if lineTimer >= 40 && amplitude > 0.04:
    lineTimer=0
    spawnLine(audioData)

renderer.render(scene, camera)
```

---

## 4. 핵심 설계 결정 사항 (Why)

| 결정 | 이유 |
|------|------|
| OrthographicCamera | PerspectiveCamera + 파티클 성장 애니메이션이 "Z축 앞으로 나오는" 깊이 착시 유발 → 완전 제거 |
| NormalBlending (파티클) | AdditiveBlending 시 흰색 텍스처가 너무 밝아져 색상 정보 소실 |
| AdditiveBlending (라인) | 라인은 얇아서 겹침이 적음 → Additive가 네온 글로우에 효과적 |
| pause 기반 spawnCX/CY 이동 | 목소리 입력 중 드로잉은 핵심 경험 — 중단이 아닌 시작점만 이동 |
| complexity → swirl | 자음(고음)처럼 스펙트럼이 복잡할수록 더 역동적인 소용돌이 |
| renderOrder 레이어링 | `depthTest=false` 환경에서 라인-파티클 교차 레이어 구현 |
| canvas 폴백 텍스처 | 커스텀 PNG 없이도 즉시 시각적으로 완성된 상태 유지 |
| freeQueue O(1) | 5000개 풀에서 `Array.find()` O(N) 제거 → 실시간 스폰 성능 보장 |

---

## 5. 남은 작업

### 🔲 TASK 5 — 카메라 + 배경 연출

자세한 스펙은 `RFP.md` §TASK 5 참조.

**핵심 구현 포인트:**

1. **카메라 subtle auto-drift**
   - OrbitControls 없음 → `animate()` 루프에서 직접 camera.position 조작
   - `this.time` 카운터 (프레임 누적) → sin 곡선으로 미세 이동
   - 예시: `camera.position.x = sin(time × 0.003) × 1.5`
   - 카메라 이동은 `camera.lookAt(0, 0, 0)` 유지 필요

2. **배경 ambient glow pulse**
   - `THREE.Mesh(PlaneGeometry(viewW×2, viewH×2), ShaderMaterial)`
   - renderOrder = -1 (파티클보다 뒤)
   - uniform `uAmplitude` → animate()에서 매 프레임 업데이트
   - Fragment shader: 중앙에서 방사형 glow, amplitude에 따라 강도 변화
   - 색상: palette.bass[0] 계열 어두운 버전 (너무 밝으면 파티클과 충돌)

### 🔲 TASK 6 — UI/UX 정리

자세한 스펙은 `RFP.md` §TASK 6 참조.

**핵심 구현 포인트:**

1. `index.html` 오버레이 폰트 → `'Courier New', monospace` 또는 Google Fonts `Space Mono`
2. START 버튼 → CSS `border: 1px solid #fff; box-shadow: 0 0 12px #fff, 0 0 24px` 글로우 스타일
3. "PRESS Q TO CLEAR" 상시 표시 힌트 (우하단, 작은 모노스페이스)
4. 로고(`assets/1212.png`) 위치/크기 재조정
5. 오버레이 숨김 시(`overlay.classList.add('hidden')`) 전환 효과 추가

---

## 6. 비주얼 레퍼런스

`C:\Users\test\Downloads\shader graphic reference\fix\` 폴더에 7장.

**핵심 무드**: 사이키델릭 + 바이오 오가닉 / 검정 배경 / 네온 형광 / 발광 유기체

**현재 팔레트 4종 (각각 reload마다 랜덤):**
```
#0: 앰버/오렌지 + 핫핑크/퍼플/라임 + 블루/민트/그린
#1: 레드/오렌지 + 핑크/바이올렛/옐로 + 시안/그린/아쿠아
#2: 민트/하늘 + 퍼플/바이올렛/옐로 + 그린/아쿠아/라임  (다른 팔레트와 이질적 느낌, 필요시 교체)
#3: 골드/오렌지 + 핑크/레드/라임 + 시안/바이올렛/민트
```

---

## 7. 커스텀 브러시 이미지 교체 방법

아직 커스텀 PNG가 없으면 canvas 폴백(GLSL 모양 재현)으로 동작.
파일 배치 후 브라우저 새로고침하면 자동 적용.

```
assets/brush_blob.png   256×256+, PNG, 투명배경, 흰색 방사형 블롭
assets/brush_spiky.png  256×256+, PNG, 투명배경, 흰색 방사형 스파이크
assets/brush_ring.png   256×256+, PNG, 투명배경, 흰색 글로우 링
```

Fragment shader가 `vColor × max(tex.rgb)` 로 tint 처리하므로 **반드시 흰색/밝은 회색 계열** 사용.
텍스처 자체에 색이 있으면 `mix(vColor, tex.rgb, 0.5)` 로 shader 수정 가능 (`main.js` fragmentShader 내 주석 참조).
