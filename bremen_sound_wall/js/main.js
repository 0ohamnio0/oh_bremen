import * as THREE from 'three';
import { AudioAnalyzer } from './audio.js';
import { ShapeType } from './brushes.js';

// ── 팔레트 프리셋 4종 ─────────────────────────────────────────────────────────
const PALETTES = [
    { bass:[0xffbe0b,0xfb5607], mid:[0xff006e,0x8338ec,0xaffc41], high:[0x3a86ff,0x1dd3b0,0xb2ff9e], dark:[0x3c1642,0x086375] },
    { bass:[0xff3300,0xff6600], mid:[0xff0099,0xcc00ff,0xffee00], high:[0x00ccff,0x00ff88,0x99ffee], dark:[0x440011,0x002244] },
    { bass:[0x00ffcc,0x00ddff], mid:[0xcc00ff,0x8800ee,0xffff00], high:[0x00ff44,0x44ffdd,0xccff88], dark:[0x003322,0x220044] },
    { bass:[0xffd700,0xff8800], mid:[0xff44aa,0xff0055,0xddff00], high:[0x00eeff,0x7700ff,0xaaffcc], dark:[0x554400,0x001133] },
];

function pickColor(bass, mid, high, freq, complexity, palette, _c) {
    const total     = bass + mid + high + 0.001;
    const subChance = 0.03 + complexity * 0.14;
    const rSpec     = Math.random();
    if (rSpec < subChance * 0.35) { _c.set(Math.random() < 0.5 ? palette.dark[0] : palette.dark[1]); return; }
    if (rSpec < subChance) { _c.set(0xFFFFFF); return; }
    const rColor = Math.random() * total;
    const useAlt = Math.random() < freq * 0.65;
    if (rColor < bass) {
        _c.set(useAlt ? palette.bass[1] : palette.bass[0]);
    } else if (rColor < bass + mid) {
        const r3 = Math.random() + freq * 0.2;
        if (r3 < 0.50)      _c.set(palette.mid[0]);
        else if (r3 < 0.88) _c.set(palette.mid[1]);
        else                _c.set(palette.mid[2]);
    } else {
        const r3 = Math.random() + freq * 0.15;
        if (r3 < 0.52)      _c.set(palette.high[0]);
        else if (r3 < 0.82) _c.set(palette.high[1]);
        else                _c.set(palette.high[2]);
    }
}

class App {
    constructor() {
        this.container = document.getElementById('gl');
        this.overlay   = document.getElementById('overlay');
        this.startBtn  = document.getElementById('start-btn');

        this.width  = window.innerWidth;
        this.height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.viewH = 20;
        this.viewW = this.viewH * (this.width / this.height);
        this.camera = new THREE.OrthographicCamera(
            -this.viewW / 2, this.viewW / 2,
             this.viewH / 2,-this.viewH / 2,
            0.1, 1000
        );
        this.camera.position.set(0, 0, 10);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.container, antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.audioAnalyzer = new AudioAnalyzer();
        this.maxParticles  = 5000;
        this.palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];

        this.spawnCX = (Math.random() - 0.5) * this.viewW * 0.80;
        this.spawnCY = (Math.random() - 0.5) * this.viewH * 0.80;

        this.voiceActive   = false;
        this.silenceFrames = 0;
        this.layerCounter  = 1;
        this.activeLines   = [];
        this.maxLines      = 80;
        this.lineTimer     = 0;

        this.initPool();          // ShaderMaterial with null texture uniforms
        this._loadBrushTextures(); // fill uniforms (canvas fallback + async user files)
        this.addEvents();

