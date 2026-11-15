/** Original vector covers generated offline. No fonts, images or scripts are fetched. */
export const ART_STYLES=Object.freeze([
 ['cinema','Cinéma','#13111b','#be8b4b'],['aurore','Aurore','#172645','#cb72b8'],
 ['nocturne','Nocturne','#101728','#687de4'],['obsidienne','Obsidienne','#0b0d10','#77808c'],
 ['ivoire','Ivoire','#e8e1d4','#706251'],['tonal','Tonal','#223b36','#7eb8a5'],
 ['beton','Béton','#303136','#a2a4aa'],['brume','Brume','#2c3440','#b0c5d6'],
 ['echo','Écho','#261b3c','#b297e0'],['rubis','Rubis','#35161e','#d37c8c']
].map(([id,label,bg,accent])=>Object.freeze({id,label,bg,accent})));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function makeFolderArt(title,style='cinema',shape='LANDSCAPE'){
 const spec=ART_STYLES.find(x=>x.id===style);if(!spec)throw Error('Style inconnu.');
 const text=String(title||'').trim();if(!text||text.length>100)throw Error('Titre trop long ou vide.');
 const [w,h]=shape==='POSTER'?[400,600]:shape==='SQUARE'?[480,480]:[640,360];
 const words=text.split(/\s+/),lines=[];let line='';
 for(const word of words){if(line&&(line+' '+word).length>22){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
 const maxLines=4,rows=lines.slice(0,maxLines);if(lines.length>maxLines)rows[maxLines-1]+='…';
 const fg=style==='ivoire'?'#27221d':'#fff',font=shape==='LANDSCAPE'?32:29;
 const label=rows.map((s,i)=>`<text x="36" y="${h-42-(rows.length-1-i)*39}" fill="${fg}" font-size="${font}" font-family="sans-serif" font-weight="700">${escape(s)}</text>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" data-ma-collection="1" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${spec.bg}"/><circle cx="${w-15}" cy="45" r="${Math.round(w*.44)}" fill="${spec.accent}" opacity=".22"/><circle cx="${w-15}" cy="45" r="${Math.round(w*.27)}" fill="none" stroke="${spec.accent}" stroke-width="2"/><path d="M36 40H106" stroke="${spec.accent}" stroke-width="5"/>${label}</svg>`;
 return 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));
}
export function isGeneratedFolderArt(url){
 if(typeof url!=='string'||url.length>8192||!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(url))return false;
 try{
  const svg=atob(url.split(',')[1]);
  // Accept precisely our tiny rendering vocabulary, never an active SVG upload.
  if(!svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" data-ma-collection="1" ')||!svg.endsWith('</svg>'))return false;
  if(/(?:href|url\s*\(|\bon\w+\s*=|<!|<\?)/i.test(svg))return false;
  if([...svg.matchAll(/<\/?([\w:-]+)/g)].some(m=>!['svg','rect','circle','path','text'].includes(m[1])))return false;
  return true;
 }catch{return false;}
}
