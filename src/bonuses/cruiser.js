// Wspólny vertex shader dla shaderów krążownika w tym pliku - rysowanych
// na współdzielonej warstwie gpuLayer (patrz game.js) zamiast osobnych
// createGraphics(). Standardowa macierz kamery p5, więc fragment shadery
// poniżej działają BEZ ŻADNYCH ZMIAN (nadal czytają "vUv").
const CRUISER_SHARED_VERT_SRC = `precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

class Key {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = -0.8; // Prędkość krążownika
    this.vy = 0;
    this.radius = 8;
    this.width = 300; // Szerokość krążownika
    this.height = 130; // Wysokość krążownika

    this.astronautsInTransit = []; // Tablica astronautów w tranzycie
    this.lastAstronautTime = 0; // Czas ostatniego przekazania
    this.transferInterval = 60; // 1 sekunda przy 60 FPS
    this.flashTimer = 0; // Timer dla migania świateł
    
    // --- NOWE WSPÓŁRZĘDNE WŁAZU ---
    // Obliczone na podstawie logiki shadera, idealnie w centrum fioletowego wiru
    this.hatchX = -20; 
    this.hatchY = 0; 
  }

  update(cave, player) {
    this.x += this.vx;
    this.y += this.vy;

    // Mechanika przekazywania astronautów
    if (astronautCount > 0 && frameCount - this.lastAstronautTime >= this.transferInterval) {
      if (this.overCruiser(player)) {
        playSoundTransferAstronautow();
        this.astronautsInTransit.push({ x: player.x, y: player.y, angle: 0, rotationSpeed: 0.02, flashIndex: 0, frameCount: 0 });
        astronautCount--;
        score += 500; // Dodanie 500 punktów za przekazanie astronauty
        this.lastAstronautTime = frameCount;
        this.flashTimer = 15; // Miganie na 15 klatek
      }
    }

    // --- POPRAWIONA FIZYKA PRZYCIĄGANIA DO WŁAZU ---
    for (let i = this.astronautsInTransit.length - 1; i >= 0; i--) {
      let astronaut = this.astronautsInTransit[i];
      
      // Astronauta porusza się razem ze statkiem, co eliminuje problem gonienia go od tyłu
      astronaut.x += this.vx;
      astronaut.y += this.vy;

      let targetX = this.x + this.hatchX;
      let targetY = this.y + this.hatchY;
      let dx = targetX - astronaut.x;
      let dy = targetY - astronaut.y;
      let distance = sqrt(dx * dx + dy * dy);
      
      // Skala do efektu kurczenia się (od 1.0 do 0.4 blisko centrum włazu)
      astronaut.scale = constrain(distance / 80.0, 0.4, 1.0);

      if (distance > 2) { // Zmniejszony promień, aby wpadali idealnie w sam środek
        astronaut.x += dx * 0.03;   // Zwiększona siła "ssania" włazu
        astronaut.y += dy * 0.03;   // czyli prędkość przekazywania astronautów, największa to 1.5
        
        astronaut.frameCount++;
        if (astronaut.frameCount >= 10) { // Upraszczona animacja lampki
          astronaut.frameCount = 0;
          astronaut.flashIndex = (astronaut.flashIndex + 1) % 2; // Prosta zmiana ON/OFF
        }
      } else {
        this.astronautsInTransit.splice(i, 1); // Całkowite pochłonięcie
      }
    }

    if (this.flashTimer > 0) this.flashTimer--;
  }

  // ⭐ NOWA METODA: Generowanie i rysowanie 4 strug ognia ze wspólnego shadera ⭐
  // ⭐ METODA: Generowanie i rysowanie 4 strug ognia ze wspólnego shadera ⭐
  static initShaders(pg) {
    if (Key.shadersLoaded) return;

    // --- SHADER OGNIA SILNIKÓW ---
    const fragEngine = `precision mediump float;
      varying vec2 vUv;
      uniform float uTime;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float f = 0.0; float a = 0.5;
        for(int i = 0; i < 3; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
        return f;
      }

      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        
        float startX = -0.7; 
        float distRight = uv.x - startX;

        vec3 finalColor = vec3(0.0);
        float finalAlpha = 0.0;

        if (distRight > 0.0) {
            float maxFlameLen = 1.7;
            float nx = distRight / maxFlameLen;

            if (nx < 1.0) {
                float width = mix(0.45, 0.3, nx);
                float profile = 1.0 - smoothstep(0.0, width, abs(uv.y));

                if (profile > 0.0) {
                    vec2 noiseUv = vec2(distRight * 12.0 - uTime * 25.0, uv.y * 20.0);
                    float turb = fbm(noiseUv);

                    float intensity = profile * pow(1.0 - nx, 1.2) * (0.4 + 0.6 * turb);

                    vec3 coreColor = vec3(1.0, 1.0, 0.7);
                    vec3 midColor  = vec3(1.0, 0.6, 0.0);
                    vec3 tipColor  = vec3(1.0, 0.1, 0.0);

                    vec3 fireColor = mix(tipColor, midColor, smoothstep(0.2, 0.6, intensity));
                    fireColor = mix(fireColor, coreColor, smoothstep(0.6, 1.0, intensity));

                    finalColor = fireColor * intensity * 2.5; 
                    finalAlpha = intensity;
                }
            }
        }
        gl_FragColor = vec4(finalColor, finalAlpha);
      }`;
    Key.engineShader = pg.createShader(CRUISER_SHARED_VERT_SRC, fragEngine);

    // --- SHADER KADŁUBA KRĄŻOWNIKA ---
    const fragCruiser = `precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uHatchOpen;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }

      float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
      float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
        vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
        vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
        vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
        vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
        vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
        float s = sign(e0.x * e2.y - e0.y * e2.x);
        vec2 d0 = vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x));
        vec2 d1 = vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x));
        vec2 d2 = vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x));
        vec2 d = min(min(d0, d1), d2);
        return -sqrt(d.x) * sign(d.y);
      }

      const float TAIL_X = -58.0; 
      const float BODY_R = 15.0;
      const float NOSE_TIP = 220.0; 
      const float BODY_FRONT = 170.0; 

      float radiusAtSafe(float x) {
        if (x <= BODY_FRONT) return BODY_R;
        float t = clamp((NOSE_TIP - x) / (NOSE_TIP - BODY_FRONT), 0.0, 1.0);
        return BODY_R * t;
      }

      float sdTubeCone(vec2 p) {
        float r = radiusAtSafe(p.x);
        float distY = abs(p.y) - r;
        float distFront = p.x - NOSE_TIP;
        float distBack = TAIL_X - p.x;
        return max(max(distY, distFront), distBack);
      }

      float sdFlatParts(vec2 p) {
        float wingBase = sdBox(p - vec2(-48.0, 0.0), vec2(10.0, 60.0));
      
        float wingTopRect = sdBox(p - vec2(-13.0, -37.5), vec2(25.0, 22.5));
        float wingTopTri  = sdTriangle(p, vec2(12.0, -60.0), vec2(85.0, -15.0), vec2(12.0, -15.0));
        float wingTop = min(wingTopRect, wingTopTri);
      
        float wingBotRect = sdBox(p - vec2(-13.0,  37.5), vec2(25.0, 22.5));
        float wingBotTri  = sdTriangle(p, vec2(12.0,  60.0), vec2(85.0,  15.0), vec2(12.0,  15.0));
        float wingBot = min(wingBotRect, wingBotTri);

        vec2 pt = p - vec2(62.5, -37.5); pt.x -= pt.y * 1.622; float podTop = sdBox(pt, vec2(15.0, 8.0));
        vec2 pb = p - vec2(62.5,  37.5); pb.x += pb.y * 1.622; float podBot = sdBox(pb, vec2(15.0, 8.0));

        float e1 = sdBox(p - vec2(-61.0, -45.0), vec2(3.0, 8.0));
        float e2 = sdBox(p - vec2(-61.0, -15.0), vec2(3.0, 8.0));
        float e3 = sdBox(p - vec2(-61.0,  15.0), vec2(3.0, 8.0));
        float e4 = sdBox(p - vec2(-61.0,  45.0), vec2(3.0, 8.0));

        return min(min(wingBase, min(wingTop, wingBot)), min(min(podTop, podBot), min(min(e1, e2), min(e3, e4))));
      }

      float sdBridgeBase(vec2 p) {
        float d = sdBox(p - vec2(80.0, 0.0), vec2(18.0, 16.0));
        d = max(d, dot(p - vec2(96.0, 16.0), normalize(vec2(1.5, 1.0))));
        d = max(d, dot(p - vec2(96.0, -16.0), normalize(vec2(1.5, -1.0))));
        return d;
      }

      float sdBridgeRoof(vec2 p) {
        float d = sdBox(p - vec2(78.0, 0.0), vec2(15.0, 10.0));
        d = max(d, dot(p - vec2(92.0, 10.0), normalize(vec2(1.5, 1.0))));
        d = max(d, dot(p - vec2(92.0, -10.0), normalize(vec2(1.5, -1.0))));
        return d;
      }

      void calcGun(vec2 pGun, out float dGBody, out float dGArmor, out float dGBarrels, out float dGRings, out float dGBlueCores, out float dGBulb, out float dGunOverallUnscaled) {
        float body = sdBox(pGun - vec2(15.0, 0.0), vec2(20.0, 16.0));
        float cutFront = sdBox(pGun - vec2(-6.0, 0.0), vec2(6.0, 7.0));
        dGBody = max(body, -cutFront);
        
        float armorTop = sdBox(pGun - vec2(12.0, 15.0), vec2(14.0, 4.0));
        float armorBot = sdBox(pGun - vec2(12.0, -15.0), vec2(14.0, 4.0));
        float armorBack = sdBox(pGun - vec2(34.0, 0.0), vec2(4.0, 12.0));
        dGArmor = min(armorTop, min(armorBot, armorBack));
        
        float base1 = sdBox(pGun - vec2(-6.0, 11.0), vec2(6.0, 5.0));
        float base2 = sdBox(pGun - vec2(-6.0, -11.0), vec2(6.0, 5.0));
        float tip1 = sdBox(pGun - vec2(-22.0, 11.0), vec2(12.0, 3.0));
        float tip2 = sdBox(pGun - vec2(-22.0, -11.0), vec2(12.0, 3.0));
        float ring1 = sdBox(pGun - vec2(-34.0, 11.0), vec2(2.0, 4.5));
        float ring2 = sdBox(pGun - vec2(-34.0, -11.0), vec2(2.0, 4.5));
        
        dGRings = min(ring1, ring2);
        dGBarrels = min(min(base1, tip1), ring1);
        dGBarrels = min(dGBarrels, min(min(base2, tip2), ring2));
        
        float core1 = sdBox(pGun - vec2(-20.0, 11.0), vec2(18.0, 0.8));
        float core2 = sdBox(pGun - vec2(-20.0, -11.0), vec2(18.0, 0.8));
        dGBlueCores = min(core1, core2);
        
        dGBulb = length(pGun - vec2(15.0, 0.0)) - 4.5;
        
        dGunOverallUnscaled = min(min(min(dGBody, dGArmor), dGBarrels), dGBulb);
      }

      void main() {
        const float uZoom = 450.0; 
        vec2 p = (vUv - 0.5) * uZoom;
        p.x = -p.x; 
      
        float aa = 0.8;

        float dTube = sdTubeCone(p);
        float dFlat = sdFlatParts(p);
        float dBridgeBase = sdBridgeBase(p);
        float dRoof = sdBridgeRoof(p);
        float dCruiser = min(min(dTube, dFlat), dBridgeBase);

        float gunScale = 0.5; 
        vec2 pGun = vec2(p.x, abs(p.y)) - vec2(-13.0, 37.5);
        pGun.x = -pGun.x;
        pGun /= gunScale;

        float dGBody, dGArmor, dGBarrels, dGRings, dGBlueCores, dGBulb, dGunOverallUnscaled;
        calcGun(pGun, dGBody, dGArmor, dGBarrels, dGRings, dGBlueCores, dGBulb, dGunOverallUnscaled);

        float dGunOverall = dGunOverallUnscaled * gunScale;
        float dOverall = min(dCruiser, dGunOverall);

        vec3 col = vec3(0.0);
        float alpha = 0.0;

        if (dOverall < aa) {
          vec3 finalColor;

          float nz_ = noise(p * 0.2);
          vec3 baseColor = vec3(0.20, 0.30, 0.46);
          if (nz_ > 0.55) baseColor = vec3(0.27, 0.37, 0.53);
          if (p.x < -40.0) baseColor = vec3(0.12, 0.12, 0.15);

          float r = radiusAtSafe(p.x);
          float ny = clamp(p.y / max(r, 0.001), -1.0, 1.0);
          float nzC = sqrt(max(0.0, 1.0 - ny * ny));
          vec3 Ncyl = vec3(0.0, ny, nzC);
          vec3 LcylTop = normalize(vec3(-0.2, -1.0, 0.15));
          vec3 LcylBot = normalize(vec3(-0.2,  1.0, 0.8));
          float diffCyl = max(clamp(dot(Ncyl, LcylTop), 0.0, 1.0), clamp(dot(Ncyl, LcylBot), 0.0, 1.0));
          vec3 cylColor = mix(baseColor * 0.5, baseColor * 1.5, diffCyl) + pow(diffCyl, 10.0) * 0.6;

          if (dBridgeBase < 0.0) {
              if (dRoof < 0.0) {
                  finalColor = baseColor * 1.15; 
              } else {
                  finalColor = baseColor * 0.7; 
                  float w1 = sdBox(p - vec2(96.0, 0.0), vec2(1.5, 4.0));
                  vec2 pw2 = mat2(0.707, -0.707, 0.707, 0.707) * (p - vec2(94.5, 10.5));
                  float w2 = sdBox(pw2, vec2(1.5, 3.5));
                  vec2 pw3 = mat2(0.707, 0.707, -0.707, 0.707) * (p - vec2(94.5, -10.5));
                  float w3 = sdBox(pw3, vec2(1.5, 3.5));
                  float w4 = sdBox(p - vec2(80.0, 13.5), vec2(7.0, 1.5));
                  float w5 = sdBox(p - vec2(80.0, -13.5), vec2(7.0, 1.5));
                  float dWin = min(min(min(w1, w2), min(w3, w4)), w5);
                  if (dWin < 0.0) { finalColor = vec3(0.05); }
              }
          } else if (dTube < dFlat) {
              finalColor = cylColor; 
          } else {
              finalColor = baseColor * 0.85; 
          }

          float lines = smoothstep(0.97, 1.0, fract(p.x * 0.55)) + smoothstep(0.97, 1.0, fract(p.y * 0.6));
          finalColor -= vec3(lines * 0.15);
        
          float rim = smoothstep(2.5, 0.0, abs(dCruiser));
          finalColor += rim * 0.15;

          vec2 pHatch = p - vec2(15.0, 0.0);
          float rHatch = length(pHatch);
          float dHatchOuter = rHatch - 10.0;
          
          if (dHatchOuter < aa && dBridgeBase > 0.0) {
              float angleBorder = atan(pHatch.y, pHatch.x);
              float ringIndex = floor((rHatch - 8.0) * 1.0); 
              float angleOffset = ringIndex * (3.14159 / 12.0); 
              float aFract = fract((angleBorder + angleOffset) * 12.0 / 6.2831853);
              float rFract = fract((rHatch - 8.0) * 1.0); 
              
              float mortarA = smoothstep(0.0, 0.05, aFract) * smoothstep(1.0, 0.95, aFract);
              float mortarR = smoothstep(0.0, 0.1, rFract) * smoothstep(1.0, 0.9, rFract);
              float mortar = mortarA * mortarR;
              
              vec3 brickBase = vec3(0.6, 0.12, 0.08); 
              vec3 mortarCol = vec3(0.15, 0.05, 0.05);
              vec3 borderCol = mix(mortarCol, brickBase, mortar);
              borderCol += (mortar) * 0.1;
              borderCol -= smoothstep(8.5, 8.0, rHatch) * 0.3; 
              borderCol -= smoothstep(9.5, 10.0, rHatch) * 0.3; 

              float apertureD = -100.0;
              float openAmt = uHatchOpen; 
              float offset = mix(-1.0, 8.5, openAmt); 
              float rot = mix(-2.0, 0.0, openAmt); 
              float tilt = 0.5; 
              
              for(int i=0; i<6; i++) {
                  float theta = float(i) * 6.2831853 / 6.0 + rot;
                  vec2 n = vec2(cos(theta + tilt), sin(theta + tilt));
                  float leafD = dot(pHatch, n) - offset;
                  apertureD = max(apertureD, leafD);
              }
              
              float angleVortex = atan(pHatch.y, pHatch.x);
              float spiral = sin(rHatch * 1.5 - uTime * 8.0 + angleVortex * 4.0);
              float vortexGlow = smoothstep(-0.5, 1.0, spiral);
              vec3 vortexCol = mix(vec3(0.02, 0.0, 0.05), vec3(0.7, 0.1, 0.9), vortexGlow * (rHatch/8.0));
              vortexCol += vec3(0.9, 0.3, 1.0) * exp(-rHatch * 0.5) * (0.8 + 0.2 * sin(uTime * 10.0));
              
              vec3 leafCol = vec3(0.15, 0.16, 0.18); 
              leafCol += smoothstep(0.0, 1.0, apertureD) * 0.15; 
              leafCol -= smoothstep(0.2, 0.0, apertureD) * 0.4; 
              
              float hatchBlend = smoothstep(0.2, -0.2, apertureD);
              vec3 innerCol = mix(leafCol, vortexCol, hatchBlend);

              vec3 hatchTotalCol = mix(innerCol, borderCol, smoothstep(8.0 - aa, 8.0 + aa, rHatch));
              finalColor = mix(finalColor, hatchTotalCol, smoothstep(aa, -aa, dHatchOuter));
          }

          if (dGunOverall < aa) {
            vec3 gunColor;
            if (dGBulb < min(dGArmor, min(dGBody, dGBarrels))) {
              gunColor = vec3(0.6, 0.1, 0.1); 
            } else if (dGArmor < min(dGBody, dGBarrels)) {
              gunColor = vec3(0.4, 0.45, 0.5); 
              if (abs(dGArmor) < 1.0) gunColor *= 1.3; 
            } else if (dGBarrels < dGBody) {
              gunColor = vec3(0.55, 0.60, 0.65); 
              if (dGRings < 0.0) gunColor = vec3(0.4, 0.45, 0.5); 
            } else {
              gunColor = vec3(0.25, 0.3, 0.35); 
            }
            
            gunColor -= smoothstep(3.0 * gunScale, 0.0, abs(dGunOverall)) * 0.15;
            float gunMask = smoothstep(aa, -aa, dGunOverall);
            finalColor = mix(finalColor, gunColor, gunMask);
          }

          col = finalColor;
          alpha = smoothstep(aa, -aa, dOverall);
        }

        float pulse = 0.7 + 0.3 * sin(uTime * 15.0);
        float blueGlow = exp(-max(dGBlueCores * gunScale, 0.0) * 1.2 / gunScale) * pulse;
        
        if (blueGlow > 0.05) {
          vec3 plasmaColor = vec3(0.1, 0.85, 1.0);
          col = mix(col, plasmaColor, blueGlow);
          alpha = max(alpha, blueGlow * 0.95); 
        }

        float redGlow = exp(-max(dGBulb * gunScale, 0.0) * 0.8 / gunScale); 
        if (redGlow > 0.05) {
          vec3 bulbColor = vec3(1.0, 0.2, 0.1);
          col = mix(col, bulbColor, redGlow * 0.7);
          alpha = max(alpha, redGlow * 0.85); 
        }

        gl_FragColor = vec4(col, alpha);
      }`;
    Key.cruiserShader = pg.createShader(CRUISER_SHARED_VERT_SRC, fragCruiser);

    Key.shadersLoaded = true;
  }

  // pg = warstwa p5.Graphics w trybie WEBGL (gpuLayer z game.js)
  drawEngineThrust(pg) {
    Key.initShaders(pg);

    let xOffset = 81;
    let yOffsets = [-60, -20, 20, 60];

    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.blendMode(ADD);

    for (let i = 0; i < yOffsets.length; i++) {
      pg.push();
      pg.translate(xOffset + 28, yOffsets[i], 0);
      pg.shader(Key.engineShader);
      Key.engineShader.setUniform('uTime', millis() / 1000.0);
      pg.plane(80, 80);
      pg.resetShader();
      pg.pop();
    }

    pg.blendMode(BLEND);
    pg.pop();
  }

  // pg = warstwa p5.Graphics w trybie WEBGL (gpuLayer z game.js).
  // Shader astronauty (Humanoid.astroShader, z bonuses.js) jest WSPÓŁDZIELONY -
  // ci sami astronauci raz latają swobodnie (Humanoid), a raz są wciągani
  // do krążownika (tutaj) - to dokładnie ten sam shader/program GPU.
  show(pg) {
    Key.initShaders(pg);
    if (typeof Humanoid !== 'undefined' && Humanoid.initShaders) {
      Humanoid.initShaders(pg); // upewniamy się, że Humanoid.astroShader istnieje
    }

    if (typeof this.hatchAnim === 'undefined') this.hatchAnim = 0.0;
    let hatchTarget = (this.astronautsInTransit.length > 0) ? 1.0 : 0.0;
    this.hatchAnim += (hatchTarget - this.hatchAnim) * 0.1;

    // 1. Gazy spalinowe (pod spodem statku)
    this.drawEngineThrust(pg);

    // 2. Kadłub krążownika
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.shader(Key.cruiserShader);
    Key.cruiserShader.setUniform('uTime', millis() / 1000.0);
    Key.cruiserShader.setUniform('uHatchOpen', this.hatchAnim);
    pg.plane(600, 600);
    pg.resetShader();
    pg.pop();

    // 3. Obsługa wciąganych astronautów (współdzielony shader z Humanoid)
    if (typeof Humanoid !== 'undefined' && Humanoid.astroShader) {
      this.astronautsInTransit.forEach(astronaut => {
        pg.push();
        pg.translate(astronaut.x, astronaut.y, 0);
        pg.rotate(astronaut.angle);
        if (astronaut.scale !== undefined) {
          pg.scale(astronaut.scale);
        }
        pg.noStroke();
        pg.shader(Humanoid.astroShader);
        Humanoid.astroShader.setUniform('uTime', millis() / 1000.0);
        Humanoid.astroShader.setUniform('uFlash', 0.0);
        Humanoid.astroShader.setUniform('uAbducted', 0.0);
        pg.plane(100, 100);
        pg.resetShader();
        pg.pop();
      });
    }
  }


  collected(player) {
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.radius
    );
  }

  overCruiser(player) {
    const transferMargin = 350;  
    return player.x > this.x - transferMargin &&
           player.x < this.x + this.width + transferMargin &&
           player.y > this.y - transferMargin &&
           player.y < this.y + this.height + transferMargin;
  }
}

if (typeof window !== 'undefined') {
  window.Key = Key;
}

function rectCircleCollision(rx, ry, rw, rh, cx, cy, cr) {
  let testX = cx;
  let testY = cy;

  if (cx < rx) testX = rx;
  else if (cx > rx + rw) testX = rx + rw;
  if (cy < ry) testY = ry;
  else if (cy > ry + rh) testY = ry + rh;

  let distX = cx - testX;
  let distY = cy - testY;
  let distance = sqrt(distX * distX + distY * distY);

  return distance <= cr;
}