        this.animate = this.animate.bind(this);
    }

    // ── BRUSH TEXTURES ────────────────────────────────────────────────────────
    // 기본: canvas 생성 (GLSL 모양과 동일하게)
    // 커스텀: assets/brush_blob.png / brush_spiky.png / brush_ring.png 로드 시 자동 교체

    _makeCanvasBlobTex() {
        const sz = 256, c = sz / 2;
        const cvs = document.createElement('canvas');
        cvs.width = cvs.height = sz;
        const ctx = cvs.getContext('2d');
        const g = ctx.createRadialGradient(c, c, 0, c, c, c);
        g.addColorStop(0,    'rgba(255,255,255,1.0)');
        g.addColorStop(0.30, 'rgba(255,255,255,0.88)');
        g.addColorStop(0.60, 'rgba(255,255,255,0.42)');
        g.addColorStop(0.85, 'rgba(255,255,255,0.10)');
        g.addColorStop(1.0,  'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, sz, sz);
        return new THREE.CanvasTexture(cvs);
    }

    _makeCanvasSpikyTex() {
        const sz = 256, c = sz / 2;
        const cvs = document.createElement('canvas');
        cvs.width = cvs.height = sz;
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, sz, sz);
        // 10개 스파인
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const ex = c + Math.cos(a) * c * 0.92, ey = c + Math.sin(a) * c * 0.92;
            const gr = ctx.createLinearGradient(c, c, ex, ey);
            gr.addColorStop(0,   'rgba(255,255,255,0.95)');
            gr.addColorStop(0.4, 'rgba(255,255,255,0.55)');
            gr.addColorStop(1,   'rgba(255,255,255,0)');
            ctx.strokeStyle = gr;
            ctx.lineWidth   = 8;
            ctx.lineCap     = 'round';
            ctx.beginPath();
            ctx.moveTo(c, c);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }
        // 중심 소프트 도트
        const gc = ctx.createRadialGradient(c, c, 0, c, c, c * 0.22);
        gc.addColorStop(0,   'rgba(255,255,255,0.9)');
        gc.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = gc;
        ctx.beginPath(); ctx.arc(c, c, c * 0.22, 0, Math.PI * 2); ctx.fill();
        return new THREE.CanvasTexture(cvs);
    }

    _makeCanvasRingTex() {
        const sz = 256, c = sz / 2;
        const cvs = document.createElement('canvas');
        cvs.width = cvs.height = sz;
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, sz, sz);
        const r1 = c * 0.50, r2 = c * 0.88;
        const g = ctx.createRadialGradient(c, c, r1, c, c, r2);
        g.addColorStop(0,    'rgba(255,255,255,0)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.80, 'rgba(255,255,255,0.25)');
        g.addColorStop(1.0,  'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, sz, sz);
        return new THREE.CanvasTexture(cvs);
    }

    _loadBrushTextures() {
        // canvas fallback 먼저 세팅
        this.points.material.uniforms.uTexBlob.value  = this._makeCanvasBlobTex();
        this.points.material.uniforms.uTexSpiky.value = this._makeCanvasSpikyTex();
        this.points.material.uniforms.uTexRing.value  = this._makeCanvasRingTex();

        // 유저 커스텀 파일이 있으면 override (없어도 에러 없음)
        const loader = new THREE.TextureLoader();
        const tryLoad = (file, uniform) => {
            loader.load(
                `assets/${file}`,
                (t) => { this.points.material.uniforms[uniform].value = t; },
                undefined,
                () => { /* 파일 없으면 canvas fallback 유지 */ }
            );
        };
        tryLoad('brush_blob.png',  'uTexBlob');
        tryLoad('brush_spiky.png', 'uTexSpiky');
        tryLoad('brush_ring.png',  'uTexRing');
    }

    // ── PARTICLE POOL ─────────────────────────────────────────────────────────

    initPool() {
        this.positions = new Float32Array(this.maxParticles * 3);
        this.colors    = new Float32Array(this.maxParticles * 3);
        this.sizes     = new Float32Array(this.maxParticles);
        this.opacities = new Float32Array(this.maxParticles);
        this.types     = new Float32Array(this.maxParticles);
        this.rotations = new Float32Array(this.maxParticles);
        this.velocities = new Float32Array(this.maxParticles * 3);
        this.ages       = new Float32Array(this.maxParticles);
        this.baseScales = new Float32Array(this.maxParticles);
        this.rotSpeeds  = new Float32Array(this.maxParticles);
        this.active     = new Uint8Array(this.maxParticles);
        this.freeQueue  = Array.from({ length: this.maxParticles }, (_, i) => i);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('aColor',   new THREE.BufferAttribute(this.colors,    3));
        geometry.setAttribute('size',     new THREE.BufferAttribute(this.sizes,     1));
        geometry.setAttribute('opacity',  new THREE.BufferAttribute(this.opacities, 1));
        geometry.setAttribute('aType',    new THREE.BufferAttribute(this.types,     1));
        geometry.setAttribute('aRot',     new THREE.BufferAttribute(this.rotations, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTexBlob:  { value: null },
                uTexSpiky: { value: null },
                uTexRing:  { value: null },
            },
            vertexShader: `
                attribute float size;
                attribute vec3  aColor;
                attribute float opacity;
                attribute float aType;
                attribute float aRot;
                varying vec3  vColor;
                varying float vOpacity;
                varying float vType;
                varying float vRot;
                void main() {
                    vColor   = aColor;
                    vOpacity = opacity;
                    vType    = aType;
                    vRot     = aRot;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (400.0 / -mvPosition.z);
                    gl_Position  = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexBlob;
                uniform sampler2D uTexSpiky;
                uniform sampler2D uTexRing;

                varying vec3  vColor;
                varying float vOpacity;
                varying float vType;
                varying float vRot;

                void main() {
                    // 회전 UV
                    vec2  uv  = gl_PointCoord - vec2(0.5);
                    float c   = cos(vRot); float s = sin(vRot);
                    vec2  ruv = vec2(c * uv.x - s * uv.y,
                                    s * uv.x + c * uv.y) + vec2(0.5);

                    // 타입별 브러시 텍스처 샘플링
                    vec4 tex;
                    if      (vType < 0.5) tex = texture2D(uTexBlob,  ruv);
                    else if (vType < 1.5) tex = texture2D(uTexSpiky, ruv);
                    else                  tex = texture2D(uTexRing,  ruv);

                    // 알파: 텍스처 alpha × 파티클 opacity
                    float alpha = tex.a * vOpacity;
                    if (alpha < 0.001) discard;

                    // 색상: vColor 틴팅 (텍스처는 흰색 기준 → vColor 그대로)
                    // 텍스처에 자체 색이 있으면 mix(vColor, tex.rgb, 0.5)로 변경 가능
                    vec3 color = vColor * max(tex.r, max(tex.g, tex.b));

                    // 내부 코어 글로우 — 텍스처 무관하게 중심 약간 밝힘
                    float r    = length(uv);
                    float core = smoothstep(0.42, 0.0, r) * 0.38;
                    color = mix(color, min(color * 2.0, vec3(1.0)), core);

                    // 외곽 halo (텍스처 없이 간단히 거리 기반)
                    float halo = smoothstep(0.50, 0.30, r) * vOpacity * 0.20;
                    alpha = min(alpha + halo * (1.0 - alpha), 1.0);

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending:    THREE.NormalBlending,
            depthWrite:  false,
            depthTest:   false,
        });

        this.points = new THREE.Points(geometry, material);
        this.points.renderOrder = 0;
        this.scene.add(this.points);
    }

    // ── SPAWN PARTICLES ───────────────────────────────────────────────────────

    spawnParticles(audioData) {
        if (audioData.amplitude <= 0.01) return;

        const { bass, mid, high, frequency, complexity, waveform } = audioData;
        const total = bass + mid + high + 0.001;
        const count = Math.floor(5 + audioData.amplitude * 20);
        const _color = new THREE.Color();

        // ── Waveform → radial curve ───────────────────────────────────────────
        // 파형 48개 샘플을 방사형으로 배치 → 소리 모양을 따라가는 유기적 스폰 궤적
        const N      = 48;
        const step   = waveform ? Math.max(1, Math.floor(waveform.length / N)) : 1;
        const baseR  = this.viewH * 0.04 + audioData.amplitude * this.viewH * 0.18;
        const waveAmp = audioData.amplitude * this.viewH * 0.22;
        const curveX = new Float32Array(N);
        const curveY = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const val   = waveform ? (waveform[i * step] - 128) / 128 : 0; // -1 ~ 1
            const angle = (i / N) * Math.PI * 2;
            const r     = Math.max(0.05, baseR + val * waveAmp);
            curveX[i]   = this.spawnCX + Math.cos(angle) * r;
            curveY[i]   = this.spawnCY + Math.sin(angle) * r * 0.8;
        }

        for (let i = 0; i < count; i++) {
            if (this.freeQueue.length === 0) break;
            const idx = this.freeQueue.pop();

            // 파형 커브 위 랜덤 포인트 + 소량 지터
            const ci = Math.floor(Math.random() * N);
            const jitter = 0.25 + Math.random() * 0.35;
            this.positions[idx * 3]     = curveX[ci] + (Math.random() - 0.5) * jitter;
            this.positions[idx * 3 + 1] = curveY[ci] + (Math.random() - 0.5) * jitter * 0.8;
            this.positions[idx * 3 + 2] = 0;

            // 속도: radial outward + tangential swirl (curl noise 근사)
            const dx   = this.positions[idx * 3]     - this.spawnCX;
            const dy   = this.positions[idx * 3 + 1] - this.spawnCY;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
            const nx = dx / dist,  ny = dy / dist; // 방사형 단위벡터
            const tx = -ny,        ty = nx;         // 접선 단위벡터 (swirl)
            const speed = 0.012 + audioData.amplitude * 0.028;
            const swirl = 0.20 + complexity * 0.55; // complexity가 높을수록 소용돌이
            this.velocities[idx * 3]     = nx * speed + tx * speed * swirl;
            this.velocities[idx * 3 + 1] = ny * speed + ty * speed * swirl;
            this.velocities[idx * 3 + 2] = 0;

            const sRoll = Math.random();
            let sv;
            if (sRoll < 0.10)      sv = 3.5 + Math.random() * 4.0;
            else if (sRoll < 0.28) sv = 0.10 + Math.random() * 0.30;
            else                   sv = 0.90 + Math.random() * 2.20;
            this.baseScales[idx] = audioData.amplitude * 4 * sv;
            this.sizes[idx]      = this.baseScales[idx];

            const rType = Math.random() * total;
            if (rType < bass) {
                this.types[idx] = ShapeType.BLOB; this.rotSpeeds[idx] = 0;
            } else if (rType < bass + mid) {
                this.types[idx] = ShapeType.SPIKY; this.rotSpeeds[idx] = (Math.random()-0.5)*0.025;
            } else {
                this.types[idx] = ShapeType.RING; this.rotSpeeds[idx] = (Math.random()-0.5)*0.012;
            }
            this.rotations[idx] = Math.random() * Math.PI * 2;

            pickColor(bass, mid, high, frequency, complexity, this.palette, _color);
            this.colors[idx * 3]     = _color.r;
            this.colors[idx * 3 + 1] = _color.g;
            this.colors[idx * 3 + 2] = _color.b;

            this.ages[idx]      = 0;
            this.opacities[idx] = 0.65;
            this.active[idx]    = 1;
        }

        const geo = this.points.geometry;
        geo.attributes.position.needsUpdate = true;
        geo.attributes.aColor.needsUpdate   = true;
        geo.attributes.size.needsUpdate     = true;
        geo.attributes.opacity.needsUpdate  = true;
        geo.attributes.aType.needsUpdate    = true;
        geo.attributes.aRot.needsUpdate     = true;
    }

    updateParticles() {
        for (let idx = 0; idx < this.maxParticles; idx++) {
            if (!this.active[idx]) continue;
            this.positions[idx*3]   += this.velocities[idx*3];
            this.positions[idx*3+1] += this.velocities[idx*3+1];
            this.velocities[idx*3]   *= 0.97;
            this.velocities[idx*3+1] *= 0.97;
            this.rotations[idx]      += this.rotSpeeds[idx];
            const age = this.ages[idx];
            if (age < 120) {
                this.ages[idx]++;
                this.opacities[idx] = 0.65 - 0.35 * (age / 120);
                this.sizes[idx]     = this.baseScales[idx] * (1 + age * 0.001);
            }
        }
        const geo = this.points.geometry;
        geo.attributes.position.needsUpdate = true;
        geo.attributes.size.needsUpdate     = true;
        geo.attributes.opacity.needsUpdate  = true;
        geo.attributes.aRot.needsUpdate     = true;
    }

    clearParticles() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.active[i] = 0; this.sizes[i] = 0; this.opacities[i] = 0; this.ages[i] = 0;
        }
        this.freeQueue = Array.from({ length: this.maxParticles }, (_, i) => i);
        const geo = this.points.geometry;
        geo.attributes.size.needsUpdate    = true;
        geo.attributes.opacity.needsUpdate = true;
        this.clearLines();
        this.layerCounter = 1;
    }

    // ── LINE SYSTEM ───────────────────────────────────────────────────────────

    _lineColor(bass, mid, high, frequency, complexity) {
        const _c = new THREE.Color();
        const rSpec = Math.random();
        if (rSpec < 0.05) return new THREE.Color(0xFFFFFF);
        if (rSpec < 0.08) return new THREE.Color(Math.random()<0.5 ? this.palette.dark[0] : this.palette.dark[1]);
        pickColor(bass, mid, high, frequency, complexity, this.palette, _c);
        return _c;
    }

    spawnLine(audioData) {
        if (this.activeLines.length >= this.maxLines) return;
        const { bass, mid, high, frequency, complexity } = audioData;
        const style = Math.random();
        let numCtrl, stepSize, stepRandom;
        if (style < 0.35)      { numCtrl=3; stepSize=5+Math.random()*5;   stepRandom=0.4; }
        else if (style < 0.65) { numCtrl=4; stepSize=2.5+Math.random()*3; stepRandom=0.7; }
        else                   { numCtrl=7+Math.floor(Math.random()*5); stepSize=0.8+Math.random()*1.2; stepRandom=1.3; }

        const ctrl = [];
        let px = this.spawnCX + (Math.random()-0.5)*3;
        let py = this.spawnCY + (Math.random()-0.5)*3;
        ctrl.push(new THREE.Vector3(px, py, 0));
        const dx = (Math.random()-0.5), dy = (Math.random()-0.5)*0.7;
        for (let i=1; i<numCtrl; i++) {
            px += dx*stepSize + (Math.random()-0.5)*stepSize*stepRandom;
            py += dy*stepSize + (Math.random()-0.5)*stepSize*stepRandom*0.8;
            ctrl.push(new THREE.Vector3(px, py, 0));
        }

        const curve  = new THREE.CatmullRomCurve3(ctrl);
        const radius = style<0.35 ? 0.13+Math.random()*0.09
                     : style<0.65 ? 0.10+Math.random()*0.07
                     :              0.07+Math.random()*0.05;
        const geo = new THREE.TubeGeometry(curve, style<0.35?50:style<0.65?40:30, radius, 6, false);
        const mat = new THREE.MeshBasicMaterial({
            color:       this._lineColor(bass, mid, high, frequency, complexity),
            transparent: true,
            opacity:     0.65 + Math.random()*0.25,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
            depthTest:   false,
            side:        THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = this.layerCounter++;
        this.scene.add(mesh);
        this.activeLines.push({ mesh, material: mat });
    }

    clearLines() {
        for (const { mesh, material } of this.activeLines) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            material.dispose();
        }
        this.activeLines = [];
    }

    // ── EVENTS & RESIZE ───────────────────────────────────────────────────────

    addEvents() {
        window.addEventListener('resize', this.onResize.bind(this));
        this.startBtn.addEventListener('click', async () => {
            this.overlay.classList.add('hidden');
            await this.audioAnalyzer.init();
            this.animate();
        });
        window.addEventListener('keydown', (e) => {
            if (e.key==='q' || e.key==='Q') this.clearParticles();
        });
    }

    onResize() {
        this.width  = window.innerWidth;
        this.height = window.innerHeight;
        this.viewW  = this.viewH * (this.width / this.height);
        this.camera.left   = -this.viewW/2; this.camera.right  =  this.viewW/2;
        this.camera.top    =  this.viewH/2; this.camera.bottom = -this.viewH/2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }

    // ── MAIN LOOP ─────────────────────────────────────────────────────────────

    animate() {
        requestAnimationFrame(this.animate);
        const audioData = this.audioAnalyzer.getAudioData();

        this.spawnParticles(audioData);
        this.updateParticles();

        if (audioData.amplitude > 0.015) {
            this.voiceActive = true; this.silenceFrames = 0;
        } else if (this.voiceActive) {
            if (++this.silenceFrames >= 14) {
                this.voiceActive = false;
                this.spawnCX = (Math.random()-0.5) * this.viewW * 0.80;
                this.spawnCY = (Math.random()-0.5) * this.viewH * 0.80;
            }
        }

        this.lineTimer++;
        if (this.lineTimer >= 40 && audioData.amplitude > 0.04) {
            this.lineTimer = 0;
            this.spawnLine(audioData);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new App();
