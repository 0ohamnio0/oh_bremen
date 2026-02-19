// Particle shape type constants
// Used in spawnParticles() and the fragment shader's vType branch
export const ShapeType = {
    BLOB:  0, // Soft radial glow        — bass
    SPIKY: 1, // 8-point burst / sun     — mid
    RING:  2, // Hollow glowing ring     — high
};

export class TextureGenerator {
    static createBrushTexture() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Radial Gradient (Soft White Blob — tinted by material color via AdditiveBlending)
        const cx = size / 2;
        const cy = size / 2;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);

        gradient.addColorStop(0,   'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1,   'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        console.log("Generated Gradient Texture");
        return canvas;
    }
}
