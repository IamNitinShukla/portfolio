const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const imgDir = path.join(publicDir, 'images');
const projDir = path.join(imgDir, 'projects');

// 1. Ultra-Refined Portrait SVG with Studio Lighting & Mechanical Spider on Shoulder
const profileAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 720" width="600" height="720">
  <defs>
    <radialGradient id="skyGrad" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1f2533" />
      <stop offset="50%" stop-color="#12151e" />
      <stop offset="100%" stop-color="#08090d" />
    </radialGradient>
    <radialGradient id="glowWarm" cx="65%" cy="35%" r="40%">
      <stop offset="0%" stop-color="#E8FF70" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#E8FF70" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2c3140" />
      <stop offset="100%" stop-color="#141720" />
    </linearGradient>
    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d9a786" />
      <stop offset="100%" stop-color="#96654a" />
    </linearGradient>
    <filter id="shadowGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Background Environment -->
  <rect width="600" height="720" fill="url(#skyGrad)" />
  <circle cx="400" cy="260" r="260" fill="url(#glowWarm)" />

  <!-- Subtle Horizon / Mountain silhouette like reference image -->
  <path d="M0 500 Q150 440 300 470 T600 450 L600 720 L0 720 Z" fill="#0d1017" opacity="0.6" />
  <path d="M0 530 Q220 490 440 520 T600 500 L600 720 L0 720 Z" fill="#0a0c12" />

  <!-- Developer Silhouette / Character -->
  <g transform="translate(300, 420)">
    <!-- Shoulders & Torso -->
    <path d="M-210 300 C-190 190, -130 140, -80 120 C-30 150, 30 150, 80 120 C130 140, 190 190, 210 300 Z" fill="url(#bodyGrad)" stroke="#3a4055" stroke-width="2" />
    
    <!-- Neck -->
    <path d="M-45 130 L-45 40 Q0 60 45 40 L45 130 Z" fill="url(#skinGrad)" opacity="0.9" />

    <!-- Head / Face -->
    <ellipse cx="0" cy="-35" rx="90" ry="118" fill="url(#skinGrad)" />
    
    <!-- Hair Volume -->
    <path d="M-98 -45 C-105 -145, -45 -180, 0 -180 C50 -180, 105 -145, 98 -45 C82 -110, 30 -130, 0 -125 C-30 -130, -80 -110, -98 -45 Z" fill="#171922" />
    <path d="M-95 -40 C-90 -10 0 10 95 -40 C75 -35 0 -35 -95 -40 Z" fill="#12131a" opacity="0.3" />

    <!-- Beard / Facial Hair like reference -->
    <path d="M-60 0 C-40 75 40 75 60 0 C50 60 -50 60 -60 0 Z" fill="#1c1f2b" opacity="0.85" />

    <!-- Stylized Modern Eyewear / Frames -->
    <rect x="-68" y="-55" width="58" height="28" rx="6" fill="#0A0A0A" stroke="#E8FF70" stroke-width="2.5" />
    <rect x="10" y="-55" width="58" height="28" rx="6" fill="#0A0A0A" stroke="#E8FF70" stroke-width="2.5" />
    <line x1="-10" y1="-41" x2="10" y2="-41" stroke="#E8FF70" stroke-width="2.5" />
    <!-- Glass Lens Reflections -->
    <line x1="-50" y1="-50" x2="-25" y2="-32" stroke="#E8FF70" stroke-width="1.8" stroke-linecap="round" opacity="0.75" />
    <line x1="28" y1="-50" x2="53" y2="-32" stroke="#E8FF70" stroke-width="1.8" stroke-linecap="round" opacity="0.75" />

    <!-- Autonomous Mechanical Spider climbing on shoulder (Iconic reference feature) -->
    <g transform="translate(-135, 125) scale(0.9)">
      <!-- Web strand -->
      <line x1="0" y1="-80" x2="0" y2="0" stroke="rgba(255,255,255,0.4)" stroke-dasharray="2 2" stroke-width="1" />
      <!-- Spider legs -->
      <path d="M-10 0 Q-35 -20 -45 -5" stroke="#d4d4d4" stroke-width="3" stroke-linecap="round" fill="none" />
      <path d="M-10 10 Q-45 5 -50 25" stroke="#888888" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <path d="M-5 20 Q-35 40 -30 55" stroke="#555555" stroke-width="2" stroke-linecap="round" fill="none" />
      <path d="M10 0 Q35 -20 45 -5" stroke="#d4d4d4" stroke-width="3" stroke-linecap="round" fill="none" />
      <path d="M10 10 Q45 5 50 25" stroke="#888888" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <path d="M5 20 Q35 40 30 55" stroke="#555555" stroke-width="2" stroke-linecap="round" fill="none" />
      <!-- Spider body -->
      <ellipse cx="0" cy="12" rx="14" ry="18" fill="#11131a" stroke="#444a5e" stroke-width="2" />
      <!-- Glowing Red/Yellow Reactor Core -->
      <circle cx="0" cy="14" r="6" fill="#ff3b30" filter="url(#shadowGlow)" />
      <circle cx="0" cy="14" r="2.5" fill="#E8FF70" />
      <circle cx="-4" cy="2" r="1.5" fill="#E8FF70" />
      <circle cx="4" cy="2" r="1.5" fill="#E8FF70" />
    </g>
  </g>

  <!-- Bottom Vignette -->
  <rect y="580" width="600" height="140" fill="url(#skyGrad)" opacity="0.8" />
