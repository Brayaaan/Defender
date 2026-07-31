// Wspólny vertex shader dla WSZYSTKICH bonusów/astronauty w tym pliku -
// rysowanych na współdzielonej warstwie gpuLayer (patrz game.js) zamiast
// osobnych createGraphics(). Standardowa macierz kamery p5, wiec fragment
// shadery ponizej dzialaja BEZ ZADNYCH ZMIAN (nadal czytaja "vUv").
const BONUS_SHARED_VERT_SRC = `precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

class ImmortalityBoost {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, -1);
    this.vy = 0;
    this.radius = 24; // Hitbox

    // --- NOWE: PARAMETRY POLIMERU ---
    this.baseSize = 10;
    this.offsets = [random(100), random(100), random(100)];
  }

  update(cave) {
    this.x += this.vx;
    this.y += this.vy;

    // --- NOWE: AKTUALIZACJA RUCHU NICI ---
    for (let i = 0; i < 3; i++) {
      this.offsets[i] += 0.05;
    }

    // Kolizja ze ścianami Jaskini (Twoja oryginalna logika)
    if (cave) {
      for (let i = 0; i < cave.topWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.topWalls[i].x, 0, cave.topWalls[i + 1].x - cave.topWalls[i].x, cave.topWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.topWalls[i].y + this.radius;
          break;
        }
      }
      for (let i = 0; i < cave.bottomWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.bottomWalls[i].x, cave.bottomWalls[i].y, cave.bottomWalls[i + 1].x - cave.bottomWalls[i].x, height - cave.bottomWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.bottomWalls[i].y - this.radius;
          break;
        }
      }
    }
  }

// początek shadera nieśmiertelności
  static initShaders(pg) {
    if (ImmortalityBoost.shadersLoaded) return;
    const frag = `precision highp float;
      varying vec2 vUv;
      uniform float uTime;

      float dot2( in vec2 v ) { return dot(v,v); }
      float sdHeart( in vec2 p ) {
          p.x = abs(p.x);
          if( p.y+p.x>1.0 ) return sqrt(dot2(p-vec2(0.25,0.75))) - sqrt(2.0)/4.0;
          return sqrt(min(dot2(p-vec2(0.00,1.00)), dot2(p-0.5*max(p.x+p.y,0.0)))) * sign(p.x-p.y);
      }

      void main() {
          vec2 p = (vUv - 0.5) * 2.0;

          float heartOffset = 0.2;
          vec2 pHeart = vec2(p.x, -p.y + heartOffset); // minus przed -p.y odwraca serce o 180 stopni

          float pulse = sin(uTime * 6.0) * 0.1 + 1.0;
          vec2 hp = pHeart * (2.2 / pulse);

          float d = sdHeart(hp);
          vec4 col = vec4(0.0);

          float core = smoothstep(0.05, 0.0, d);
          col.rgb += vec3(1.0, 0.0, 0.2) * core;

          float flash = smoothstep(0.1, -0.05, d + 0.15) * (0.5 + 0.5 * sin(uTime * 12.0));
          col.rgb += vec3(1.0) * flash;

          float glow = exp(-d * 5.0) * 0.8;
          col.rgb += vec3(1.0, 0.08, 0.3) * glow;

          float angle = atan(p.y, p.x);
          float radius = length(p);
          float threads = sin(radius * 15.0 - uTime * 4.0 + angle * 3.0);
          float ringMask = smoothstep(0.9, 0.6, radius) * smoothstep(0.3, 0.5, radius);
          float ringGlow = smoothstep(0.8, 1.0, threads) * ringMask * 0.6;
          col.rgb += vec3(1.0, 0.1, 0.4) * ringGlow;

          col.a = clamp(core + glow + ringGlow + flash, 0.0, 1.0);
          gl_FragColor = col;
      }`;
    ImmortalityBoost.shader = pg.createShader(BONUS_SHARED_VERT_SRC, frag);
    ImmortalityBoost.shadersLoaded = true;
  }

  show(pg) {
    ImmortalityBoost.initShaders(pg);
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.shader(ImmortalityBoost.shader);
    ImmortalityBoost.shader.setUniform('uTime', millis() / 1000.0);
    pg.plane(80, 80);
    pg.resetShader();
    pg.pop();
  }
// koniec shadera nieśmiertelności


  collected(player) {
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.radius
    );
  }
}

// Zaktualizowana klasa Humanoid z realistycznym, stabilnym rysunkiem 2D
class Humanoid {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = -1; // Stały ruch w lewo
    this.vy = random(-0.3, 0.3); // Niewielki ruch pionowy
    this.sizeX = 20;
    this.sizeY = 40;
    this.radius = 25; 
    this.angle = 0; 
    this.rotationSpeed = 0.015; 
    this.flashIndex = 0;
    this.morsePattern = [1,0,1,0,1,0, 1,1,1,0,1,1,1,0,1,1,1,0, 1,0,1,0,1]; // SOS
    this.unit = 10;
    this.frameCount = 0;
    this.lastFlashState = false; 
    this.isAbducted = false; 
    this.wasAbductedLastFrame = false;
    this.sparks1 = []; 
  }

  updateLampLogic() {
    this.frameCount++;
    if (this.frameCount >= this.unit) {
      this.frameCount = 0;
      this.flashIndex = (this.flashIndex + 1) % this.morsePattern.length;
    }

    const flashOn = this.morsePattern[this.flashIndex] === 1;
    if (flashOn && !this.lastFlashState) {
      if (typeof playSOSSound === 'function') {
        playSOSSound();
      }
    }
    this.lastFlashState = flashOn;
  }

  update(cave) {
    // 1. Obsługa porwania astronauty
    this.wasAbductedLastFrame = this.isAbducted; 
    if (this.isAbducted) {
      this.x += this.vx;
      this.y += this.vy;
      this.angle += this.rotationSpeed * 3; // Szybsza rotacja w wirze
      
      this.updateLampLogic(); 
      
      this.isAbducted = false; 
      return; 
    }

    // 2. Standardowy ruch
    this.x += this.vx;
    this.y += this.vy;
    this.angle += this.rotationSpeed;

    // 3. Odbicie od górnej i dolnej krawędzi ekranu
    if (this.y - this.radius < 0) {
      this.vy = -this.vy;
      this.y = this.radius;
    } else if (this.y + this.radius > height) {
      this.vy = -this.vy;
      this.y = height - this.radius;
    }

    // 4. Kolizja ze ścianami Jaskini
    if (cave) {
      for (let i = 0; i < cave.topWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.topWalls[i].x, 0, cave.topWalls[i + 1].x - cave.topWalls[i].x, cave.topWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.topWalls[i].y + this.radius;
          break;
        }
      }
      for (let i = 0; i < cave.bottomWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.bottomWalls[i].x, cave.bottomWalls[i].y, cave.bottomWalls[i + 1].x - cave.bottomWalls[i].x, height - cave.bottomWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.bottomWalls[i].y - this.radius;
          break;
        }
      }
    }

    this.updateLampLogic();
  }

  static initShaders(pg) {
    if (Humanoid.shadersLoaded) return;
    const frag = `precision highp float;
      varying vec2 vUv;
      
      uniform float uTime;
      uniform float uFlash;
      uniform float uAbducted;

      float smin(float a, float b, float k) {
          float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
          return mix( b, a, h ) - k*h*(1.0-h);
      }

      float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
          vec2 pa = p - a, ba = b - a;
          float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
          return length(pa - ba*h) - r;
      }

      float sdCapsuleTaper(vec2 p, vec2 a, vec2 b, float ra, float rb) {
          vec2 pa = p - a, ba = b - a;
          float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
          float r = mix(ra, rb, h);
          return length(pa - ba*h) - r;
      }
      
      float sdRoundBox(vec2 p, vec2 b, float r) {
          vec2 q = abs(p) - b;
          return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r;
      }

      float suitSDF(vec2 p) {
          float torso = sdCapsuleTaper(p, vec2(0.0, -9.5), vec2(0.0, 4.0), 6.8, 7.4);
          float hips  = sdRoundBox(p - vec2(0.0, 5.8), vec2(6.2, 2.4), 2.6);
          return smin(torso, hips, 3.0);
      }

      void main() {
        vec2 p = (vUv - 0.5) * 120.0;
        vec4 col = vec4(0.0);
        #define BLEND(dist, rgb) col = mix(col, vec4(rgb, 1.0), smoothstep(0.6, -0.6, dist))

        float moveX = sin(uTime * 2.0) * 1.2;
        float moveY = cos(uTime * 1.5) * 1.2;

        float backpack = sdRoundBox(p - vec2(-7.2, -1.0), vec2(3.0, 9.5), 2.2);

        float torso = sdCapsuleTaper(p, vec2(0.0, -9.5), vec2(0.0, 4.0), 6.8, 7.4);
        float hips  = sdRoundBox(p - vec2(0.0, 5.8), vec2(6.2, 2.4), 2.6);

        float legL = sdCapsuleTaper(p, vec2(-3.0, 6.5), vec2(-4.0 + moveY * 0.3, 20.0), 3.4, 2.5);
        float legR = sdCapsuleTaper(p, vec2(3.0, 6.5), vec2(4.0 - moveY * 0.3, 20.0), 3.4, 2.5);
        float bootL = sdRoundBox(p - vec2(-4.0 + moveY * 0.3, 21.5), vec2(3.0, 2.4), 1.4);
        float bootR = sdRoundBox(p - vec2(4.0 - moveY * 0.3, 21.5), vec2(3.0, 2.4), 1.4);

        float armL = sdCapsuleTaper(p, vec2(-6.6, -6.0), vec2(-9.5 + moveX * 0.6, 6.0 - moveX), 3.2, 2.2);
        float armR = sdCapsuleTaper(p, vec2(6.6, -6.0), vec2(9.5 - moveX * 0.6, 6.0 + moveX), 3.2, 2.2);
        float gloveL = length(p - vec2(-9.5 + moveX * 0.6, 6.0 - moveX)) - 2.4;
        float gloveR = length(p - vec2(9.5 - moveX * 0.6, 6.0 + moveX)) - 2.4;

        float neck = sdCapsule(p, vec2(0.0, -10.5), vec2(0.0, -8.0), 3.2);

        float suit = smin(torso, hips, 3.0);
        suit = smin(suit, legL, 2.2);
        suit = smin(suit, legR, 2.2);
        suit = smin(suit, bootL, 1.2);
        suit = smin(suit, bootR, 1.2);
        suit = smin(suit, armL, 2.0);
        suit = smin(suit, armR, 2.0);
        suit = smin(suit, gloveL, 1.0);
        suit = smin(suit, gloveR, 1.0);
        suit = smin(suit, neck, 2.0);

        float helmet = length(p - vec2(0.0, -15.5)) - 9.2;
        float visor  = length(p - vec2(0.0, -15.0)) - 6.8;

        BLEND(backpack, vec3(0.55, 0.57, 0.6));
        BLEND(suit, vec3(0.93, 0.92, 0.90));

        float eps = 0.6;
        float suitPX = suitSDF(p + vec2(eps, 0.0));
        float suitNX = suitSDF(p - vec2(eps, 0.0));
        float gradx = (suitPX - suitNX) / (2.0 * eps);
        if (suit < 0.0) {
            float shade = clamp(-gradx * 0.35, -0.12, 0.12);
            col.rgb += shade;
            float ao = clamp(exp(suit * 0.2) * 0.10, 0.0, 0.10);
            col.rgb -= ao;
        }

        float belt = sdRoundBox(p - vec2(0.0, 4.4), vec2(6.6, 1.1), 0.8);
        float beltMix = smoothstep(0.6, -0.6, belt) * step(suit, 0.8);
        col.rgb = mix(col.rgb, vec3(0.8, 0.16, 0.16), beltMix);
        col.a = max(col.a, beltMix);

        float panel = sdRoundBox(p - vec2(0.0, -4.0), vec2(2.6, 2.0), 0.6);
        float panelMix = smoothstep(0.6, -0.6, panel) * step(suit, 0.8);
        col.rgb = mix(col.rgb, vec3(0.25, 0.27, 0.32), panelMix);
        col.a = max(col.a, panelMix);

        float btnMask = step(suit, 0.8);
        float btn1 = smoothstep(0.5, -0.5, length(p - vec2(-1.2, -4.5)) - 0.5) * btnMask;
        float btn2 = smoothstep(0.5, -0.5, length(p - vec2(0.2, -4.5)) - 0.5) * btnMask;
        float btn3 = smoothstep(0.5, -0.5, length(p - vec2(1.2, -3.4)) - 0.5) * btnMask;
        col.rgb = mix(col.rgb, vec3(0.9, 0.2, 0.2), btn1);
        col.rgb = mix(col.rgb, vec3(0.2, 0.7, 0.3), btn2);
        col.rgb = mix(col.rgb, vec3(0.9, 0.75, 0.15), btn3);
        col.a = max(col.a, max(btn1, max(btn2, btn3)));

        float helmetShell = max(helmet, -visor);
        BLEND(helmetShell, vec3(0.97, 0.97, 0.99));

        if (suit < 0.0 && helmet > -1.0 && p.y > -9.0 && p.y < -5.0) {
            col.rgb -= 0.06;
        }

        if (visor < 0.0) {
            float s = smoothstep(0.6, -0.6, visor);
            float tgrad = clamp((p.y + 19.0) / 8.0, 0.0, 1.0);
            vec3 visorTop = vec3(0.05, 0.25, 0.45);
            vec3 visorBottom = vec3(0.01, 0.03, 0.08);
            vec3 vc = mix(visorBottom, visorTop, tgrad);
            col.rgb = mix(col.rgb, vc, s);

            float dReflect = sdRoundBox(p - vec2(-2.0, -17.0), vec2(1.8, 0.9), 0.9);
            float rs = smoothstep(1.2, -0.5, dReflect) * 0.85;
            col.rgb = mix(col.rgb, vec3(1.0), rs);
            col.a = 1.0;
        }

        float dLight = length(p - vec2(8.2, -7.0)) - 2.0;
        vec3 lightColorOff = vec3(0.35, 0.32, 0.30);
        vec3 lightColorOn  = vec3(1.0, 0.95, 0.8);
        BLEND(dLight, mix(lightColorOff, lightColorOn, uFlash));

        float flashGlow = smoothstep(40.0, 0.0, dLight) * 0.4 * uFlash;
        flashGlow += smoothstep(14.0, 0.0, dLight) * 1.0 * uFlash;
        col.rgb += vec3(1.0, 0.85, 0.35) * flashGlow;
        col.a = max(col.a, flashGlow);

        if (uAbducted > 0.5) {
            float r = length(p);
            float pulse = sin(uTime * 15.0) * 5.0;
            float ring = abs(r - (35.0 + pulse));
            float aura = smoothstep(2.5, 0.0, ring);
            float bgGlow = smoothstep(45.0, 0.0, r) * 0.35;

            vec3 auraColor = vec3(0.0, 1.0, 0.86);
            col.rgb += auraColor * (aura + bgGlow);
            col.a = max(col.a, aura + bgGlow);
        }

        gl_FragColor = col;
      }`;
    Humanoid.astroShader = pg.createShader(BONUS_SHARED_VERT_SRC, frag);
    Humanoid.shadersLoaded = true;
  }

  // pg = warstwa p5.Graphics w trybie WEBGL (gpuLayer z game.js).
  // Shader astronauty (Humanoid.astroShader) jest WSPÓŁDZIELONY z cruiser.js
  // (tam używany do rysowania astronautów wciąganych do krążownika).
  show(pg) {
    Humanoid.initShaders(pg);
    const flashOn = this.morsePattern[this.flashIndex] === 1;

    // Ciało astronauty (shader, na współdzielonej warstwie GPU)
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.rotate(this.angle);
    pg.noStroke();
    pg.shader(Humanoid.astroShader);
    Humanoid.astroShader.setUniform('uTime', millis() / 1000.0);
    Humanoid.astroShader.setUniform('uFlash', flashOn ? 1.0 : 0.0);
    Humanoid.astroShader.setUniform('uAbducted', this.wasAbductedLastFrame ? 1.0 : 0.0);
    pg.plane(100, 100);
    pg.resetShader();
    pg.pop();

    // --- FIZYKA CZĄSTECZEK (Iskry Porwania - 2D, na globalnym canvasie) ---
    push();
    translate(this.x, this.y);
    rotate(this.angle);

    if (this.wasAbductedLastFrame) {
      if (frameCount % 3 === 0) {
        this.sparks1.push(new Spark1(0, 0));
      }
    }

    for (let i = this.sparks1.length - 1; i >= 0; i--) {
      this.sparks1[i].update();
      this.sparks1[i].show();
      if (this.sparks1[i].isFinished()) {
        this.sparks1.splice(i, 1);
      }
    }

    pop();
  }


  collected(player) {
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.radius
    );
  }
}

class ShieldBoost {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, -1);
    this.vy = 0;
    this.radius = 15; // Hitbox pozostaje bez zmian
    
    // --- NOWE: PARAMETRY POLIMERU ---
    this.baseSize = 8; // Rozmiar bazowy z Twojego pliku HTML
    this.offsets = [random(100), random(100), random(100)];
  }

  update(cave) {
    this.x += this.vx;
    this.y += this.vy;

    // --- NOWE: AKTUALIZACJA RUCHU NICI ---
    for (let i = 0; i < 3; i++) {
      this.offsets[i] += 0.05;
    }

    // Kolizja ze ścianami Jaskini (Twoja oryginalna logika)
    if (cave) {
      for (let i = 0; i < cave.topWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.topWalls[i].x, 0, cave.topWalls[i + 1].x - cave.topWalls[i].x, cave.topWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.topWalls[i].y + this.radius;
          break;
        }
      }
      for (let i = 0; i < cave.bottomWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.bottomWalls[i].x, cave.bottomWalls[i].y, cave.bottomWalls[i + 1].x - cave.bottomWalls[i].x, height - cave.bottomWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.bottomWalls[i].y - this.radius;
          break;
        }
      }
    }
  }

  static initShaders(pg) {
    if (ShieldBoost.shadersLoaded) return;
    const frag = `precision highp float;
      varying vec2 vUv;
      uniform float uTime;

      void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          
          float radius = length(p);
          float angle = atan(p.y, p.x);
          
          vec4 col = vec4(0.0);
          vec3 neonColor = vec3(0.0, 0.85, 1.0);
          
          float pulse = sin(uTime * 9.0) * 0.05 + 1.0;
          float coreRadius = 0.15 * pulse;
          float core = smoothstep(coreRadius + 0.02, coreRadius - 0.02, radius);
          
          float whiteCore = smoothstep(0.1, 0.0, radius) * (0.7 + 0.3 * sin(uTime * 15.0));
          
          float coreGlow = exp(-radius * 7.0) * 0.8;
          
          float v1 = sin(radius * 12.0 - uTime * 5.0 + angle * 3.0);
          float mask1 = smoothstep(0.65, 0.4, radius) * smoothstep(0.15, 0.35, radius);
          float glow1 = smoothstep(0.7, 1.0, v1) * mask1 * 0.8;
          
          float v2 = sin(radius * 18.0 + uTime * 3.5 - angle * 5.0);
          float mask2 = smoothstep(0.95, 0.7, radius) * smoothstep(0.5, 0.65, radius);
          float glow2 = smoothstep(0.6, 1.0, v2) * mask2 * 0.6;
          
          col.rgb += neonColor * (core + coreGlow + glow1 + glow2);
          col.rgb += vec3(1.0) * whiteCore;
          
          col.a = clamp(core + whiteCore + coreGlow + glow1 + glow2, 0.0, 1.0);
          
          gl_FragColor = col;
      }`;
    ShieldBoost.shader = pg.createShader(BONUS_SHARED_VERT_SRC, frag);
    ShieldBoost.shadersLoaded = true;
  }

  show(pg) {
    ShieldBoost.initShaders(pg);
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.shader(ShieldBoost.shader);
    ShieldBoost.shader.setUniform('uTime', millis() / 1000.0);
    pg.plane(80, 80);
    pg.resetShader();
    pg.pop();
  }


  collected(player) {
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.radius
    );
  }
}

class BombBoost {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, -1);
    this.vy = 0;
    this.radius = 15; // Hitbox pozostaje bez zmian
    
    // --- NOWE: PARAMETRY POLIMERU ---
    this.baseSize = 8;
    this.offsets = [random(100), random(100), random(100)];
  }

  update(cave) {
    this.x += this.vx;
    this.y += this.vy;

    // --- NOWE: AKTUALIZACJA RUCHU NICI ---
    for (let i = 0; i < 3; i++) {
      this.offsets[i] += 0.05;
    }

    // Kolizja ze ścianami Jaskini (Twoja oryginalna logika)
    if (cave) {
      for (let i = 0; i < cave.topWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.topWalls[i].x, 0, cave.topWalls[i + 1].x - cave.topWalls[i].x, cave.topWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.topWalls[i].y + this.radius;
          break;
        }
      }
      for (let i = 0; i < cave.bottomWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.bottomWalls[i].x, cave.bottomWalls[i].y, cave.bottomWalls[i + 1].x - cave.bottomWalls[i].x, height - cave.bottomWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.bottomWalls[i].y - this.radius;
          break;
        }
      }
    }
  }

// shader bonusa bomb- początek
  static initShaders(pg) {
    if (BombBoost.shadersLoaded) return;
    const frag = `precision highp float;
      varying vec2 vUv;
      uniform float uTime;

      void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float radius = length(p);
          float angle = atan(p.y, p.x);
          
          vec4 col = vec4(0.0);
          
          vec3 purple = vec3(0.6, 0.1, 1.0);  
          vec3 redRingColor = vec3(0.85, 0.1, 0.05);
          vec3 intenseRed = vec3(1.0, 0.0, 0.0);
          
          float edgeFade = smoothstep(0.98, 0.82, radius);
          
          float pulse = sin(uTime * 4.0) * 0.02 + 1.0;
          float coreRadius = 0.11 * pulse;
          float core = smoothstep(coreRadius + 0.02, coreRadius - 0.02, radius);
          float coreGlow = exp(-radius * 7.0) * 0.6;
          
          float v1 = sin(radius * 12.0 - uTime * 3.5 + angle * 5.0);
          float mask1 = smoothstep(0.75, 0.3, radius) * smoothstep(0.1, 0.25, radius);
          float swirl1 = smoothstep(0.6, 1.0, v1) * mask1 * 0.8;
          
          float v2 = sin(radius * 14.0 - uTime * 3.0 - angle * 1.0);
          float mask2 = smoothstep(0.9, 0.4, radius) * smoothstep(0.2, 0.35, radius);
          float swirl2 = smoothstep(0.6, 1.0, v2) * mask2 * 0.8;
          
          float ringSpeed = 1.0;
          float progress = fract(uTime * ringSpeed);
          float currentRingRadius = mix(0.12, 0.88, progress);
          
          float dustNoise = fract(sin(dot(p + fract(uTime), vec2(12.9898, 78.233))) * 43758.5453);
          float dissolveStart = 0.4;
          float dissolveFactor = smoothstep(dissolveStart, 0.98, progress);
          
          float ringDist = abs(radius - currentRingRadius);
          float mainRing = smoothstep(0.05, 0.0, ringDist);
          
          mainRing *= step(dissolveFactor * 0.8, dustNoise);
          
          float outerRingRadius = currentRingRadius + 0.025;
          float outerRingDist = abs(radius - outerRingRadius);
          float outerRing = smoothstep(0.015, 0.002, outerRingDist);
          
          outerRing *= step(dissolveFactor * 0.95, dustNoise);
          
          col.rgb += purple * (swirl1 + swirl2 + coreGlow);
          col.rgb += redRingColor * mainRing * 1.8;
          col.rgb += intenseRed * outerRing * 2.5; 
          col.rgb += vec3(1.0) * core;
          
          col.a = clamp(core + coreGlow + swirl1 + swirl2 + mainRing + outerRing, 0.0, 1.0) * edgeFade;
          
          gl_FragColor = col;
      }`;
    BombBoost.shader = pg.createShader(BONUS_SHARED_VERT_SRC, frag);
    BombBoost.shadersLoaded = true;
  }

  show(pg) {
    BombBoost.initShaders(pg);
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.shader(BombBoost.shader);
    BombBoost.shader.setUniform('uTime', millis() / 1000.0);
    pg.plane(80, 80);
    pg.resetShader();
    pg.pop();
  }
// shader bonusa bomb- koniec

// shader bonusa bomb- koniec

  collected(player) {
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.radius
    );
  }
}

class WeaponUpgrade {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, -1);
    this.vy = 0;
    this.radius = 20; // Hitbox bez zmian

    // --- NOWE: PARAMETRY POLIMERU ---
    this.baseSize = 8;
    this.offsets = [random(100), random(100), random(100)];
  }

  update(cave) {
    this.x += this.vx;
    this.y += this.vy;

    // --- NOWE: AKTUALIZACJA RUCHU NICI ---
    for (let i = 0; i < 3; i++) {
      this.offsets[i] += 0.05;
    }

    // Kolizja ze ścianami Jaskini (Twoja oryginalna logika)
    if (cave) {
      for (let i = 0; i < cave.topWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.topWalls[i].x, 0, cave.topWalls[i + 1].x - cave.topWalls[i].x, cave.topWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.topWalls[i].y + this.radius;
          break;
        }
      }
      for (let i = 0; i < cave.bottomWalls.length - 1; i++) {
        if (rectCircleCollision(
          cave.bottomWalls[i].x, cave.bottomWalls[i].y, cave.bottomWalls[i + 1].x - cave.bottomWalls[i].x, height - cave.bottomWalls[i].y,
          this.x, this.y, this.radius
        )) {
          this.vy = -this.vy;
          this.y = cave.bottomWalls[i].y - this.radius;
          break;
        }
      }
    }
  }

// shader bonusa broni- początek
  static initShaders(pg) {
    if (WeaponUpgrade.shadersLoaded) return;
    const frag = `precision highp float;
      varying vec2 vUv;
      uniform float uTime;

      void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float radius = length(p);
          float angle = atan(p.y, p.x);
          
          vec4 col = vec4(0.0);
          
          vec3 laserGreen = vec3(6.0, 1.0, 0.35);
          vec3 electricGold = vec3(1.0, 0.75, 0.0);
          
          float edgeFade = smoothstep(0.98, 0.82, radius);
          
          float corePulse = sin(uTime * 6.0) * 0.015 + 0.09;
          float core = smoothstep(corePulse + 0.015, corePulse - 0.015, radius);
          float coreGlow = exp(-radius * 7.5) * 0.7;
          
          float rotAngle = uTime * 1.4; 
          mat2 rotMat = mat2(cos(rotAngle), -sin(rotAngle), sin(rotAngle), cos(rotAngle));
          vec2 pRot = rotMat * p;
          
          float laserX = smoothstep(0.015, 0.002, abs(pRot.x));
          float laserY = smoothstep(0.015, 0.002, abs(pRot.y));
          float crosshair = (laserX + laserY) * smoothstep(0.75, 0.2, radius);
          
          float chargeWaves = sin(radius * 10.0 - uTime * 14.0 + angle * 0.0);
          float chargeMask = smoothstep(0.85, 0.4, radius) * smoothstep(0.15, 0.45, radius);
          float energyInflow = smoothstep(0.75, 1.0, chargeWaves) * chargeMask;
          
          float rotor = sin(angle * 3.0 - uTime * 9.0);
          float rotorMask = smoothstep(0.6, 0.18, radius) * smoothstep(0.08, 0.15, radius);
          float plasmaBlades = smoothstep(0.2, 0.8, rotor) * rotorMask;
          
          col.rgb += laserGreen * (crosshair * 1.8 + plasmaBlades * 1.2 + coreGlow);
          col.rgb += electricGold * (energyInflow * 1.3 + plasmaBlades * 0.5);
          
          col.rgb += vec3(1.0) * core;
          
          col.a = clamp(core + coreGlow + crosshair + energyInflow + plasmaBlades, 0.0, 1.0) * edgeFade;
          
          gl_FragColor = col;
      }`;
    WeaponUpgrade.shader = pg.createShader(BONUS_SHARED_VERT_SRC, frag);
    WeaponUpgrade.shadersLoaded = true;
  }

  show(pg) {
    WeaponUpgrade.initShaders(pg);
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.shader(WeaponUpgrade.shader);
    WeaponUpgrade.shader.setUniform('uTime', millis() / 1000.0);
    pg.plane(100, 100);
    pg.resetShader();
    pg.pop();
  }
// shader bonusa broni- koniec

// shader bonusa broni- koniec

  collected(player) {
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.radius
    );
  }
}

// klasa iskier dla porwanego astronauty
class Spark1 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    let angle = random(TWO_PI);
    let speed = random(0.5, 2);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.alpha = 255;
    this.size = random(1, 3);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 5; // Tempo znikania
  }

  // początek shadera
  show() {
    push();
    // Przenosimy układ współrzędnych do pozycji iskry
    translate(this.x, this.y);
    
    // Obliczamy kąt (kierunek) lotu iskry na podstawie jej prędkości
    let heading = atan2(this.vy, this.vx);
    rotate(heading); // Obracamy iskrę pyszczkiem w kierunku lotu

    noStroke();

    // 1. Zewnętrzna, miękka poświata (Twój seledynowy kolor)
    // Alfa jest mnożona przez 0.3, aby poświata była delikatnie przezroczysta
    fill(0, 255, 220, this.alpha * 0.3);
    // Rysujemy elipsę rozciągniętą mocno w poziomie (kierunek lotu) i wąską w pionie
    ellipse(0, 0, this.size * 5.0, this.size * 1.5);

    // 2. Gorący, skondensowany rdzeń iskry (prawie biały, lekko seledynowy)
    fill(200, 255, 240, this.alpha);
    // Rdzeń jest mniejszy, ale również lekko rozciągnięty w ruchu
    ellipse(0, 0, this.size * 2.0, this.size * 0.8);

    pop();
  }
  // koniec szadera

  isFinished() {
    return this.alpha <= 0;
  }
}