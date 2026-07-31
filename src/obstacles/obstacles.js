// obstacles.js - Skalne przeszkody w korytarzu jaskini (poziom 10)
// WERSJA SAMODZIELNA: własny, dedykowany kontekst WebGL (window.obstacleMarbleGfx),
// niezależny od gpuLayer i od czegokolwiek innego w grze. Logika (ruch,
// kolizja z graczem) bez zmian względem oryginału.
//
// Marmur liczony jest proceduralnie w shaderze (funkcje fbm), a nie wypalany
// raz do wielkiej tekstury i "wycinany" - dzięki temu wzór nie powtarza się
// w sposób widoczny i jest spójny/ciągły pomiędzy sąsiednimi przeszkodami
// (bo shader liczy szum względem pozycji przeszkody w świecie gry).
// Podświetlenie lewej krawędzi / cień prawej krawędzi / ciemny kontur -
// wszystko w jednym przebiegu shadera (bez dodatkowych rect()/stroke()).

class Obstacle {
  constructor(x, y, width, length) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.length = length;

    // Zamrożona pozycja "narodzin" przeszkody - wzór marmuru liczymy
    // względem NIEJ (a nie względem this.x, które zmienia się co klatkę),
    // żeby tekstura była "wypalona" na skale i przesuwała się razem z nią,
    // zamiast przewijać się wewnątrz kształtu.
    this.spawnX = x;
    this.spawnY = y;
  }

  update(wallSpeed) {
    this.x += wallSpeed;
  }

  show() {
    // --- INICJALIZACJA SHADERA (TYLKO RAZ, WŁASNY BUFOR) ---
    if (typeof window.obstacleMarbleGfx === 'undefined') {
      window.obstacleMarbleGfx = createGraphics(300, 300, WEBGL);
      window.obstacleMarbleGfx.noStroke();

      const vert = `precision mediump float;
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      varying vec2 vTexCoord;
      void main() {
        vTexCoord = aTexCoord;
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
      }`;

      const frag = `precision highp float;
      varying vec2 vTexCoord;
      uniform vec2 uWorldPos; // lewy-gorny rog przeszkody w swiecie (ciaglosc wzoru)
      uniform vec2 uSize;     // szerokosc, dlugosc przeszkody w px

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float f = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
        return f;
      }

      void main() {
        // Wspolrzedne "swiata" - dzieki temu marmur wyglada spojnie/ciaglie
        // pomiedzy sasiednimi przeszkodami.
        vec2 worldPx = uWorldPos + vTexCoord * uSize;
        vec2 uv = worldPx / 300.0;

        vec2 q = vec2(fbm(uv * 8.0), fbm(uv * 8.0 + vec2(5.2, 1.3)));
        vec2 r = vec2(fbm(uv * 16.0 + 4.0 * q), fbm(uv * 16.0 + 4.0 * q + vec2(1.7, 9.2)));

        float n = fbm(uv * 12.0 + 4.0 * r);
        float marble = sin(uv.x * 15.0 + n * 10.0) * 0.5 + 0.5;
        marble = smoothstep(0.15, 0.85, marble);

        vec3 baseColor = vec3(0.85, 0.85, 0.82);
        vec3 veinColor = vec3(0.18, 0.18, 0.20);
        vec3 detailColor = vec3(0.55, 0.55, 0.50);

        vec3 color = mix(veinColor, detailColor, n);
        color = mix(color, baseColor, marble);

        float roughness = fbm(uv * 40.0);
        color *= mix(0.85, 1.1, roughness);

        // --- Pseudo-3D: jasna lewa krawedz / ciemna prawa krawedz ---
        float edgePx = 5.0;
        float edgeXNorm = edgePx / max(uSize.x, 1.0);
        float leftHighlight = 1.0 - smoothstep(0.0, edgeXNorm, vTexCoord.x);
        float rightShadow = smoothstep(1.0 - edgeXNorm, 1.0, vTexCoord.x);
        color += vec3(1.0) * leftHighlight * 0.22;
        color -= vec3(1.0) * rightShadow * 0.28;

        // --- Ciemny kontur zewnetrzny ---
        float conPx = 2.0;
        float conXNorm = conPx / max(uSize.x, 1.0);
        float conYNorm = conPx / max(uSize.y, 1.0);
        float inBorder = step(vTexCoord.x, conXNorm) + step(1.0 - conXNorm, vTexCoord.x)
                       + step(vTexCoord.y, conYNorm) + step(1.0 - conYNorm, vTexCoord.y);
        color = mix(color, vec3(0.16), min(inBorder, 1.0) * 0.9);

        // --- Przyciemnienie calosci (na zyczenie) ---
        color *= 0.6;

        gl_FragColor = vec4(color, 1.0);
      }`;

      window.obstacleMarbleShader = window.obstacleMarbleGfx.createShader(vert, frag);
    }

    let rectY = this.y - this.length / 2;
    let spawnRectY = this.spawnY - this.length / 2;

    // --- RENDEROWANIE MARMURU (GPU, wlasny bufor) ---
    window.obstacleMarbleGfx.clear();
    window.obstacleMarbleGfx.shader(window.obstacleMarbleShader);
    window.obstacleMarbleShader.setUniform('uWorldPos', [this.spawnX, spawnRectY]);
    window.obstacleMarbleShader.setUniform('uSize', [this.width, this.length]);
    window.obstacleMarbleGfx.rect(-150, -150, 300, 300);

    // --- WKLEJENIE NA GŁÓWNY CANVAS 2D, przeskalowane do rzeczywistego rozmiaru ---
    imageMode(CORNER);
    image(window.obstacleMarbleGfx, this.x, rectY, this.width, this.length);
  }

  collidesWithPlayer(player) {
    return rectRectCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y - this.length / 2, this.width, this.length
    );
  }
}