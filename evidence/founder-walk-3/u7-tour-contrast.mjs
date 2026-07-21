// WCAG contrast for the first-run tour in DARK mode (FW3 U7 re-verification).
function srgb(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
function lum(hex){const m=hex.replace('#','');const r=parseInt(m.slice(0,2),16),g=parseInt(m.slice(2,4),16),b=parseInt(m.slice(4,6),16);return 0.2126*srgb(r)+0.7152*srgb(g)+0.0722*srgb(b);}
// blend rgba over an opaque base → effective hex
function over(fgHex,fa,baseHex){const f=fgHex.replace('#',''),b=baseHex.replace('#','');const mix=(i)=>Math.round(parseInt(f.slice(i,i+2),16)*fa+parseInt(b.slice(i,i+2),16)*(1-fa));const h=(n)=>n.toString(16).padStart(2,'0');return '#'+h(mix(0))+h(mix(2))+h(mix(4));}
function ratio(a,b){const l1=lum(a),l2=lum(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05);}
// dark tokens
const card='#08170F', text='#FBF7EC', meta='#968768', sage='#7FA98A', green='#1A3A2A', gold='#D4A737';
const divOnCard=over('#F7F7EC',0.06,card); // --div rgba(247,247,236,.06) over card
const pairs=[
 ['Step title (--text on card)', text, card, 'AA 4.5'],
 ['Step body (--meta on card)', meta, card, 'AA 4.5'],
 ['Skip link (--meta on card)', meta, card, 'AA 4.5'],
 ['Next button label (--brand-gold on --brand-green)', gold, green, 'AA 4.5'],
 ['Progress filled (--brand-fg sage on card)', sage, card, 'UI 3.0'],
 ['Close × (--meta on --div-over-card)', meta, divOnCard, 'UI 3.0'],
];
console.log('\nFW3 U7 — first-run tour, DARK mode contrast\n'+'─'.repeat(70));
let n=0,pass=0;
for(const [label,fg,bg,req] of pairs){const r=ratio(fg,bg);const need=parseFloat(req.split(' ')[1]);const ok=r>=need;n++;if(ok)pass++;console.log(`  ${ok?'PASS':'FAIL'}  ${r.toFixed(2)}:1  (need ${req})  ${label}`);}
console.log('─'.repeat(70)+`\n  ${pass}/${n} pass\n  (--div over card = ${divOnCard})`);
