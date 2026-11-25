// Every vehicle that can bring a reminder. All face left (they travel right-to-left).
//   lane:  'sky' (top-right, stacked downwards) or 'ground' (bottom-right, stacked upwards)
//   kind:  'tow'    – pulls a banner behind it
//          'tag'    – carries a hanging name tag under it (balloon)
//          'bubble' – shows a speech bubble above it
//   enter: 'right' | 'bottom'   exit: 'left' | 'up'
/* eslint-disable max-len */
const INK = '#2b2d42';

const wheel = (cx, cy, r, color = INK) => `
  <g class="wheel">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="#e6e8ee"/>
    <path d="M${cx - r * 0.45} ${cy} H${cx + r * 0.45} M${cx} ${cy - r * 0.45} V${cy + r * 0.45}" stroke="#9aa0b4" stroke-width="2"/>
  </g>`;

const spokedWheel = (cx, cy, r) => {
  let spokes = '';
  for (let a = 0; a < 180; a += 30) {
    const rad = (a * Math.PI) / 180, dx = Math.cos(rad) * r, dy = Math.sin(rad) * r;
    spokes += `M${(cx - dx).toFixed(1)} ${(cy - dy).toFixed(1)} L${(cx + dx).toFixed(1)} ${(cy + dy).toFixed(1)} `;
  }
  return `
  <g class="wheel">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="5"/>
    <path d="${spokes}" stroke="#9aa0b4" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="3.5" fill="${INK}"/>
  </g>`;
};

const face = (x, y, s = 1) => `
  <circle cx="${x}" cy="${y}" r="${2.6 * s}" fill="${INK}"/>
  <path d="M${x - 5 * s} ${y + 7 * s} q${5 * s} ${4 * s} ${10 * s} 0" stroke="${INK}" stroke-width="${2.2 * s}" fill="none" stroke-linecap="round"/>`;

const waves = (() => {
  let d = 'M-40 104';
  for (let x = -40; x < 200; x += 20) d += ' q10 -7 20 0';
  return `<clipPath id="sea"><ellipse cx="75" cy="112" rx="74" ry="14"/></clipPath>
    <g clip-path="url(#sea)"><path class="waves" d="${d} L200 120 L-40 120 Z" fill="#4cc9f0" opacity=".85"/></g>`;
})();

