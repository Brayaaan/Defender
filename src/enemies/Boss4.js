// ============================================================================
// SHADERY WEBGL DLA BOSSA 4 (FORTECA PLAZMOWA)
// ============================================================================

const BOSS4_VERT_SRC = `precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

const BOSS4_FRAG_SRC = `precision highp float;
varying vec2 vTexCoord;

uniform float uTime;
uniform float uDissolve;      
uniform float uShield;    
uniform float uShieldRatio;   
uniform float uHealthRatio;   
uniform float uHitFlash;  
uniform vec2 uHitPos;     
uniform float uTurretAngle; 
uniform float uSparks;        
uniform float uDeathExpl;     
uniform float uShieldExpl;    

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

float dHull(vec2 p) {
  float front = -p.x + abs(p.y) * 1.1 - 0.35;
  float back = p.x - 0.25;
  float sides = abs(p.y) - 0.18 - p.x * 0.15;
  return max(max(front, back), sides);
}
float dMainWings(vec2 p) {
  vec2 wp = vec2(p.x - 0.08, abs(p.y) - 0.22);
  float wing = max(abs(wp.x - wp.y * 1.3) - 0.15, abs(wp.y) - 0.22);
  return max(wing, -p.x + 0.08); 
}
float dSidePods(vec2 p) {
  return length(vec2((p.x - 0.05) * 1.5, abs(p.y) - 0.4)) - 0.06;
}
float dCore(vec2 p) {
  return abs(p.x + 0.08) * 1.5 + abs(p.y) * 3.0 - 0.15;
}
float dNozzles(vec2 p) {
  float mainEngine = length(vec2((p.x - 0.25) * 2.0, p.y * 1.5)) - 0.08;
  float sideEngines = length(vec2((p.x - 0.22) * 2.0, (abs(p.y) - 0.12) * 1.5)) - 0.06;
  return min(mainEngine, sideEngines);
}
float sdBoss(vec2 p) {
  return min(min(min(min(dHull(p), dMainWings(p)), dSidePods(p)), dCore(p)), dNozzles(p));
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

vec4 renderPlasmaTurret(vec2 relUV, float angle, float time) {
  float c = cos(-angle);
  float s = sin(-angle);
  vec2 localUV = vec2(relUV.x * c - relUV.y * s, relUV.x * s + relUV.y * c);

  vec2 p = vec2(-localUV.x, localUV.y) * 300.0;

  float body = sdBox(p - vec2(15.0, 0.0), vec2(20.0, 16.0));
  float cutFront = sdBox(p - vec2(-6.0, 0.0), vec2(6.0, 7.0));
  body = max(body, -cutFront);
  
  float armorTop = sdBox(p - vec2(12.0, 15.0), vec2(14.0, 4.0));
  float armorBot = sdBox(p - vec2(12.0, -15.0), vec2(14.0, 4.0));
  float armorBack = sdBox(p - vec2(34.0, 0.0), vec2(4.0, 12.0));
  float armor = min(armorTop, min(armorBot, armorBack));
  
  float base1 = sdBox(p - vec2(-6.0, 11.0), vec2(6.0, 5.0));
  float base2 = sdBox(p - vec2(-6.0, -11.0), vec2(6.0, 5.0));
  float tip1 = sdBox(p - vec2(-32.0, 11.0), vec2(22.0, 3.0));
  float tip2 = sdBox(p - vec2(-32.0, -11.0), vec2(22.0, 3.0));
  float ring1 = sdBox(p - vec2(-54.0, 11.0), vec2(2.0, 4.5));
  float ring2 = sdBox(p - vec2(-54.0, -11.0), vec2(2.0, 4.5));
  
  float barrels = min(min(base1, tip1), ring1);
  barrels = min(barrels, min(min(base2, tip2), ring2));
  
  float core1 = sdBox(p - vec2(-30.0, 11.0), vec2(28.0, 0.8));
  float core2 = sdBox(p - vec2(-30.0, -11.0), vec2(28.0, 0.8));
  float blueCores = min(core1, core2);
  
  float bulb = sdCircle(p - vec2(15.0, 0.0), 4.5);
  
  float wave = sin(p.x * 0.4 + time * 10.0) * 2.5;
  float beamDist = abs(p.y + wave);
  float beamRange = step(-54.0, p.x) * smoothstep(3.0, -2.0, p.x) * smoothstep(-58.0, -42.0, p.x);
  
  float dOverall = min(min(min(body, armor), barrels), bulb);

  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float aa = 0.5;

  if (dOverall < aa) {
    alpha = smoothstep(aa, -aa, dOverall);
    
    if (bulb < min(armor, min(body, barrels))) {
      col = vec3(0.6, 0.1, 0.1); 
    } else if (armor < min(body, barrels)) {
      col = vec3(0.4, 0.45, 0.5); 
      if (abs(armor) < 1.0) col *= 1.3; 
    } else if (barrels < body) {
      col = vec3(0.55, 0.60, 0.65); 
      if (min(ring1, ring2) < 0.0) col = vec3(0.4, 0.45, 0.5);
    } else {
      col = vec3(0.25, 0.3, 0.35); 
    }
    
    col -= smoothstep(9.0, 0.0, abs(dOverall)) * 0.15;
  }

  float pulse = 0.7 + 0.3 * sin(time * 15.0);
  float blueGlow = exp(-max(blueCores, 0.0) * 1.2) * pulse;
  
  if (blueGlow > 0.05) {
    vec3 plasmaColor = vec3(0.1, 0.85, 1.0);
    col = mix(col, plasmaColor, blueGlow);
    alpha = max(alpha, blueGlow * 0.95); 
  }

  float centerBeamGlow = exp(-beamDist * 0.8) * beamRange * pulse;
  if (centerBeamGlow > 0.02) {
    vec3 beamColor = mix(vec3(0.1, 0.8, 1.0), vec3(1.0, 1.0, 1.0), smoothstep(0.5, 1.0, centerBeamGlow));
    col = mix(col, beamColor, clamp(centerBeamGlow * 1.5, 0.0, 1.0));
    alpha = max(alpha, centerBeamGlow * 0.9);
  }

  float redGlow = exp(-max(bulb, 0.0) * 0.8);
  if (redGlow > 0.05) {
    vec3 bulbColor = vec3(1.0, 0.2, 0.1);
    col = mix(col, bulbColor, redGlow * 0.7);
    alpha = max(alpha, redGlow * 0.85); 
  }

  return vec4(col, alpha);
}

void main() {
  const float MARGIN = 1.15;
  vec2 uv = (vTexCoord - 0.5) * 2.0 * MARGIN;
  vec4 finalColor = vec4(0.0);
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  if (uDeathExpl > 0.0) {
    float uProgress = 1.0 - uDeathExpl; 
    float currentRadius = uProgress * 2.2; 
    
    float burstNoise = fbm(uv * 10.0 - uProgress * 2.0);
    float sparksNoise = fbm(vec2(angle * 20.0, dist * 10.0 - uProgress * 15.0));
    
    float core = smoothstep(0.6, 0.0, dist) * (1.0 - smoothstep(0.0, 0.4, uProgress));
    float ringThickness = 0.4 * (1.0 - uProgress);
    float shockwave = smoothstep(currentRadius + ringThickness, currentRadius, dist) 
                    * smoothstep(currentRadius - ringThickness - 0.4, currentRadius, dist);
    shockwave *= smoothstep(0.2, 0.8, burstNoise);
    
    float sparksExp = smoothstep(0.6, 0.9, sparksNoise) 
                 * smoothstep(currentRadius + 0.4, currentRadius - 0.4, dist);
    
    float shape = core + shockwave + sparksExp;
    float fadeOut = 1.0 - smoothstep(0.7, 1.0, uProgress);
    float intensity = shape * fadeOut;

    float edgeFade = smoothstep(1.15, 0.85, dist);
    intensity *= edgeFade;
    
    vec3 colDarkRed = vec3(0.6, 0.0, 0.0);
    vec3 colRed = vec3(1.0, 0.2, 0.0);
    vec3 colWhite = vec3(1.0, 0.8, 0.5);
    
    vec3 fireColor = mix(colDarkRed, colRed, smoothstep(0.1, 0.4, intensity));
    fireColor = mix(fireColor, colWhite, smoothstep(0.6, 0.9, intensity));
    
    gl_FragColor = vec4(fireColor * intensity * 2.5, intensity);
    return;
  }

  if (uSparks > 0.0) {
    float t = uTime * 35.0;
    float rays1 = noise(vec2(angle * 7.0, t * 0.15));
    float rays2 = noise(vec2(angle * 13.0, t * 0.25 + 20.0));
    float spark1 = smoothstep(0.65, 0.85, rays1) * smoothstep(0.8, 0.1, dist);
    float spark2 = smoothstep(0.70, 0.90, rays2) * smoothstep(0.6, 0.0, dist);
    float flicker = sin(t * 1.5) * 0.4 + 0.6;
    float totalSparks = (spark1 + spark2 * 1.7) * flicker;
    float edgeFade = smoothstep(0.9, 0.5, dist) * smoothstep(0.0, 0.15, dist);
    totalSparks *= edgeFade;
    
    vec3 colCyan = vec3(0.0, 1.0, 1.0);
    vec3 colMagenta = vec3(1.0, 0.2, 0.8);
    vec3 colWhite = vec3(1.0, 1.0, 1.0);
    
    vec3 sparkColor = mix(colCyan, colMagenta, dist * 0.7);
    sparkColor = mix(sparkColor, colWhite, totalSparks * 0.4);
    
    gl_FragColor = vec4(sparkColor * totalSparks * 3.5, totalSparks);
    return;
  }

  if (uShield > 0.0 && uDissolve < 1.0) {
    float shieldVisibility = 1.0 - uDissolve;
    float shieldEdge = smoothstep(0.60, 0.68, dist) - smoothstep(0.68, 0.75, dist);
    float shieldCore = fbm(uv * 6.0 + uTime * 1.5) * 0.25 * smoothstep(0.75, 0.3, dist);
    
    vec3 shieldBaseCol = mix(vec3(1.0, 0.1, 0.0), vec3(0.05, 0.6, 1.0), uShieldRatio);
    vec3 shieldCol = shieldBaseCol * (shieldEdge * 2.0 + shieldCore);
    
    if (uHitFlash > 0.0) {
      float hitDist = length(uv - uHitPos);
      float flash = smoothstep(0.3, 0.0, hitDist) * uHitFlash;
      shieldCol += vec3(0.6, 0.9, 1.0) * flash * 2.5;
    }
    float shieldAlpha = (shieldEdge + shieldCore + (uHitFlash * 0.6)) * shieldVisibility;
    finalColor += vec4(shieldCol * shieldVisibility, shieldAlpha);
  }

  if (uShieldExpl > 0.0 && uShieldExpl <= 1.0) {
    float startRadius = 0.55;
    float currentRadiusShield = startRadius + (uShieldExpl * 0.4);
    float thickness = 0.12 * (1.0 - uShieldExpl);
    float ring = smoothstep(currentRadiusShield + thickness, currentRadiusShield, dist) 
               * smoothstep(currentRadiusShield - thickness, currentRadiusShield, dist);
    vec2 sparkGrid = vec2(floor(angle * 60.0), floor(dist * 40.0));
    float sparkNoise = hash(sparkGrid);
    float sparks = step(0.75, sparkNoise) * ring;
    float dustNoise = hash(sparkGrid * 1.5 - vec2(uTime * 10.0));
    float dust = step(0.85, dustNoise) * ring * 0.5;
    float intensity = sparks + dust;
    intensity *= smoothstep(1.0, 0.7, uShieldExpl);
    
    vec3 colStart = vec3(1.0, 1.0, 0.8);
    vec3 colMid = vec3(1.0, 0.6, 0.0);
    vec3 colEnd = vec3(0.8, 0.1, 0.0);
    vec3 finalExplColor = mix(colMid, colEnd, uShieldExpl);
    finalExplColor = mix(colStart, finalExplColor, smoothstep(0.0, 0.3, uShieldExpl));
    finalColor += vec4(finalExplColor * intensity * 2.0, intensity);
  }

  float dS = sdBoss(uv);
  float isShip = 1.0 - smoothstep(0.0, 0.02, dS);
  float mWings = 1.0 - smoothstep(0.0, 0.015, dMainWings(uv));
  float mPods  = 1.0 - smoothstep(0.0, 0.015, dSidePods(uv));
  float mNozzle= 1.0 - smoothstep(0.0, 0.015, dNozzles(uv));
  float mHull  = 1.0 - smoothstep(0.0, 0.015, dHull(uv));
  float mCore  = 1.0 - smoothstep(0.0, 0.015, dCore(uv));

  vec3 colWings = vec3(0.45, 0.05, 0.1); 
  vec3 colPods  = vec3(0.2, 0.22, 0.25);  
  vec3 colNozzle= vec3(0.15, 0.15, 0.15); 
  vec3 colHull  = vec3(0.05, 0.1, 0.15);  
  
  float corePulse = 0.7 + 0.3 * sin(uTime * 4.0);
  vec3 colCore  = vec3(0.0, 1.0, 0.8) * corePulse; 

  vec3 shipColor = vec3(0.0);
  shipColor = mix(shipColor, colWings, mWings);
  shipColor = mix(shipColor, colHull,  mHull);
  shipColor = mix(shipColor, colPods,  mPods);
  shipColor = mix(shipColor, colNozzle,mNozzle);
  shipColor = mix(shipColor, colCore,  mCore);

  vec4 turretTop = renderPlasmaTurret(uv - vec2(0.2, -0.3), uTurretAngle, uTime);
  vec4 turretBot = renderPlasmaTurret(uv - vec2(0.2,  0.3), uTurretAngle, uTime);
  vec4 turretColor = vec4(
    mix(turretTop.rgb, turretBot.rgb, step(turretTop.a, turretBot.a)),
    max(turretTop.a, turretBot.a)
  );

  shipColor = mix(shipColor, turretColor.rgb, turretColor.a);
  float isShipOrTurret = max(isShip, turretColor.a);

  float pattern = fbm(uv * 20.0) * 0.3;
  shipColor += vec3(pattern) * isShip;

  float rim = smoothstep(-0.08, 0.0, dS);
  shipColor += vec3(0.4, 0.6, 0.8) * rim * 0.5 * isShip;

  float damage = 1.0 - uHealthRatio;
  if (damage > 0.0 && isShip > 0.0) {
    float flameLen = 0.55 * damage;
    float dCenter = length(uv * vec2(1.2, 1.0)); 
    float nx = dCenter / flameLen;
    if (nx < 1.0 && flameLen > 0.01) {
      float turb = fbm(uv * 12.0 - vec2(0.0, uTime * 25.0));
      float intFire = pow(1.0 - nx, 1.2) * (0.4 + 0.6 * turb) * damage * 2.0;
      vec3 tipCol = vec3(1.0, 0.1, 0.0);
      vec3 midCol = vec3(1.0, 0.6, 0.0);
      vec3 coreCol= vec3(1.0, 1.0, 0.7);
      vec3 fireCol = mix(tipCol, midCol, smoothstep(0.1, 0.5, intFire));
      fireCol = mix(fireCol, coreCol, smoothstep(0.5, 0.9, intFire));
      shipColor += fireCol * intFire * 2.5; 
    }
  }

  if (uDissolve > 0.0) {
    float dissolveNoise = fbm(uv * 6.0 - uTime * 3.0);
    float dissolveFactor = smoothstep(uDissolve - 0.2, uDissolve + 0.1, dissolveNoise);
    vec3 explBright = vec3(0.0, 0.9, 1.0); 
    if (isShipOrTurret > 0.0) {
      vec3 dissolveColor = mix(explBright, shipColor, dissolveFactor);
      float alpha = isShipOrTurret * dissolveFactor;
      finalColor += vec4(dissolveColor * alpha, alpha);
    }
    float particleNoise = fbm(uv * 25.0 + uTime * 5.0);
    float sparksAnim = smoothstep(0.8, 1.0, particleNoise) * smoothstep(1.0, 0.4, uDissolve);
    if (dist < uDissolve * 1.0) { 
       finalColor += vec4(explBright * sparksAnim * 3.0, sparksAnim);
    }
  } else {
    finalColor = mix(finalColor, vec4(shipColor * isShipOrTurret, isShipOrTurret), isShipOrTurret);
    if (uv.x > 0.24) {
       float engineGlow = fbm(uv * 18.0 - vec2(uTime * 18.0, 0.0));
       float thrustMain = smoothstep(0.65, 0.26, uv.x) * smoothstep(0.12, 0.0, abs(uv.y));
       float thrustSides = smoothstep(0.55, 0.23, uv.x) * smoothstep(0.06, 0.0, abs(abs(uv.y) - 0.12));
       float thruster = clamp(thrustMain + thrustSides, 0.0, 1.0);
       float flameAlpha = thruster * engineGlow;
       vec3 flameCol = vec3(0.0, 0.7, 1.0) * flameAlpha * 3.0; 
       float coreMain = smoothstep(0.45, 0.26, uv.x) * smoothstep(0.06, 0.0, abs(uv.y));
       float coreSides = smoothstep(0.40, 0.23, uv.x) * smoothstep(0.03, 0.0, abs(abs(uv.y) - 0.12));
       float coreEngine = clamp(coreMain + coreSides, 0.0, 1.0);
       flameCol += vec3(0.8, 0.9, 1.0) * coreEngine * (0.6 + 0.4 * sin(uTime * 30.0));
       finalColor += vec4(flameCol, flameAlpha * 0.9);
    }
  }

  gl_FragColor = finalColor;
}`;

const BOSS4_AUX_VERT_SRC = `precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

const BOSS4_PLASMA_FRAG_SRC = `precision mediump float;
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
  for(int i = 0; i < 4; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
  return f;
}

void main() {
  vec2 uv = vUv;
  uv.y = (uv.y - 0.5) * 2.0;
  float scrollTime = uTime * 6.0;
  float n1 = fbm(vec2(uv.x * 6.0 - scrollTime, uv.y * 2.0));
  float n2 = fbm(vec2(uv.x * 12.0 - scrollTime * 1.5, uv.y * 4.0 - uTime));
  float distortion = (n1 - 0.5) * 0.4;
  float distY = abs(uv.y + distortion);
  float core = smoothstep(0.22, 0.0, distY);
  float plasma = smoothstep(0.85, 0.0, distY) * n2;
  float pulse = sin(uv.x * 30.0 - scrollTime * 2.0) * 0.5 + 0.5;
  plasma += pulse * 0.3 * smoothstep(0.4, 0.0, distY);
  float edgeFade = smoothstep(1.0, 0.8, abs(uv.y));
  float lengthFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x);
  float intensity = (core + plasma) * edgeFade * lengthFade;
  vec3 colDeepBlue = vec3(0.05, 0.15, 0.9);
  vec3 colLightBlue = vec3(0.3, 0.75, 1.0);
  vec3 colCore = vec3(0.65, 0.85, 1.0);
  vec3 finalColor = mix(colDeepBlue, colLightBlue, plasma);
  finalColor = mix(finalColor, colCore, core * 0.45);
  gl_FragColor = vec4(finalColor * intensity * 2.0, intensity);
}`;

const BOSS4_MINE_FRAG_SRC = `precision highp float;
varying vec2 vUv;
uniform float uSeed;
uniform float uTime;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  float d = length(uv);
  float angle = atan(uv.y, uv.x);

  float sphereRadius = 0.50;
  float bodyMask = smoothstep(sphereRadius + 0.015, sphereRadius - 0.015, d);

  float rimStems = 0.0;
  float rimTips = 0.0;
  const int NUM_RIM_SPIKES = 8;
  for (int i = 0; i < NUM_RIM_SPIKES; i++) {
    float spikeAngle = (float(i) / float(NUM_RIM_SPIKES)) * 6.2831853 + uSeed * 5.0;
    float angDiff = abs(mod(angle - spikeAngle + 3.14159265, 6.2831853) - 3.14159265);
    float stemWidth = smoothstep(0.05, 0.015, angDiff);
    float stemLen = 0.20 + 0.03 * sin(uSeed * 10.0 + float(i));
    float stem = stemWidth * smoothstep(sphereRadius + stemLen, sphereRadius + stemLen - 0.05, d) * step(sphereRadius - 0.02, d);
    rimStems = max(rimStems, stem);
    vec2 tipPos = vec2(cos(spikeAngle), sin(spikeAngle)) * (sphereRadius + stemLen);
    float tipDist = length(uv - tipPos);
    float tip = smoothstep(0.06, 0.035, tipDist);
    rimTips = max(rimTips, tip);
  }

  float faceBases = 0.0;
  float faceTips = 0.0;
  const int NUM_FACE_SPIKES = 5;
  for (int j = 0; j < NUM_FACE_SPIKES; j++) {
    float fa = (float(j) / float(NUM_FACE_SPIKES)) * 6.2831853 + uSeed * 2.0;
    float fr = 0.25 + 0.05 * sin(float(j) * 3.14 + uSeed);
    if (j == 0) fr = 0.0; 
    vec2 facePos = vec2(cos(fa), sin(fa)) * fr;
    float faceDist = length(uv - facePos);
    float base = smoothstep(0.08, 0.055, faceDist);
    faceBases = max(faceBases, base);
    float tip = smoothstep(0.04, 0.02, faceDist);
    faceTips = max(faceTips, tip);
  }

  float totalSilhouette = max(max(bodyMask, rimStems), rimTips);
  if (totalSilhouette < 0.01) discard;

  float sphereD = min(d / sphereRadius, 1.0);
  vec3 normal = normalize(vec3(uv, sqrt(max(0.001, 1.0 - sphereD * sphereD))));
  vec3 lightDir = normalize(vec3(-0.5, -0.6, 0.7));
  float diff = max(dot(normal, lightDir), 0.05);

  vec3 metalDark = vec3(0.08, 0.09, 0.11);
  vec3 metalLight = vec3(0.45, 0.50, 0.55);
  vec3 col = mix(metalDark, metalLight, diff) * bodyMask;

  if (bodyMask < 0.5 && rimStems > 0.0) {
    col = vec3(0.22, 0.25, 0.28) * rimStems;
  }

  float spec = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 16.0);
  col += vec3(0.7, 0.8, 0.9) * spec * bodyMask;

  if (faceBases > 0.0 && bodyMask > 0.0) {
    col = mix(col, vec3(0.12, 0.13, 0.15), faceBases * 0.75);
  }

  float pulse = 0.6 + 0.4 * sin(uTime * 8.0 + uSeed * 10.0);
  vec3 glowColor = vec3(1.0, 0.15, 0.02) * pulse;
  float allTips = max(rimTips, faceTips);
  col = mix(col, glowColor, allTips);
  float glow = (rimTips + faceTips) * 0.4 * pulse;
  col += vec3(0.9, 0.2, 0.0) * glow;

  gl_FragColor = vec4(col, totalSilhouette);
}`;

// ============================================================================
// KLASY POMOCNICZE: POCISK PLAZMOWY I MINA PLAZMOWA
// ============================================================================

class Boss4PlasmaBolt {
  constructor(x, y, angle, speed) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.length = 75;
    this.width = 26;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }

  isOffScreen() {
    return this.x < -150 || this.x > width + 150 || this.y < -150 || this.y > height + 150;
  }

  static initShaders(pg) {
    if (Boss4PlasmaBolt.shadersLoaded) return;
    Boss4PlasmaBolt.shader = pg.createShader(BOSS4_AUX_VERT_SRC, BOSS4_PLASMA_FRAG_SRC);
    Boss4PlasmaBolt.shadersLoaded = true;
  }

  show(pg) {
    Boss4PlasmaBolt.initShaders(pg);
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.rotate(this.angle);
    pg.noStroke();
    pg.blendMode(ADD);
    pg.shader(Boss4PlasmaBolt.shader);
    Boss4PlasmaBolt.shader.setUniform('uTime', millis() / 1000.0);
    pg.plane(this.length, this.width);
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
  }
}
Boss4PlasmaBolt.shadersLoaded = false;
window.Boss4PlasmaBolt = Boss4PlasmaBolt;

