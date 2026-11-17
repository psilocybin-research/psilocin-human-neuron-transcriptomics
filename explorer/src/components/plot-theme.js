// Theme presentation only: estimates, axis limits and signed colour scales stay fixed.
const NS='http://www.w3.org/2000/svg';
let sequence=0;
const themed=new WeakMap();
export function plotPalette(scope=document.querySelector('#psilocin-app')){
 const style=getComputedStyle(scope||document.documentElement),read=(key,fallback)=>style.getPropertyValue(`--plot-${key}`).trim()||fallback;
 return {background:read('background','#ffffff'),text:read('text','#263b49'),muted:read('muted','#526575'),grid:read('grid','#dde3e9'),axis:read('axis','#8093a2'),shared:read('shared','#222222'),selected:read('selected','#edf3f8'),highlight:read('highlight','#a07321'),accent:read('accent','#235780'),teal:read('teal','#236461'),block:read('block','#9a6960'),sharedText:read('shared-text','#ffffff')};
}
export function themeScientificSVG(svg,palette=plotPalette()){
 const signature=JSON.stringify(palette)+svg.getAttribute('viewBox');
 if(themed.get(svg)===signature&&svg.querySelector(':scope > style[data-plot-theme]')&&svg.querySelector(':scope > rect[data-plot-background]'))return;
 themed.set(svg,signature);
 if(!svg.dataset.plotThemeId)svg.dataset.plotThemeId=`plot-${++sequence}`;
 const scope=`svg[data-plot-theme-id="${svg.dataset.plotThemeId}"]`;
 const neutrals=['#d7dedf','#e1e7eb','#d3dfe7','#edf0f0','#dce3e8','#d7e1e8','#e1e6e1','#e6ebe8'];
 const axes=['#879998','#647d8f','#7b92a4','#8ca298','#94a7b4','#7a8b85'];
 const rules=`${scope}{background:${palette.background};color:${palette.text};fill:${palette.text};--plot-shared:${palette.shared};--plot-selected:${palette.selected};--plot-highlight:${palette.highlight};--plot-background:${palette.background};--plot-text:${palette.text};--plot-axis:${palette.axis}}
${scope} text:not([fill="#fff"]):not([fill="white"]):not(.category-count):not(.network-tier){fill:${palette.text}}
${neutrals.map(value=>`${scope} line[stroke="${value}"]`).join(',')}{stroke:${palette.grid}}
${axes.map(value=>`${scope} line[stroke="${value}"]`).join(',')}{stroke:${palette.axis}}
${scope} [stroke="#235780"]{stroke:${palette.accent}}
${scope} [fill="#235780"]{fill:${palette.accent}}
${scope} [stroke="#236461"]{stroke:${palette.teal}}
${scope} [fill="#236461"]{fill:${palette.teal}}
${scope} [fill="#9a6960"]{fill:${palette.block}}
${scope} [fill="#222222"]{fill:${palette.shared}}
${scope} .shared-category-label{fill:${palette.sharedText}}
${scope} rect[fill="#edf3f1"],${scope} .gene-row:hover>rect:first-child{fill:${palette.selected}}
${scope} .network-node .network-node-hit,${scope} .network-node[aria-pressed=true] .network-node-hit,${scope} .network-node:focus-visible .network-node-hit{fill:transparent;stroke:none;pointer-events:all}
${scope} .network-node circle{transition:stroke .12s ease,stroke-width .12s ease}
${scope} .network-node[aria-pressed=true] circle,${scope} .network-node:hover circle{stroke:${palette.accent};stroke-width:3.5px}
${scope} .network-node.search-match circle,${scope} .network-node:focus-visible circle{stroke:${palette.highlight};stroke-width:3.5px}
${scope} .network-node[aria-pressed=true] .network-node-label{font-weight:650}
${scope} .network-node-label{fill:${palette.text};paint-order:stroke;stroke:${palette.background};stroke-width:4px}
${scope} .network-tier{fill:#152c3b;paint-order:stroke;stroke:#fff;stroke-width:2px;stroke-linejoin:round}
${scope} .network-link{stroke:${palette.axis};stroke-opacity:.55}
${scope} .network-edge[aria-pressed=true] .network-link,${scope} .network-edge:hover .network-link{stroke:${palette.highlight};stroke-opacity:1}
${scope} .chord-ribbon{stroke:${palette.background}}
${scope} .chord-ribbon:hover,${scope} .chord-ribbon[aria-pressed=true]{fill:${palette.axis}}
${scope} .chord-label{fill:${palette.text}}

`;
 let sheet=svg.querySelector(':scope > style[data-plot-theme]');
 if(!sheet){sheet=document.createElementNS(NS,'style');sheet.dataset.plotTheme='';svg.prepend(sheet);}
 if(sheet.textContent!==rules)sheet.textContent=rules;
 svg.style.background=palette.background;svg.style.color=palette.text;
 // An explicit substrate keeps exported SVG backgrounds portable.
 let background=svg.querySelector(':scope > rect[data-plot-background]');
 if(!background){background=document.createElementNS(NS,'rect');background.dataset.plotBackground='';background.setAttribute('pointer-events','none');svg.prepend(background);}
 const box=svg.viewBox.baseVal;
 for(const [key,value]of Object.entries({x:box.x,y:box.y,width:box.width,height:box.height,fill:palette.background}))if(background.getAttribute(key)!==String(value))background.setAttribute(key,String(value));
}
export function themeScientificPlots(scope){
 const palette=plotPalette();
 for(const svg of scope.querySelectorAll('svg:not([aria-hidden=true])'))if(!svg.closest('button'))themeScientificSVG(svg,palette);
 for(const canvas of scope.querySelectorAll('canvas'))if(canvas.dataset.plotBackground!==palette.background){canvas.dataset.plotBackground=palette.background;canvas.dispatchEvent(new CustomEvent('atlas:appearancechange'));}
}