const VEHICLES = {
  plane: {
    label: 'Plane', lane: 'sky', kind: 'tow', enter: 'right', exit: 'left', notes: [784, 1047],
    svg: `<svg width="150" height="74" viewBox="0 0 150 74" aria-hidden="true">
      <path d="M112 30 L140 8 L146 10 L134 36 Z" fill="#ff6b6b"/>
      <path d="M118 40 L146 44 L144 50 L116 48 Z" fill="#e85a5a"/>
      <ellipse cx="68" cy="38" rx="58" ry="18" fill="#4cc9f0"/>
      <path d="M14 38 Q20 22 52 21 L52 38 Z" fill="#7ad7f5"/>
      <ellipse cx="68" cy="45" rx="54" ry="8" fill="#38b4dc" opacity=".5"/>
      <circle cx="38" cy="33" r="5" fill="#fffaf2"/><circle cx="56" cy="32" r="5" fill="#fffaf2"/><circle cx="74" cy="32" r="5" fill="#fffaf2"/>
      <path d="M58 40 L92 40 L104 64 L84 64 Z" fill="#ffd166"/>
      <path d="M62 34 L90 34 L98 14 L84 14 Z" fill="#ffd166" opacity=".9"/>
      <circle cx="12" cy="38" r="5" fill="${INK}"/>
      <g class="prop" style="transform-origin: 9px 37px"><ellipse cx="9" cy="37" rx="3" ry="20" fill="${INK}" opacity=".75"/></g>
      <path d="M30 44 q4 4 8 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`,
  },

  jet: {
    label: 'Jet', lane: 'sky', kind: 'tow', enter: 'right', exit: 'left', notes: [880, 1175, 1568],
    svg: `<svg width="176" height="64" viewBox="0 0 176 64" aria-hidden="true">
      <path d="M144 22 L156 2 L168 2 L164 24 Z" fill="#ff6b6b"/>
      <path d="M72 36 L116 36 L88 62 L74 62 Z" fill="#c9d3e3"/>
      <path d="M8 34 Q12 22 40 21 L148 20 Q166 20 170 27 L170 33 Q160 40 40 43 Q12 43 8 34 Z" fill="#f4f6fb"/>
      <path d="M30 34 L168 30 L168 34 L30 38 Z" fill="#ff6b6b"/>
      <path d="M17 31 Q22 24 38 23 L40 31 Z" fill="#4cc9f0"/>
      <g fill="#4cc9f0"><circle cx="54" cy="27" r="2.6"/><circle cx="66" cy="26.6" r="2.6"/><circle cx="78" cy="26.3" r="2.6"/><circle cx="90" cy="26" r="2.6"/><circle cx="102" cy="25.7" r="2.6"/><circle cx="114" cy="25.4" r="2.6"/></g>
      <path d="M146 30 L174 36 L174 41 L148 37 Z" fill="#c9d3e3"/>
      <path d="M86 48 L106 48 Q110 48 110 52 L110 54 L86 54 Z" fill="#9aa0b4"/>
      <path d="M14 37 q4 3 8 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`,
  },

  biplane: {
    label: 'Biplane', lane: 'sky', kind: 'tow', enter: 'right', exit: 'left', notes: [659, 784, 988],
    svg: `<svg width="160" height="90" viewBox="0 0 160 90" aria-hidden="true">
      <path d="M128 36 L136 14 L148 16 L144 38 Z" fill="#ff6b6b"/>
      <rect x="40" y="56" width="72" height="9" rx="4.5" fill="#e85a5a"/>
      <path d="M54 62 L48 76 M98 62 L104 76" stroke="#8a6a50" stroke-width="2.5"/>
      ${wheel(48, 78, 8)}${wheel(104, 78, 8)}
      <path d="M16 46 Q18 34 42 34 L122 38 L142 32 L148 34 L140 50 L42 58 Q18 58 16 46 Z" fill="#ffd166"/>
      <path d="M48 23 L50 58 M100 23 L98 58" stroke="#8a6a50" stroke-width="2.5"/>
      <path d="M78 32 q12 -4 26 4 q-12 -1 -24 3 Z" fill="#06d6a0"/>
      <circle cx="74" cy="28" r="7.5" fill="#f2c9a0"/>
      <path d="M66 27 Q67 19 74 19 Q82 19 82 27 Z" fill="#8a5a32"/>
      <rect x="67" y="24" width="11" height="4" rx="2" fill="#4cc9f0"/>
      <rect x="34" y="14" width="80" height="9" rx="4.5" fill="#ff6b6b"/>
      ${face(31, 42, 0.9)}
      <circle cx="16" cy="46" r="6" fill="${INK}"/>
      <g class="prop" style="transform-origin: 11px 46px"><ellipse cx="11" cy="46" rx="3" ry="22" fill="${INK}" opacity=".75"/></g>
    </svg>`,
  },

  helicopter: {
    label: 'Helicopter', lane: 'sky', kind: 'tow', enter: 'right', exit: 'left', notes: [523, 659, 784],
    svg: `<svg width="160" height="100" viewBox="0 0 160 100" aria-hidden="true">
      <rect x="60" y="14" width="6" height="14" fill="${INK}"/>
      <g class="rotor" style="transform-origin: 63px 12px"><rect x="6" y="9" width="114" height="6" rx="3" fill="${INK}"/></g>
      <path d="M96 50 L148 44 L150 54 L98 64 Z" fill="#05b98a"/>
      <g class="tailrotor" style="transform-origin: 148px 46px"><rect x="146" y="32" width="4" height="28" rx="2" fill="${INK}"/></g>
      <path d="M20 60 Q20 28 60 26 Q94 26 100 54 Q98 80 58 80 Q20 80 20 60 Z" fill="#06d6a0"/>
      <path d="M27 56 Q29 36 54 34 L56 56 Z" fill="#bff3ff"/>
      ${face(74, 50)}
      <path d="M44 80 L40 92 M80 80 L84 92" stroke="${INK}" stroke-width="3"/>
      <path d="M28 92 L100 92" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
  },

  balloon: {
    label: 'Hot-air balloon', lane: 'sky', kind: 'tag', enter: 'bottom', exit: 'up', notes: [660, 880, 1175],
    svg: `<svg width="118" height="160" viewBox="0 0 118 160" aria-hidden="true">
      <defs><clipPath id="env"><path d="M59 4 C22 4 4 32 4 58 C4 86 34 106 46 120 L72 120 C84 106 114 86 114 58 C114 32 96 4 59 4 Z"/></clipPath></defs>
      <g clip-path="url(#env)">
        <rect x="0" y="0" width="118" height="130" fill="#ff6b6b"/>
        <path d="M59 0 C38 30 38 90 50 130 L68 130 C80 90 80 30 59 0 Z" fill="#fffaf2"/>
        <path d="M24 0 C10 40 22 90 40 130 L46 130 C34 90 26 40 40 0 Z" fill="#ffd166"/>
        <path d="M94 0 C108 40 96 90 78 130 L72 130 C84 90 92 40 78 0 Z" fill="#ffd166"/>
        <ellipse cx="38" cy="34" rx="10" ry="16" fill="#fff" opacity=".35"/>
      </g>
      <path d="M46 120 L50 138 M72 120 L68 138" stroke="#8a6a50" stroke-width="2"/>
      <rect x="47" y="136" width="24" height="18" rx="4" fill="#b07a4a"/>
      <path d="M47 142 h24 M47 148 h24" stroke="#8a5a32" stroke-width="1.5"/>
      <path d="M52 66 q7 6 14 0" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="48" cy="56" r="3" fill="${INK}"/><circle cx="70" cy="56" r="3" fill="${INK}"/>
      <circle cx="42" cy="64" r="4" fill="#ff9a9a" opacity=".7"/><circle cx="76" cy="64" r="4" fill="#ff9a9a" opacity=".7"/>
    </svg>`,
  },

  car: {
    label: 'Car', lane: 'ground', kind: 'bubble', enter: 'right', exit: 'left', notes: [587, 587, 880],
    svg: `<svg width="170" height="82" viewBox="0 0 170 82" aria-hidden="true">
      <path d="M8 56 Q8 40 24 38 L46 36 L62 18 Q66 14 74 14 L118 14 Q126 14 130 20 L144 38 Q162 40 164 54 L164 62 Q164 66 160 66 L12 66 Q8 66 8 62 Z" fill="#ff6b6b"/>
      <path d="M66 22 L96 22 L96 38 L54 38 Z" fill="#bff3ff"/>
      <path d="M102 22 L122 22 Q125 22 127 25 L136 38 L102 38 Z" fill="#bff3ff"/>
      <path d="M99 40 L99 62" stroke="#e05252" stroke-width="2"/>
      <rect x="108" y="44" width="10" height="3" rx="1.5" fill="#e05252"/>
      <ellipse cx="13" cy="47" rx="4.5" ry="5.5" fill="#ffd166"/>
      <rect x="158" y="44" width="6" height="8" rx="2" fill="#c0392b"/>
      <rect x="4" y="59" width="16" height="6" rx="3" fill="#d9dce4"/>
      ${face(34, 48, 0.9)}
      ${wheel(44, 66, 14)}${wheel(132, 66, 14)}
    </svg>`,
  },

  bike: {
    label: 'Bicycle', lane: 'ground', kind: 'bubble', enter: 'right', exit: 'left', notes: [1319, 1319],
    svg: `<svg width="150" height="100" viewBox="0 0 150 100" aria-hidden="true">
      ${spokedWheel(30, 74, 22)}${spokedWheel(118, 74, 22)}
      <path d="M118 74 L76 76 L90 42 Z M90 42 L46 42 L76 76 M46 42 L30 74" stroke="#4cc9f0" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M46 42 L42 28 L30 26" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M82 37 L100 37" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="76" cy="76" r="6" fill="${INK}"/>
      <rect x="12" y="36" width="28" height="18" rx="4" fill="#ffd166"/>
      <path d="M12 42 H40 M12 48 H40" stroke="#e9b949" stroke-width="1.5"/>
      <circle cx="20" cy="33" r="5" fill="#ff6b6b"/><circle cx="30" cy="31" r="5" fill="#06d6a0"/><circle cx="25" cy="29" r="4" fill="#ff9ad5"/>
    </svg>`,
  },

  scooter: {
    label: 'Scooter', lane: 'ground', kind: 'bubble', enter: 'right', exit: 'left', notes: [784, 659, 784],
    svg: `<svg width="150" height="98" viewBox="0 0 150 98" aria-hidden="true">
      <path d="M80 82 L80 58 Q84 46 110 46 Q140 46 142 72 Q142 82 132 82 Z" fill="#4cc9f0"/>
      <rect x="40" y="74" width="50" height="8" rx="3" fill="#2fa8d0"/>
      <path d="M36 82 Q30 60 40 40 L50 20 L58 22 L50 42 Q44 60 50 82 Z" fill="#4cc9f0"/>
      <path d="M16 82 Q18 64 32 64 Q46 64 48 78" fill="#2fa8d0"/>
      <path d="M44 20 L62 13" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="47" cy="25" r="6" fill="#ffd166"/>
      <path d="M92 46 Q96 36 128 38 Q134 40 130 46 Z" fill="${INK}"/>
      <rect x="128" y="50" width="6" height="7" rx="2" fill="#c0392b"/>
      ${face(42, 52, 0.85)}
      ${wheel(32, 84, 13)}${wheel(118, 84, 13)}
    </svg>`,
  },

  boat: {
    label: 'Sailboat', lane: 'ground', kind: 'bubble', enter: 'right', exit: 'left', notes: [523, 659, 784, 1047],
    svg: `<svg width="150" height="120" viewBox="0 0 150 120" aria-hidden="true">
      <path d="M78 8 L78 88" stroke="#8a6a50" stroke-width="4"/>
      <path d="M80 6 L98 10 L80 15 Z" fill="#ff6b6b"/>
      <path d="M82 14 L82 82 L134 82 Z" fill="#fffaf2" stroke="#eadfce" stroke-width="2"/>
      <path d="M74 20 L74 82 L34 82 Z" fill="#ffd166"/>
      <path d="M14 86 L140 86 Q134 106 114 108 L40 108 Q22 106 14 86 Z" fill="#ff6b6b"/>
      <path d="M17 92 L137 92" stroke="#fffaf2" stroke-width="3"/>
      <circle cx="56" cy="99" r="3.5" fill="#bff3ff"/><circle cx="78" cy="99" r="3.5" fill="#bff3ff"/><circle cx="100" cy="99" r="3.5" fill="#bff3ff"/>
      ${face(32, 96, 0.8)}
      ${waves}
    </svg>`,
  },
  fighter: {
    label: 'Fighter jet', lane: 'sky', kind: 'tow', enter: 'right', exit: 'left', notes: [392, 523, 784],
    svg: `<svg width="190" height="72" viewBox="0 0 190 72" aria-hidden="true">
      <path class="flame" d="M170 31 L188 36 L170 41 Z" fill="#ffb020"/>
      <path d="M142 24 L158 4 L170 4 L164 26 Z" fill="#5f6d4c"/>
      <path d="M72 38 L134 38 L112 68 L96 68 Z" fill="#5f6d4c"/>
      <rect x="86" y="60" width="22" height="3.5" rx="1.75" fill="#c9d3e3"/>
      <path d="M4 36 L40 27 L150 25 L172 30 L172 42 L150 46 L40 45 Z" fill="#7d8b6a"/>
      <path d="M36 30 Q46 19 64 23 L68 30 Z" fill="#4cc9f0"/>
      <path d="M146 38 L172 48 L170 53 L144 43 Z" fill="#5f6d4c"/>
      <circle cx="112" cy="51" r="5" fill="#fffaf2"/><circle cx="112" cy="51" r="2.4" fill="#ff6b6b"/>
      <path d="M78 34 L140 33" stroke="#6b7858" stroke-width="2"/>
      ${face(24, 33, 0.75)}
    </svg>`,
  },

  drone: {
    label: 'Drone', lane: 'sky', kind: 'tag', enter: 'bottom', exit: 'up', notes: [988, 1319, 988],
    svg: `<svg width="156" height="84" viewBox="0 0 156 84" aria-hidden="true">
      <path d="M56 40 L20 30 M100 40 L136 30" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <rect x="16" y="22" width="8" height="10" rx="2" fill="${INK}"/><rect x="132" y="22" width="8" height="10" rx="2" fill="${INK}"/>
      <g class="rotor" style="transform-origin: 20px 21px"><ellipse cx="20" cy="21" rx="19" ry="3" fill="${INK}" opacity=".7"/></g>
      <g class="rotor" style="transform-origin: 136px 21px"><ellipse cx="136" cy="21" rx="19" ry="3" fill="${INK}" opacity=".7"/></g>
      <circle class="blink" cx="20" cy="33" r="2.6" fill="#06d6a0"/><circle class="blink" cx="136" cy="33" r="2.6" fill="#ff6b6b"/>
      <path d="M60 60 L52 76 M96 60 L104 76" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M46 76 H58 M98 76 H110" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="48" y="30" width="60" height="30" rx="15" fill="#e9edf5"/>
      <rect x="52" y="32" width="52" height="8" rx="4" fill="#4cc9f0" opacity=".35"/>
      <circle cx="78" cy="64" r="8" fill="${INK}"/><circle cx="78" cy="64" r="3.5" fill="#4cc9f0"/>
      <circle cx="68" cy="44" r="2.8" fill="${INK}"/><circle cx="88" cy="44" r="2.8" fill="${INK}"/>
      <path d="M72 50 q6 4 12 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </svg>`,
  },

  tank: {
    label: 'Tank', lane: 'ground', kind: 'bubble', enter: 'right', exit: 'left', notes: [196, 262, 330],
    svg: `<svg width="184" height="92" viewBox="0 0 184 92" aria-hidden="true">
      <rect x="4" y="26" width="60" height="7" rx="3.5" fill="#4e6a36"/>
      <rect x="0" y="24" width="10" height="11" rx="2" fill="#3f572b"/>
      <path d="M62 46 Q64 24 94 22 L120 22 Q134 24 136 46 Z" fill="#7fa35a"/>
      <ellipse cx="104" cy="22" rx="11" ry="4" fill="#5d7d42"/>
      <ellipse cx="116" cy="34" rx="8" ry="5" fill="#6a8f47"/>
      <path d="M18 62 L30 46 L156 46 L168 62 Z" fill="#6f8f4e"/>
      <ellipse cx="128" cy="54" rx="12" ry="4" fill="#5d7d42"/><ellipse cx="70" cy="53" rx="9" ry="3.5" fill="#5d7d42"/>
      ${face(46, 50, 0.85)}
      <rect x="10" y="60" width="164" height="28" rx="14" fill="#3b4a2f"/>
      ${[28, 54, 80, 106, 132, 158].map((x) => wheel(x, 74, 9, '#6b7a55')).join('')}
    </svg>`,
  },

  police: {
    label: 'Police car', lane: 'ground', kind: 'bubble', enter: 'right', exit: 'left', notes: [988, 740, 988, 740],
    svg: `<svg width="170" height="86" viewBox="0 0 170 86" aria-hidden="true">
      <rect x="78" y="10" width="40" height="8" rx="4" fill="${INK}"/>
      <rect class="siren-r" x="80" y="11" width="17" height="6" rx="3" fill="#ff3b3b"/>
      <rect class="siren-b" x="99" y="11" width="17" height="6" rx="3" fill="#3b82ff"/>
      <path d="M8 60 Q8 44 24 42 L46 40 L62 22 Q66 18 74 18 L118 18 Q126 18 130 24 L144 42 Q162 44 164 58 L164 66 Q164 70 160 70 L12 70 Q8 70 8 66 Z" fill="#f4f6fb"/>
      <path d="M8 56 L164 56 L164 66 Q164 70 160 70 L12 70 Q8 70 8 66 Z" fill="#1e3a8a"/>
      <path d="M66 26 L96 26 L96 42 L54 42 Z" fill="#bff3ff"/>
      <path d="M102 26 L122 26 Q125 26 127 29 L136 42 L102 42 Z" fill="#bff3ff"/>
      <path d="M99 44 L99 66" stroke="#c9d3e3" stroke-width="2"/>
      <path d="M118 45 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 Z" fill="#ffd166"/>
      <ellipse cx="13" cy="50" rx="4.5" ry="5" fill="#ffd166"/>
      <rect x="158" y="47" width="6" height="7" rx="2" fill="#c0392b"/>
      ${face(34, 50, 0.85)}
      ${wheel(44, 70, 14)}${wheel(132, 70, 14)}
    </svg>`,
  },

  swat: {
    label: 'SWAT truck', lane: 'ground', kind: 'bubble', enter: 'right', exit: 'left', notes: [330, 330, 440],
    svg: `<svg width="196" height="104" viewBox="0 0 196 104" aria-hidden="true">
      <rect x="120" y="6" width="34" height="8" rx="4" fill="${INK}"/>
      <rect class="siren-r" x="122" y="7" width="14" height="6" rx="3" fill="#ff3b3b"/>
      <rect class="siren-b" x="138" y="7" width="14" height="6" rx="3" fill="#3b82ff"/>
      <path d="M6 78 L6 50 Q6 40 18 38 L44 36 L58 16 Q60 14 64 14 L184 14 Q190 14 190 20 L190 82 Q190 86 186 86 L10 86 Q6 86 6 82 Z" fill="#243049"/>
      <path d="M48 38 L62 20 L88 20 L88 38 Z" fill="#9fd8ec"/>
      <rect x="98" y="22" width="18" height="8" rx="2" fill="#9fd8ec"/><rect x="124" y="22" width="18" height="8" rx="2" fill="#9fd8ec"/><rect x="150" y="22" width="18" height="8" rx="2" fill="#9fd8ec"/>
      <rect x="96" y="46" width="86" height="10" rx="2" fill="#ffd166"/>
      <path d="M92 40 L92 82" stroke="#33405d" stroke-width="2.5"/>
      <rect x="2" y="70" width="18" height="10" rx="3" fill="#4a5672"/>
      <path d="M6 64 h14 M6 68 h14" stroke="#4a5672" stroke-width="2"/>
      <ellipse cx="11" cy="52" rx="4" ry="5" fill="#ffd166"/>
      <circle cx="34" cy="52" r="2.6" fill="#fffaf2"/>
      <path d="M28 60 q5 4 10 0" stroke="#fffaf2" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      ${wheel(46, 86, 16)}${wheel(156, 86, 16)}
    </svg>`,
  },
};

const ORDER = ['plane', 'jet', 'fighter', 'biplane', 'helicopter', 'balloon', 'drone', 'car', 'police', 'swat', 'tank', 'bike', 'scooter', 'boat'];
const VEHICLE_KEYS = ORDER.filter((k) => VEHICLES[k]).concat(Object.keys(VEHICLES).filter((k) => !ORDER.includes(k)));
if (typeof module !== 'undefined') module.exports = { VEHICLES, VEHICLE_KEYS };
