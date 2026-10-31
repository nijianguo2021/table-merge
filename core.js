(function(root){
const empty=v=>v===null||v===undefined||v==='';
function headers(row,width){const used=new Set();return Array.from({length:width},(_,i)=>{const base=String(row[i]??'').trim()||`未命名列${i+1}`;let name=base,n=2;while(used.has(name))name=`${base} (${n++})`;used.add(name);return name;});}

const label=v=>String(v??'').trim();
function detectHeader(rows){
  const first=rows.findIndex(r=>r.some(v=>label(v)!==''));
  if(first<0)return 0;
  const sample=rows.slice(first,first+30);
  const counts=sample.map(r=>r.map(label).filter(Boolean).length);
  const width=Math.max(...counts);
  // Structural rules only: skip sparse titles/notes, favor the first dense
  // textual row. Never use a customer's names, filenames or business fields.
  const isValue=v=>/^[-+]?\d/.test(v)||/^(true|false)$/i.test(v);
  for(let j=0;j<sample.length;j++){
    const values=sample[j].map(label).filter(Boolean);
    if(!values.length)continue;
    const numeric=values.filter(isValue).length;
    // Do not advance past a plausible data row to hunt for a later header.
    if(values.length>=Math.max(2,Math.ceil(width*.6))&&numeric>=Math.max(1,values.length*.4))return first;
    if(values.length>=Math.max(2,Math.ceil(width*.6))&&numeric===0)return first+j;
  }
  return first;
}
function repeatedHeader(row,header){
  const width=Math.max(row.length,header.length);
  return header.filter(v=>label(v)!=='').length>=2&&Array.from({length:width},(_,i)=>label(row[i])===label(header[i])).every(Boolean);
}
function fillMergedRows(rows,merges,header){
  const out=rows.map(r=>r.slice()),active=rows.map(r=>r.some(v=>label(v)!==''));
  for(const m of merges||[]){
    if(m.s.c!==m.e.c||m.s.r<=header)continue;
    const value=rows[m.s.r]?.[m.s.c];
    for(let r=m.s.r+1;r<=m.e.r&&r<out.length;r++)if(active[r]&&label(out[r][m.s.c])==='')out[r][m.s.c]=value??'';
  }
  return out;
}
function prepare(tables){return tables.filter(t=>t.selected!==false).map(t=>{if(!Array.isArray(t.rows)||!t.rows.length)throw Error('表格为空');if(t.rows.length>10001)throw Error('单表最多 10000 行');const width=t.rows.reduce((m,r)=>Math.max(m,r.length),0);if(width>150)throw Error('单表最多 150 列');const h=Number(t.header??detectHeader(t.rows));if(!Number.isInteger(h)||h<0||h>=t.rows.length)throw Error('表头行号无效');return {t,names:headers(t.rows[h],width),rows:fillMergedRows(t.rows,t.merges,h).slice(h+1).filter(r=>r.some(v=>!empty(v))&&!repeatedHeader(r,t.rows[h]))};});}
function columns(tables){return [...new Set(prepare(tables).flatMap(t=>t.names))];}
function merge(tables,options={}){const prep=prepare(tables);if(!prep.length)throw Error('请至少选择一张工作表');if(prep.some(p=>p.t.image&&!p.t.reviewed))throw Error('请先确认所有已选图片的识别结果');const cols=columns(tables);if(cols.length>200)throw Error('合并后超过 200 列，请统一表头');const mode=options.mode||'all',keys=options.keys||[];if(mode==='keys'&&(!keys.length||keys.some(k=>!cols.includes(k))))throw Error('请至少选择一个有效的去重列');const indices=mode==='keys'?keys.map(k=>cols.indexOf(k)):cols.map((_,i)=>i);const rows=[],duplicates=[],seen=new Set();let total=0;for(const p of prep){const mapping=cols.map(c=>p.names.indexOf(c));for(const source of p.rows){total++;if(total>20000)throw Error('每批最多处理 20000 行，请分批上传');const row=mapping.map(i=>i<0||empty(source[i])?'':String(source[i]));const values=indices.map(i=>options.trim?row[i].trim():row[i]);const key=JSON.stringify(values);const missingKey=mode==='keys'&&values.some(v=>v==='');if(mode!=='none'&&!missingKey&&seen.has(key)){duplicates.push([...row,p.t.file||'',p.t.name||'']);continue;}seen.add(key);rows.push(options.source?[...row,p.t.file||'',p.t.name||'']:row);}}
return {columns:options.source?headers([...cols,'来源文件','来源工作表'],cols.length+2):cols,rows,duplicates,duplicateColumns:headers([...cols,'来源文件','来源工作表'],cols.length+2),removed:duplicates.length,total};}
function wordsFromTSV(tsv){return String(tsv||'').split('\n').slice(1).map(line=>line.split('\t')).filter(p=>p[0]==='5'&&p.slice(11).join('\t').trim()).map(p=>({x:+p[6],y:+p[7],w:+p[8],h:+p[9],text:p.slice(11).join('\t').trim()}));}
function tableFromWords(words,boundaries){if(!words.length)throw Error('图片中未识别到文字，请换一张清晰图片');const sorted=words.slice().sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2));const lines=[];for(const w of sorted){const cy=w.y+w.h/2;let row=lines.find(r=>Math.abs(r.cy-cy)<Math.max(6,Math.min(r.height,w.h)*.6));if(!row){row={cy,height:w.h,words:[]};lines.push(row);}row.words.push(w);}lines.sort((a,b)=>a.cy-b.cy);lines.forEach(r=>r.words.sort((a,b)=>a.x-b.x));
let cuts=boundaries&&boundaries.length>2?boundaries.slice(1,-1):null;
if(!cuts){const groups=[];for(const w of lines[0].words){const last=groups[groups.length-1];if(last&&w.x-last.end<Math.max(w.h,12)*.85){last.end=w.x+w.w;}else groups.push({start:w.x,end:w.x+w.w});}cuts=groups.slice(1).map((g,i)=>(groups[i].end+g.start)/2);}
const rows=lines.map(line=>{const row=Array(cuts.length+1).fill('');for(const w of line.words){const center=w.x+w.w/2;let c=cuts.findIndex(x=>center<x);if(c<0)c=cuts.length;row[c]+=(row[c]&&/[a-zA-Z0-9]$/.test(row[c])&&/^[a-zA-Z0-9]/.test(w.text)?' ':'')+w.text;}return row;});return rows;}
const api={detectHeader,repeatedHeader,fillMergedRows,headers,columns,merge,wordsFromTSV,tableFromWords};if(typeof module!=='undefined')module.exports=api;else root.MergeCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