class Boss4Mine {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 18;
    this.health = 10;
    this.triggerRadius = 55;
    this.exploding = false;
    this.explosionFrame = 0;
    this.maxExplosionFrames = 45;
    this.rotAngle = random(TWO_PI);
    this.rotSpeed = random(-0.02, 0.02);
    this.seed = random(100);
    this.driftSpeed = random(1.2, 2.0);
  }

  update(playerTarget) {
    if (this.exploding) {
      this.explosionFrame++;
      return;
    }
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.985;
    this.vy *= 0.985;
    this.x -= this.driftSpeed;
    this.rotAngle += this.rotSpeed;

    if (playerTarget) {
      let d = dist(this.x, this.y, playerTarget.x, playerTarget.y);
      if (d < this.triggerRadius) {
        this.explode();
      }
    }
  }

  isOffScreen() {
    return this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100;
  }

  explode() {
    if (this.exploding) return;
    this.exploding = true;
    this.explosionFrame = 0;
  }

  takeDamage(amount) {
    if (this.exploding) return;
    this.health -= amount;
    if (this.health <= 0) this.explode();
  }

  isFinished() {
    return this.exploding && this.explosionFrame >= this.maxExplosionFrames;
  }

  static initShaders(pg) {
    if (Boss4Mine.shadersLoaded) return;
    Boss4Mine.bodyShader = pg.createShader(BOSS4_AUX_VERT_SRC, BOSS4_MINE_FRAG_SRC);
    Boss4Mine.shadersLoaded = true;
  }

  show(pg) {
    Boss4Mine.initShaders(pg);

    if (this.exploding) {
      let progress = constrain(this.explosionFrame / this.maxExplosionFrames, 0, 0.99);
      pg.push();
      pg.translate(this.x, this.y, 0);
      pg.noStroke();
      if (!Boss4_FortecaPlazmowa.shaderLoaded) {
        Boss4_FortecaPlazmowa.shader = pg.createShader(BOSS4_VERT_SRC, BOSS4_FRAG_SRC);
        Boss4_FortecaPlazmowa.shaderLoaded = true;
      }
      pg.shader(Boss4_FortecaPlazmowa.shader);
      Boss4_FortecaPlazmowa.shader.setUniform('uTime', millis() / 1000.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uDeathExpl', 1.0 - progress);
      Boss4_FortecaPlazmowa.shader.setUniform('uDissolve', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uSparks', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uShield', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uShieldExpl', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uHitFlash', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uHitPos', [0.0, 0.0]);
      let s = this.radius * 14.0;
      pg.plane(s, s);
      pg.resetShader();
      pg.pop();
      return;
    }

    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.rotate(this.rotAngle);
    pg.noStroke();
    pg.shader(Boss4Mine.bodyShader);
    Boss4Mine.bodyShader.setUniform('uSeed', this.seed);
    Boss4Mine.bodyShader.setUniform('uTime', millis() / 1000.0);
    pg.plane(this.radius * 2.6, this.radius * 2.6);
    pg.resetShader();
    pg.pop();
  }
}
Boss4Mine.shadersLoaded = false;
window.Boss4Mine = Boss4Mine;

// ============================================================================
// GŁÓWNA KLASA BOSSA 4: FORTECA PLAZMOWA (ZGODNA Z INTERFEJSEM BOSS 3)
// ============================================================================

class Boss4_FortecaPlazmowa {
  constructor() {
    // --- STANDARD WEJŚCIA SILNIKA GRY ---
    this.x = width + 300; 
    this.y = height / 2;
    this.baseX = width - 180;
    this.baseY = height / 2;
    
    this.state = 'entering'; // 'entering', 'battle', 'explosion'
    this.vx = -2.0;
    this.radius = 120;
    
    // --- PARAMETRY ŻYCIA BOSSA 4 ---
    this.coreHp = 2000; 
    this.maxCoreHp = 2000;
    this.shieldHP = 1500;
    this.maxShield = 1500;
    this.points = 15000;
    
    this.isDead = false;
    this.exploded = false;
    this.explosionFrame = 0;
    this.explosionParticles = [];

    // System cząsteczek fizycznych
    this.sparkParticles = [];
    this.debrisParticles = [];
    this.spawnQueue = [];

    // --- BROŃ PIORUNOWA BOSSA 4 (Z zwarciu) ---
    // Piorun uderzy rakietę gracza (nie pociski), gdy ta się do niego zbliży[cite: 11]
    this.lightningRange = 260;

    // --- WEWNĘTRZNA MASZYNA STANÓW MATERIALIZACJI I TELEPORTACJI ---
    this.combatState = 0; // 0: iskrzenie przed wejściem, 1: materializacja, 2: walka, 3: teleportacja
    this.combatTimer = 0;

    // Efekty tarczy
    this.shieldHitFlash = 0;
    this.shieldHitX = 0;
    this.shieldHitY = 0;
    this.shieldExplosionProgress = 0;

    // Uzbrojenie plazmowe
    this.plasmaBolts = [];
    this.plasmaCooldown = 90;

    this.mines = [];
    this.mineCooldown = 300;
    this.mineBurstRemaining = 0;
    this.mineBurstTimer = 0;
    this.mineAlternate = false;
    this.turretAngle = 0;
  }

  pickRandomPosition() {
    let margin = this.radius * 1.8;
    this.x = random(width * 0.5, width - margin);
    this.baseY = random(margin, height - margin);
    this.y = this.baseY;
  }

  // Zwraca punkty celownicze dla systemowej Bomby Plazmowej / Atomówki (Klawisz B)[cite: 12]
  getTargetableParts() {
    if (this.isDead) return [];
    if (this.state === 'explosion') {
      return [{ x: this.x, y: this.y }];
    }
    return [
      { x: this.x, y: this.y },
      { x: this.x + 24, y: this.y - 36 },
      { x: this.x + 24, y: this.y + 36 }
    ];
  }

  // Obsługa obrażeń od systemowej Bomby Plazmowej / Atomówki[cite: 12]
  takeDamage(damage) {
    if (this.isDead || this.state === 'explosion' || this.state === 'entering' || this.combatState !== 2) return false;
    let amt = damage || 25;
    this.hit(amt, this.x, this.y);
    return true;
  }

  hit(damage, hitX, hitY) {
    if (this.state !== 'battle' || this.combatState !== 2) return;

    if (this.shieldHP > 0) {
      this.shieldHP -= damage;
      this.shieldHitFlash = 10;
      this.shieldHitX = hitX || this.x;
      this.shieldHitY = hitY || this.y;
      this.createSparks(hitX || this.x, hitY || this.y);
      
      if (this.shieldHP <= 0) {
        this.shieldHP = 0;
        this.shieldExplosionProgress = 0.01;
        this.createDebris(this.x, this.y, color(0, 200, 255));
        if (typeof playSoundEksplozja === 'function') playSoundEksplozja();
      }
    } else {
      this.coreHp -= damage;
      this.createSparks(hitX || this.x, hitY || this.y);
      if (this.coreHp <= 0) {
        this.coreHp = 0;
        this.startExplosion();
      }
    }
  }

  hits(playerObj) {
    if (this.isDead || this.state === 'explosion' || this.state === 'entering') return false;
    let currentRadius = this.shieldHP > 0 ? this.radius * 1.15 : this.radius * 0.85;
    return dist(this.x, this.y, playerObj.x, playerObj.y) < (currentRadius + playerObj.width/2);
  }

  handleCollision(playerObj) {
    if (this.isDead || this.state === 'explosion' || this.state === 'entering') return;
    if (typeof playerObj.takeDamage === 'function') {
      playerObj.takeDamage(20); 
      if (playerObj.shieldPower <= 0 && typeof playerObj.startExplosion === 'function') {
        playerObj.startExplosion();
      }
    }
  }

  firePlasma(playerTarget) {
    let podXOffset = this.radius * 0.05; 
    let podYOffset = this.radius * 0.4; 
    for (let side of [-1, 1]) {
      let px = this.x + podXOffset;
      let py = this.y + side * podYOffset;
      let angle = atan2(playerTarget.y - py, playerTarget.x - px);
      this.plasmaBolts.push(new Boss4PlasmaBolt(px, py, angle, 9));
    }
  }

  fireMine() {
    let podXOffset = this.radius * 0.0875;
    let podYOffset = this.radius * 0.7;
    this.mineAlternate = !this.mineAlternate;
    let py = this.mineAlternate ? this.y - podYOffset : this.y + podYOffset;
    let px = this.x + podXOffset;
    let ejectAngle = (this.mineAlternate ? -HALF_PI : HALF_PI) + random(-0.3, 0.3);
    let speed = random(1.5, 2.5);
    let vx = cos(ejectAngle) * speed;
    let vy = sin(ejectAngle) * speed;
    this.mines.push(new Boss4Mine(px, py, vx, vy));
  }

  update(player) {
    if (this.state === 'explosion') {
      this.updateExplosion();
      if (this.explosionFrame <= 0) {
        this.isDead = true; 
      }
      return;
    }

    // Aktualizacja cząsteczek fizycznych[cite: 12]
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) { 
      let p = this.sparkParticles[i]; p.x += p.vx; p.y += p.vy; p.life -= 15; 
      if (p.life <= 0) this.sparkParticles.splice(i, 1); 
    }
    for (let i = this.debrisParticles.length - 1; i >= 0; i--) { 
      let p = this.debrisParticles[i]; p.x += p.vx; p.y += p.vy; p.life -= 5; 
      if (p.life <= 0) this.debrisParticles.splice(i, 1); 
    }

    // --- FAZA WEJŚCIOWA ---
    if (this.state === 'entering') {
      this.x += this.vx;
      if (this.x <= this.baseX) {
        this.x = this.baseX;
        this.state = 'battle';
        this.combatState = 0;
        this.combatTimer = 0;
      }
      return;
    }

    this.combatTimer++;
    if (player) {
      this.turretAngle = atan2(player.y - this.y, player.x - this.x);
    }

    // --- BROŃ PIORUNOWA W ZWARCIU[cite: 11, 12] ---
    // Piorun uderzy rakietę gracza, gdy ta się do niego zbliży[cite: 11]
    if (this.combatState === 2 && player && dist(this.x, this.y, player.x, player.y) < this.lightningRange) {
      if (frameCount % 12 === 0 && !player.isImmortal) {
        if (typeof player.takeDamage === 'function') {
          player.takeDamage(6);
          if (typeof playSoundKolizjaRakiety === 'function') playSoundKolizjaRakiety();
        }
      }
    }

    // --- SAMOOBSŁUGA KOLIZJI Z POCISKAMI GRACZA[cite: 11, 12] ---
    if (player && player.bullets && Array.isArray(player.bullets)) {
      for (let j = player.bullets.length - 1; j >= 0; j--) {
        let b = player.bullets[j];
        let bRadius = b.width ? b.width / 2 : 10;
        let hitDetected = false;

        // 1. Sprawdzenie trafień w miny plazmowe
        for (let m = this.mines.length - 1; m >= 0; m--) {
          let mine = this.mines[m];
          if (mine.exploding) continue;
          if (dist(b.x, b.y, mine.x, mine.y) < (mine.radius + bRadius)) {
            mine.takeDamage(b.power || 10);
            this.createSparks(b.x, b.y);
            hitDetected = true;
            break;
          }
        }
        if (hitDetected) {
          player.bullets.splice(j, 1);
          continue;
        }

        // 2. Sprawdzenie trafień w tarczę lub kadłub bossa
        if (this.combatState === 2) {

          // Gdy tarcza jest aktywna -> duży promień tarczy
          // Gdy tarcza zniszczona -> zmniejszony promień (tylko obszar rysunku bossa)
          //                     oryginalnie: this.radius * 1.15 : this.radius * 0.75;
          let hitRadius = this.shieldHP > 0 ? this.radius * 1.15 : this.radius * 0.75;
          if (dist(b.x, b.y, this.x, this.y) < (hitRadius + bRadius)) {
            this.hit(b.power || 15, b.x, b.y);
            player.bullets.splice(j, 1);
          }
        }
      }
    }

    // Aktualizacja pocisków plazmowych bossa i ich trafień w gracza
    for (let i = this.plasmaBolts.length - 1; i >= 0; i--) {
      let bolt = this.plasmaBolts[i];
      bolt.update();
      if (player && dist(bolt.x, bolt.y, player.x, player.y) < (bolt.width/2 + (player.width ? player.width/2 : 15))) {
        if (typeof player.takeDamage === 'function') player.takeDamage(15);
        this.createSparks(bolt.x, bolt.y);
        this.plasmaBolts.splice(i, 1);
        continue;
      }
      if (bolt.isOffScreen()) this.plasmaBolts.splice(i, 1);
    }

    // Aktualizacja min plazmowych i ich eksplozji
    for (let i = this.mines.length - 1; i >= 0; i--) {
      let mine = this.mines[i];
      let wasExploding = mine.exploding;
      mine.update(player);
      if (!wasExploding && mine.exploding && player) {
        if (dist(mine.x, mine.y, player.x, player.y) < (mine.triggerRadius * 1.5)) {
          if (typeof player.takeDamage === 'function') player.takeDamage(20);
          this.createSparks(player.x, player.y);
        }
      }
      if (mine.isFinished() || mine.isOffScreen()) this.mines.splice(i, 1);
    }
    
    this.y = this.baseY + sin(frameCount * 0.03) * 35;

    if (this.shieldExplosionProgress > 0) {
      this.shieldExplosionProgress += 0.015;
      if (this.shieldExplosionProgress > 1.0) {
        this.shieldExplosionProgress = 0;
      }
    }

    // --- MASZYNA STANÓW WALKI (MATERIALIZACJA / TELEPORTACJA) ---
    if (this.combatState === 0) {
      if (this.combatTimer >= 120) {
        this.combatState = 1;
        this.combatTimer = 0;
      }
    } 
    else if (this.combatState === 1) {
      if (this.combatTimer >= 180) {
        this.combatState = 2;
        this.combatTimer = 0;
      }
    } 
    else if (this.combatState === 2) {
      let targetX = width - 180;
      this.x += (targetX - this.x) * 0.015;

      this.plasmaCooldown--;
      if (this.plasmaCooldown <= 0 && player) {
        this.firePlasma(player);
        this.plasmaCooldown = 90;
      }

      this.mineCooldown--;
      if (this.mineCooldown <= 0 && this.mineBurstRemaining === 0) {
        this.mineBurstRemaining = 5;
        this.mineBurstTimer = 0;
        this.mineCooldown = 500;
      }
      if (this.mineBurstRemaining > 0) {
        this.mineBurstTimer--;
        if (this.mineBurstTimer <= 0) {
          this.fireMine();
          this.mineBurstRemaining--;
          this.mineBurstTimer = 12;
        }
      }

      if (this.combatTimer >= 600) {
        this.combatState = 3;
        this.combatTimer = 0;
      }
    } 
    else if (this.combatState === 3) {
      if (this.combatTimer >= 180) {
        this.combatState = 0;
        this.combatTimer = 0;
        this.shieldExplosionProgress = 0;
        this.pickRandomPosition(); 
      }
    }
  }

  show(localPlayer) {
    let playerObj = localPlayer || (typeof player !== 'undefined' ? player : null);

    if (this.state === 'explosion') {
      push(); 
      translate(this.x, this.y); 
      this.drawExplosion(); 
      pop();
      return;
    }

    // 1. ZARZĄDZANIE BUFOREM WEBGL DLA KANWASU 2D
    let targetPG = null;
    if (localPlayer && typeof localPlayer.createShader === 'function') {
      targetPG = localPlayer;
      playerObj = (typeof player !== 'undefined') ? player : null;
    } else {
      if (!this.gpuLayer || this.gpuLayer.width !== width || this.gpuLayer.height !== height) {
        this.gpuLayer = createGraphics(width, height, WEBGL);
      }
      targetPG = this.gpuLayer;
      targetPG.clear();
      targetPG.push();
      targetPG.translate(-width/2, -height/2);
    }

    if (!Boss4_FortecaPlazmowa.shaderLoaded) {
      Boss4_FortecaPlazmowa.shader = targetPG.createShader(BOSS4_VERT_SRC, BOSS4_FRAG_SRC);
      Boss4_FortecaPlazmowa.shaderLoaded = true;
    }

    let uDissolve = 0.0;
    let uSparks = 0.0;
    let uDeathExpl = 0.0;

    if (this.state === 'entering' || this.combatState === 0) {
      uSparks = 1.0;
      uDissolve = 1.0; 
    } else if (this.combatState === 1) {
      uDissolve = 1.0 - (this.combatTimer / 180.0);
    } else if (this.combatState === 2) {
      uDissolve = 0.0;
    } else if (this.combatState === 3) {
      uDissolve = this.combatTimer / 180.0;
    }

    let hitU = 0.0;
    let hitV = 0.0;
    const SHIELD_MARGIN = 1.15;
    if (this.shieldHitFlash > 0) {
      hitU = (this.shieldHitX - this.x) / (this.radius * 1.5) * SHIELD_MARGIN;
      hitV = (this.shieldHitY - this.y) / (this.radius * 1.5) * SHIELD_MARGIN;
      this.shieldHitFlash--;
    }

    targetPG.push();
    targetPG.translate(this.x, this.y, 0);
    targetPG.noStroke();
    
    targetPG.shader(Boss4_FortecaPlazmowa.shader);
    Boss4_FortecaPlazmowa.shader.setUniform('uTime', millis() / 1000.0);
    Boss4_FortecaPlazmowa.shader.setUniform('uDissolve', uDissolve);
    Boss4_FortecaPlazmowa.shader.setUniform('uSparks', uSparks);
    Boss4_FortecaPlazmowa.shader.setUniform('uDeathExpl', uDeathExpl);
    Boss4_FortecaPlazmowa.shader.setUniform('uShieldExpl', this.shieldExplosionProgress);
    Boss4_FortecaPlazmowa.shader.setUniform('uShield', this.shieldHP > 0 ? 1.0 : 0.0);
    Boss4_FortecaPlazmowa.shader.setUniform('uShieldRatio', this.shieldHP / this.maxShield);
    Boss4_FortecaPlazmowa.shader.setUniform('uHealthRatio', this.coreHp / this.maxCoreHp);
    Boss4_FortecaPlazmowa.shader.setUniform('uHitFlash', this.shieldHitFlash / 10.0);
    Boss4_FortecaPlazmowa.shader.setUniform('uHitPos', [hitU, hitV]);
    Boss4_FortecaPlazmowa.shader.setUniform('uTurretAngle', this.turretAngle);

    targetPG.plane(this.radius * 3.5, this.radius * 3.5);
    targetPG.resetShader();
    targetPG.pop();

    for (let bolt of this.plasmaBolts) bolt.show(targetPG);
    for (let mine of this.mines) mine.show(targetPG);

    if (targetPG === this.gpuLayer) {
      targetPG.pop();
      image(this.gpuLayer, 0, 0);
    }

    // 2. RYSOWANIE PIORUNÓW W ZWARCIU BEZPOŚREDNIO NA KANWASIE 2D[cite: 11, 12]
    if (this.combatState === 2 && playerObj && dist(this.x, this.y, playerObj.x, playerObj.y) < this.lightningRange && !this.isDead && this.state !== 'explosion') {
      push();
      let turretOffsets = [-40, 40];
      for (let offY of turretOffsets) {
        let startX = this.x + 20;
        let startY = this.y + offY;
        
        stroke(0, 220, 255, 80); 
        strokeWeight(7); 
        line(startX, startY, playerObj.x, playerObj.y);
        
        stroke(180, 245, 255); 
        strokeWeight(2.5); 
        noFill();
        beginShape();
        vertex(startX, startY);
        let steps = 5;
        for (let s = 1; s < steps; s++) {
          let pr = s / steps;
          let zx = lerp(startX, playerObj.x, pr) + random(-12, 12);
          let zy = lerp(startY, playerObj.y, pr) + random(-12, 12);
          vertex(zx, zy);
        }
        vertex(playerObj.x, playerObj.y);
        endShape();
      }
      pop();
    }

    // 3. RYSOWANIE CZĄSTECZEK I INTERFEJSU
    push();
    for (let p of this.debrisParticles) { 
      fill(red(p.color), green(p.color), blue(p.color), p.life); noStroke(); 
      rect(p.x, p.y, p.size, p.size); 
    }
    for (let p of this.sparkParticles) { 
      fill(0, 220, 255, p.life); noStroke(); ellipse(p.x, p.y, 4, 4); 
    }
    pop();

    this.drawEngineUI();
  }

  createSparks(x, y) {
    for (let i = 0; i < 6; i++) {
      this.sparkParticles.push({ x, y, vx: random(-3,3), vy: random(-3,3), life: 255 });
    }
  }

  createDebris(x, y, col) {
    for (let i = 0; i < 12; i++) {
      this.debrisParticles.push({ x, y, vx: random(-4,4), vy: random(-4,4), size: random(3,7), color: col, life: 255 });
    }
  }

  drawEngineUI() {
    let barW = 220; let barH = 6;
    let centerX = width * 0.85; let y = 60;

    push();
    noStroke(); fill(20, 20, 30, 200); rect(centerX - barW/2, y, barW, barH);
    let currentShieldW = map(this.shieldHP, 0, this.maxShield, 0, barW);
    fill(0, 200, 255);
    rect(centerX - barW/2, y, currentShieldW, barH);
    stroke(0, 255, 255, 150); strokeWeight(1); noFill(); rect(centerX - barW/2 - 1, y - 1, barW + 2, barH + 2);

    let yCore = y + 12;
    noStroke(); fill(20, 20, 30, 200); rect(centerX - barW/2, yCore, barW, barH);
    let currentCoreW = map(this.coreHp, 0, this.maxCoreHp, 0, barW);
    fill(this.coreHp > 500 ? color(0, 255, 150) : color(255, 50, 50));
    rect(centerX - barW/2, yCore, currentCoreW, barH);
    stroke(255, 80); strokeWeight(1); noFill(); rect(centerX - barW/2 - 1, yCore - 1, barW + 2, barH + 2);

    fill(255); noStroke(); textSize(13); textAlign(CENTER, BOTTOM);
    text("BOSS 4: FORTECA PLAZMOWA", centerX, y - 6);
    pop();
  }

  // PROCEDURY EKSPLOZJI[cite: 12]
  startExplosion() {
    this.state = 'explosion';
    this.explosionFrame = 170;
    this.createExplosion();
    this.exploded = true;
    if (typeof playEnemyExplosion === 'function') playEnemyExplosion();
  }

  createExplosion() {
    for (let i = 0; i < 350; i++) {
      let angle = random(TWO_PI); let speed = random(1, 14);
      this.explosionParticles.push({
        x: 0, y: 0, vx: cos(angle)*speed, vy: sin(angle)*speed, size: random(2, 5), life: 255,
        col: random() > 0.4 ? color(0, 200, 255) : color(255, 100, 0)
      });
    }
  }

  updateExplosion() {
    this.explosionFrame--;
    for (let p of this.explosionParticles) { p.x += p.vx; p.y += p.vy; p.life -= 1.5; }
  }

  drawExplosion() {
    // 1. Ognista fala uderzeniowa z shadera
    if (this.gpuLayer) {
      let progress = constrain((170 - this.explosionFrame) / 170.0, 0.0, 0.99);
      this.gpuLayer.clear();
      this.gpuLayer.push();
      this.gpuLayer.translate(0, 0, 0);
      this.gpuLayer.noStroke();
      this.gpuLayer.shader(Boss4_FortecaPlazmowa.shader);
      Boss4_FortecaPlazmowa.shader.setUniform('uTime', millis() / 1000.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uDeathExpl', progress);
      Boss4_FortecaPlazmowa.shader.setUniform('uDissolve', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uSparks', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uShield', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uShieldExpl', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uHitFlash', 0.0);
      Boss4_FortecaPlazmowa.shader.setUniform('uHitPos', [0.0, 0.0]);
      this.gpuLayer.plane(this.radius * 4.5, this.radius * 4.5);
      this.gpuLayer.resetShader();
      this.gpuLayer.pop();
      
      push();
      translate(-this.x, -this.y);
      image(this.gpuLayer, 0, 0);
      pop();
    }

    // 2. Cząsteczki odłamków na kanwasie 2D
    for (let p of this.explosionParticles) {
      if (p.life <= 0) continue;
      stroke(red(p.col), green(p.col), blue(p.col), p.life); strokeWeight(p.size); point(p.x, p.y);
    }
  }
}

Boss4_FortecaPlazmowa.shaderLoaded = false;
window.Boss4_FortecaPlazmowa = Boss4_FortecaPlazmowa;
window.Boss4 = Boss4_FortecaPlazmowa;