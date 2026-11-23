const ROOT='C:/Users/lucas/Desktop/PathSignal/Presentation pack/Final year slides/build';
const INK='#1c1b1a', CREAM='#f7ebdf';
export async function applyRetro({presentation:p,input}){
 for(const index of input.slides){
  const s=p.slides.getItem(index);
  s.background.fill=CREAM;
  const bg=s.images.add({path:ROOT+'/retro-background.png',alt:'Retro computer-window theme with coral title bar and blue outer border',fit:'cover',position:{left:0,top:0,width:1280,height:720}});
  bg.sendToBack();
  const existing=s.shapes.items.slice();
  for(const a of existing){
   const value=String(a.text),pos=a.position;
   if(!value)continue;
   if(index>0&&pos.top===56){
    a.position={left:70,top:58,width:1030,height:70};
    a.text.style={fontFamily:'Arial Black',fontSize:'30pt',bold:true,color:INK};
   }else if(/^\d{2}$/.test(value)){
    a.text.style={fontFamily:'Courier New',fontSize:'13pt',bold:true,color:INK};
   }
   if(index===7&&a.geometry==='roundRect'){
    a.line={fill:INK,width:3};a.shadow='5px 5px 0px #1c1b1a';
   }
  }
  for(const t of s.tables.items){
   const snap=t.toSnapshot();
   t.borders.assign({style:'solid',fill:INK,width:2});
   for(let r=0;r<snap.rows;r++)for(let c=0;c<snap.cols;c++){
    const cell=t.getCell(r,c);
    cell.fill=r===0?['#91c3ff','#ffaf18','#32b8ae'][index%3]:r%2?'#fffaf3':CREAM;
    cell.text.style={fontFamily:'Arial',fontSize:(index===5?18:index===10?19:20)+'pt',bold:r===0,color:INK};
   }
  }
  if(index===0){
   const title=p.resolve('sh/3e58za9k');
   title.position={left:72,top:225,width:642,height:114};
   title.fill='#ffaf18';title.line={fill:INK,width:3};title.shadow='7px 7px 0px #1c1b1a';
   title.text.style={fontFamily:'Arial Black',fontSize:'56pt',bold:true,color:INK};title.text.insets=14;
   const sub=p.resolve('sh/2dw765sz');sub.position={left:76,top:376,width:655,height:120};
   sub.text.style={fontFamily:'Arial',fontSize:'32pt',bold:true,color:INK};
   const note=p.resolve('sh/pgnq10rq');note.position={left:76,top:578,width:630,height:63};
   note.text.style={fontFamily:'Courier New',fontSize:'16pt',bold:true,color:INK};
   for(const im of s.images.items){if(im.toSnapshot().aid!==bg.toSnapshot().aid){im.frame={left:790,top:178,width:410,height:470};im.geometry='roundRect';im.borderRadius=18;}}
   const top=s.shapes.add({geometry:'textbox',position:{left:72,top:61,width:990,height:60},fill:'none',line:{fill:'none',width:0}});
   top.text='FINAL YEAR PROJECT';top.text.style={fontFamily:'Courier New',fontSize:'25pt',bold:true,color:INK};top.text.insets=0;
  }
  if(index===1){for(const a of s.shapes.items)if(String(a.text)==='Supplied bottle test image')a.position={...a.position,top:515};}
 }
 if(input.render!==false) await p.render({slide:input.slides});
 return {restyled:input.slides.map(i=>i+1)};
}