</svg>`;

// 2. Ultra-Refined "How I Build" Michelangelo Robotic Hands SVG
const creativeHandsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 640" width="1200" height="640">
  <defs>
    <radialGradient id="sparkGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#E8FF70" stop-opacity="0.9" />
      <stop offset="30%" stop-color="#E8FF70" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#E8FF70" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="centerAtmosphere" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#181d26" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#06070a" stop-opacity="1" />
    </radialGradient>
    <filter id="laserGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur1" />
      <feGaussianBlur stdDeviation="20" result="blur2" />
      <feMerge>
        <feMergeNode in="blur2" />
        <feMergeNode in="blur1" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="1200" height="640" fill="#06070a" />
  <rect width="1200" height="640" fill="url(#centerAtmosphere)" />

  <!-- Subtle Coordinate Lines / Engineering HUD -->
  <g opacity="0.12" stroke="#ffffff" stroke-width="1">
    <circle cx="600" cy="300" r="240" fill="none" stroke="#E8FF70" stroke-width="1.5" stroke-dasharray="6 8" />
    <circle cx="600" cy="300" r="150" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="3 6" />
    <line x1="100" y1="300" x2="1100" y2="300" stroke-dasharray="4 8" />
    <line x1="600" y1="50" x2="600" y2="550" stroke-dasharray="4 8" />
  </g>

  <!-- Left Robotic Hand Segment (Detailed articulated titanium digits reaching right) -->
  <g transform="translate(140, 180)">
    <!-- Arm / Wrist Base -->
    <path d="M-80 180 L80 120 L220 130 L320 100 L400 95 L445 92" fill="none" stroke="#e0e0e0" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M-60 230 L100 170 L230 180 L330 140 L390 125" fill="none" stroke="#888888" stroke-width="7" stroke-linecap="round" />
    <path d="M-40 280 L120 220 L240 230 L330 185" fill="none" stroke="#555555" stroke-width="5" stroke-linecap="round" />
    
    <!-- Joint Rotators & Fasteners -->
    <circle cx="80" cy="120" r="11" fill="#141414" stroke="#E8FF70" stroke-width="3" />
    <circle cx="220" cy="130" r="9" fill="#141414" stroke="#ffffff" stroke-width="2.5" />
    <circle cx="320" cy="100" r="8" fill="#141414" stroke="#E8FF70" stroke-width="2" />
    <circle cx="400" cy="95" r="7" fill="#141414" stroke="#ffffff" stroke-width="2" />
    <circle cx="445" cy="92" r="5.5" fill="#E8FF70" />
    <!-- Wiring Conduit -->
    <path d="M0 160 Q150 110 320 90" stroke="#E8FF70" stroke-width="1.5" stroke-dasharray="3 3" fill="none" opacity="0.6" />
  </g>

  <!-- Right Robotic Hand Segment (Articulated digits reaching left) -->
  <g transform="translate(615, 180)">
    <!-- Arm / Wrist Base -->
    <path d="M525 180 L365 120 L225 130 L125 100 L45 95 L0 92" fill="none" stroke="#e0e0e0" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M505 230 L345 170 L215 180 L115 140 L55 125" fill="none" stroke="#888888" stroke-width="7" stroke-linecap="round" />
    <path d="M485 280 L325 220 L205 230 L115 185" fill="none" stroke="#555555" stroke-width="5" stroke-linecap="round" />
    
    <!-- Joint Rotators & Fasteners -->
    <circle cx="365" cy="120" r="11" fill="#141414" stroke="#E8FF70" stroke-width="3" />
    <circle cx="225" cy="130" r="9" fill="#141414" stroke="#ffffff" stroke-width="2.5" />
    <circle cx="125" cy="100" r="8" fill="#141414" stroke="#E8FF70" stroke-width="2" />
    <circle cx="45" cy="95" r="7" fill="#141414" stroke="#ffffff" stroke-width="2" />
    <circle cx="0" cy="92" r="5.5" fill="#E8FF70" />
    <!-- Wiring Conduit -->
    <path d="M445 160 Q295 110 125 90" stroke="#E8FF70" stroke-width="1.5" stroke-dasharray="3 3" fill="none" opacity="0.6" />
  </g>

  <!-- Central Synapse Spark Node (The touch point between fingertips) -->
  <circle cx="600" cy="272" r="45" fill="url(#sparkGlow)" />
  <circle cx="600" cy="272" r="14" fill="#E8FF70" filter="url(#laserGlow)" opacity="0.9" />
  <circle cx="600" cy="272" r="5" fill="#ffffff" />
  <line x1="585" y1="272" x2="615" y2="272" stroke="#ffffff" stroke-width="2.5" />

  <!-- Center Editorial Headline text -->
  <text x="600" y="440" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-weight="800" font-size="52" fill="#F5F3EE" text-anchor="middle" letter-spacing="-0.03em">How I build.</text>
  <text x="600" y="485" font-family="'JetBrains Mono', monospace" font-size="14" fill="#929292" text-anchor="middle" letter-spacing="0.22em">// AI ONLY WHERE IT SOLVES SOMETHING</text>
</svg>`;

fs.writeFileSync(path.join(imgDir, 'profile-placeholder.svg'), profileAvatarSvg);
fs.writeFileSync(path.join(imgDir, 'creative-hands.svg'), creativeHandsSvg);

console.log('Successfully regenerated enhanced profile and creative storytelling assets!');
