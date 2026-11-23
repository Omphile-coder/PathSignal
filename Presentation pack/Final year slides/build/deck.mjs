const ROOT='C:/Users/lucas/Desktop/PathSignal';
const C={ink:'#1c1b1a',cream:'#f7ebdf',paper:'#fffaf3',blue:'#91c3ff',pink:'#ff9294',teal:'#32b8ae',orange:'#ffaf18',muted:'#49433f'};
const REF={who:'https://www.who.int/news-room/fact-sheets/detail/blindness-and-visual-impairment',rnib:'https://media.rnib.org.uk/documents/Understanding_how_blind_and_partially_sighted_people_get_around_-_RNIB_2021.pdf',lazarillo:'https://lazarillo.app/theapp/',wewalk:'https://support.wewalk.io/en/article/wewalk-smart-cane-2-users-manual/',yolox:'https://github.com/Megvii-BaseDetection/YOLOX',stairs:'https://universe.roboflow.com/mawarshazleen/obstacle-detection-n3eec',expo:'https://docs.expo.dev/get-started/start-developing/',ort:'https://onnxruntime.ai/docs/tutorials/web/'};
function text(s,value,x,y,w,h,size=22,bold=false,color=C.ink,align='left'){
 const a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 a.text=value;a.text.style={fontFamily:'Arial',fontSize:size+'pt',bold,color,alignment:align};a.text.insets=0;return a;
}
function base(p,title,num,bg=C.cream){const s=p.slides.add({width:1280,height:720});s.background.fill=bg;text(s,title,72,56,1136,80,34,true);text(s,String(num).padStart(2,'0'),1160,660,48,25,13,false,C.muted,'right');return s;}
function notes(s,body,urls=[]){s.speakerNotes.text=body+(urls.length?'\n\nSources (accessed 21 November 2026):\n'+urls.join('\n'):'');}
function table(s,values,x,y,w,h,widths,size=18){
 const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,columnWidths:widths,values});
 t.borders.assign({style:'solid',fill:'#bdb1a6',width:1});
 for(let r=0;r<values.length;r++)for(let c=0;c<values[0].length;c++){
  const cell=t.getCell(r,c);cell.fill=r===0?C.ink:(r%2?C.paper:C.cream);
  cell.text.style={fontFamily:'Arial',fontSize:size+'pt',bold:r===0,color:r===0?C.paper:C.ink};
 }
 return t;
}
function box(s,label,x,y,w,h,fill=C.blue,geometry='roundRect'){
 const a=s.shapes.add({geometry,position:{left:x,top:y,width:w,height:h},fill,line:{fill:C.ink,width:2}});
 a.text=label;a.text.style={fontFamily:'Arial',fontSize:'18pt',bold:true,color:C.ink,alignment:'center',verticalAlignment:'middle'};a.text.insets=10;return a;
}
function connect(s,a,b,from='right',to='left',arrow=true){return s.shapes.connect(a,b,{kind:'elbow',fromSide:from,toSide:to,line:{fill:C.ink,width:2},tail:arrow?{type:'triangle',width:'med',length:'med'}:{type:'none'}});}
function actor(s,label,x,y){
 const head=s.shapes.add({geometry:'ellipse',position:{left:x+40,top:y,width:40,height:40},fill:'none',line:{fill:C.ink,width:2}});
 const spine=s.shapes.add({geometry:'line',position:{left:x+60,top:y+40,width:0,height:65},line:{fill:C.ink,width:2}});
 for(const [l,t,w,h,flip] of [[x+20,y+58,80,0,false],[x+25,y+105,35,42,true],[x+60,y+105,35,42,false]])s.shapes.add({geometry:'line',position:{left:l,top:t,width:w,height:h,horizontalFlip:flip},line:{fill:C.ink,width:2}});
 text(s,label,x-20,y+165,160,70,18,true,C.ink,'center');return spine;
}

export async function cover({presentation:p}){
 if(p.slides.items.length===2&&p.slides.getItem(0).shapes.items.length===0)p.slides.delete(0);
 const s=p.slides.getItem(0);
 const a=p.resolve('sh/3e58za9k');a.position={left:72,top:195,width:620,height:110};
 const sub=p.resolve('sh/2dw765sz');sub.text='Ground Obstacle\nAlert Prototype';sub.position={left:76,top:325,width:620,height:130};
 const note=p.resolve('sh/pgnq10rq');note.position={left:76,top:576,width:610,height:74};note.text='Final-year project\n21 November 2026';
 s.images.add({path:ROOT+'/presentation-site/public/samples/stairs-down.jpg',alt:'Supplied development image looking down a staircase',fit:'cover',position:{left:770,top:0,width:510,height:720}});
 notes(s,'PathSignal is a prototype for spoken obstacle awareness, intended to supplement existing mobility tools. This presentation covers the problem, aim, requirements, design and selected technology. Photograph: original user-supplied development recording; it is not evidence of independent walking performance.');
 return {slides:p.slides.items.length};
}
export async function batch({presentation:p,input}){
 for(const number of input.slides){
  if(p.slides.items.length!==number-1)throw Error('Unexpected slide count before '+number);
  let s;
  if(number===2){
   s=base(p,'Problem statement',2);
   text(s,'Objects and stair edges can be difficult to notice without reliable visual information.',72,168,670,170,30,true);
   text(s,'Intended users\nBlind and low-vision travellers.',72,370,640,82,22);
   text(s,'Prototype question\nCan a phone snapshot provide an additional spoken warning about a supported obstacle ahead?',72,488,665,125,22);
   s.images.add({path:ROOT+'/presentation-site/public/samples/bottle.jpg',alt:'Black bottle on the supplied test floor',fit:'contain',position:{left:810,top:170,width:390,height:405}});
   text(s,'Supplied bottle test image',812,594,388,36,14,false,C.muted);
   notes(s,'A small object or change in level can matter to a traveller who cannot rely on visual inspection. The project explores an extra spoken cue; it does not establish prevention of trips or injuries. Current camera testing is stationary and uses supported classes. Local need has not been quantified through a representative user study. WHO discusses functional and mobility impacts of vision impairment.',[REF.who]);
  }
  if(number===3){
   s=base(p,'Evidence supporting the need',3,C.blue);
   text(s,'2.2 billion',72,185,700,130,64,true);
   text(s,'people globally have near or distance\nvision impairment (WHO, 2026).',76,326,940,94,26);
   text(s,'Mobility impact',76,460,290,42,23,true);
   text(s,'WHO links vision impairment in older adults to difficulty walking and increased fall risk.',400,454,780,100,22);
   text(s,'This motivates research. It does not show that PathSignal reduces falls.',76,598,1110,48,20,true);
   notes(s,'The WHO population figure includes near and distance vision impairment, not only blindness and not the number of potential app users. WHO identifies mobility and falls impacts particularly among older adults. Existing assistive products also establish an active area of need, but neither their existence nor the statistic validates this prototype. No local accident survey or blind-user usability study has been completed for PathSignal.',[REF.who,REF.lazarillo,REF.wewalk]);
  }
  if(number===4){
   s=base(p,'How people handled the problem before',4);
   table(s,[['Approach','Role in mobility'],['Canes, guide dogs and sighted guidance','Established mobility support and environmental awareness.'],['Lazarillo','Audible wayfinding, nearby places and route guidance.'],['WeWALK','Smart-cane sensing with app-based mobility features.'],['PathSignal’s proposed contribution','An additional camera-based spoken cue for selected visible objects and stair regions.']],72,176,1136,382,[400,736],20);
   text(s,'Existing aids remain important. PathSignal supplements them.',72,598,1120,42,23,true);
   notes(s,'RNIB describes canes, guide dogs and guiding support. Lazarillo describes audible nearby-place and route information. WeWALK’s manual describes its cane/app features and states that obstacle detection does not replace white-cane skills. This is a comparison of roles, not a claim that competitors lack particular capabilities or that PathSignal performs better. Clew3D was an early inspiration but was not inspected sufficiently for a technical feature comparison.',[REF.rnib,REF.lazarillo,REF.wewalk]);
  }
  if(number===5){
   s=base(p,'Project aim',5,C.teal);
   text(s,'To develop and assess a phone-based prototype that gives spoken warnings about supported objects and stair regions in a camera image.',76,185,1100,255,36,true);
   text(s,'Implementation objective',76,488,420,42,22,true);
   text(s,'Make local camera inference usable through accessible controls and brief audio alerts.',548,482,650,86,22);
   text(s,'Assessment objective',76,598,420,42,22,true);
   text(s,'Measure detections, misses, unwanted alerts and warning delay under defined conditions.',548,586,650,90,22);
   notes(s,'This aim is aligned with the original Ground Obstacle Alert Prototype problem. Earlier warning is an assessment goal, not a demonstrated outcome. The current contribution is software integration and interaction: pretrained detectors, preprocessing, image-space filtering, encounter handling, spoken alerts and observable test records. Distance and independent travel remain outside the validated scope.');
  }
  if(number===6){
   s=base(p,'Functional requirements',6);
   table(s,[['ID','The system must…','Current scope'],['FR1','Start/stop the rear camera and capture snapshots.','Browser + Expo'],['FR2','Select object detection or experimental stairs.','Browser + Expo'],['FR3','Run local inference and filter the image corridor.','Browser + Expo'],['FR4','Speak alerts; provide Test audio and Repeat.','Browser + Expo'],['FR5','Suppress repeated encounters; pause on failures.','Implemented; tested on desktop'],['FR6','Record scans and export session evidence.','Browser log/export; phone counters']],72,170,1136,444,[80,720,336],18);
   notes(s,'Implementation sources: phone/App.tsx, phone/useObjectWorker.tsx, phone/worker/detector.ts, presentation-site/src/useMonitor.ts and useDetector.ts. Both apps scan snapshots and offer separate modes. Repeated scans re-arm a class after two scans without it. Browser logging includes timestamps, source, model, duration and whether speech was requested, with CSV/JSON export. The phone currently shows session counters; do not imply it has the same export log. Camera/model failure states request a pause announcement. Desktop tests do not establish all physical iPhone behaviors.');
  }
  if(number===7){
   s=base(p,'Non-functional requirements',7);
   const rows=[['Security & privacy','Process images locally; request camera permission; keep API keys out of the shipped app.','Implemented design'],['Usability','Label controls for screen readers; use clear states, large controls and short alerts.','VoiceOver review pending'],['Performance','Keep inference off the main UI; measure scan duration and physical alert delay.','iPhone latency target/testing pending'],['Reliability','Handle failures explicitly; suppress repeat alerts; prevent stale scan results.','Desktop checks pass; field testing pending']];
   rows.forEach((r,i)=>{const y=177+i*112;text(s,r[0],72,y,245,70,22,true);text(s,r[1],342,y,510,96,20);text(s,r[2],903,y,300,88,19,false,C.muted);});
   notes(s,'Security scope: application code does not upload camera pixels; normal hosting requests still reach Vercel, and browser font stylesheets may load externally. HTTPS protects browser delivery and enables camera access; an initial model/runtime download is required and offline browser use is not guaranteed. Usability controls and selected/disabled semantics exist, but a formal VoiceOver/user study remains pending. No acceptable end-to-end warning-latency threshold has been agreed, so this slide does not claim one. Reliability refers to implemented handling and desktop checks, not a measured real-world hazard recall rate.');
  }
  if(number===8){
   s=base(p,'System architecture',8);
   text(s,'Camera pixels stay on the device',72,145,1100,40,22,true);
   const a=box(s,'Rear-camera\nsnapshot',75,240,205,110,C.blue);
   const b=box(s,'Local inference\nYOLOX-S or\nYOLOv8n stairs',365,240,260,130,C.pink);
   const c=box(s,'Score + box\nfiltering\nImage corridor',715,240,230,130,C.orange);
   const d=box(s,'Encounter logic\nSpoken warning',1020,240,205,130,C.teal);
   connect(s,a,b);connect(s,b,c);connect(s,c,d);
   const e=box(s,'Browser: local\nscan log + export',976,475,250,100,C.paper);connect(s,d,e,'bottom','top');
   text(s,'Browser: dedicated WASM worker\nExpo: embedded WebView + WASM',364,423,565,90,22);
   text(s,'Delivery: Vercel serves the web app and model files; Expo serves the phone bundle during development.',75,592,1130,70,20);
   notes(s,'Architecture is a simplified logical view of the current shipped applications. The selected model alone loads for a mode. YOLOX-S retains 25 COCO object labels; the separate YOLOv8n model has one stairs class. The browser uses a Web Worker; Expo uses a hidden react-native-webview processing view. Local preprocessing/decoding, filtering and encounter logic precede audio. Browser localStorage holds up to 200 scan records and exports on request; Expo currently shows counters. Hosting delivers static assets, not a server-side camera-inference API. Diagram objects and connectors are editable.');
  }
  if(number===9){
   s=base(p,'Use-case diagram',9);
   s.shapes.add({geometry:'rect',position:{left:320,top:146,width:650,height:485},fill:'none',line:{fill:C.ink,width:2}});
   text(s,'PathSignal prototype',345,158,590,40,22,true,C.ink,'center');
   const traveller=actor(s,'Traveller /\noperator',94,276);
   const evaluator=actor(s,'Examiner /\nevaluator',1065,372);
   const cases=[['Select object / stair mode',214,C.blue],['Start or stop camera',295,C.blue],['Scan and receive alert',376,C.orange],['Repeat alert / test audio',457,C.teal],['Review / export scan log',538,C.pink]];
   const anchor=s.shapes.add({geometry:'rect',position:{left:1125,top:440,width:1,height:2},fill:'none',line:{fill:'none',width:0}});
   cases.forEach(([label,y,color],i)=>{const e=box(s,label,410,y,470,64,color,'ellipse');if(i<4)connect(s,traveller,e,'right','left',false);else connect(s,e,anchor,'right','left',false);});
   text(s,'Log export is available in the browser application.',400,650,700,30,17,false,C.muted);
   notes(s,'These are intended use cases, not evidence of completed blind-user trials. The current supervised/stationary demonstration can be run by a sighted operator. The primary actor selects a mode, controls capture and receives/repeats audio. The evaluator reviews browser scan evidence and exports it. Plain UML associations do not represent data flow. Runtime permission and availability checks are internal to the capture/scan use cases. The system boundary and use cases remain native editable slide objects.');
  }
  if(number===10){
   s=base(p,'Interface and delivery tools',10);
   table(s,[['Tool','Why it was selected'],['React Native + Expo Go','Phone testing on the existing iPhone without a custom signed iOS build.'],['React + TypeScript','A shareable web interface and typed application/data flow.'],['Expo Camera + Audio / Web APIs','Camera capture, spoken alerts and accessible interaction.'],['Vercel','HTTPS hosting and a public presentation link for examiners.'],['Git + GitHub','Version history, source review and tracking changes.']],72,173,1136,420,[370,766],20);
   notes(s,'Current code uses Expo SDK 58, expo-camera, expo-image-manipulator and expo-audio. The browser uses getUserMedia, canvas and Web Speech; this does not imply that every browser offers identical speech behavior. Expo Go avoids a paid custom iOS build for the supported camera/WASM prototype; native LiDAR is a different signed-build path and is not active in Expo Go. TypeScript checks, local builds, browser automation and Git history support reproducibility. Vercel hosts static assets and does not process camera images in a backend.',[REF.expo,REF.ort]);
  }
  if(number===11){
   s=base(p,'AI and machine learning tools',11,C.blue);
   text(s,'Pretrained models',72,167,1120,52,28,true);
   table(s,[['Component','Role in PathSignal'],['YOLOX-S / COCO','Recognise 25 selected everyday object classes.'],['YOLOv8n stairs','Detect one generic stairs class in experimental mode.'],['ONNX Runtime Web / WASM','Run the models locally in browser and Expo processing views.'],['NumPy + ONNX Runtime + Playwright','Compare saved frames and check the actual deployed inference paths.']],72,240,1136,310,[435,701],19);
   text(s,'Project contribution: preprocessing, filtering, encounter handling, audio and evaluation.',72,582,1135,72,22,true);
   notes(s,'The student/project did not train these neural networks. YOLOX-S is a publisher COCO checkpoint; only selected labels are enabled. The Roboflow artifact obstacle-detection-n3eec/1 contains one stairs class despite the broader project overview. No Kaggle fine-tuning or LLM is part of the current app. Kaggle and Roboflow supported dataset/model research; the current stair weights came from Roboflow. Roboflow keys were used only by a local access/download tool and are absent from shipped apps. The downloaded stair artifact identifies Ultralytics 8.2.0 and AGPL-3.0; the project publishes application source and licence notices.',[REF.yolox,REF.stairs,REF.ort,'https://pathsignal-six.vercel.app/source.html']);
  }
  if(number===12){
   s=base(p,'Current evidence',12);
   text(s,'User-reported phone examples',72,158,1100,45,25,true);
   text(s,'Chairs, laptops, keyboards and monitors detected.\nTrial counts and conditions were not recorded.',72,215,1110,85,23);
   text(s,'Recorded stair development check',72,344,1100,45,25,true);
   table(s,[['Existing clip frames','Stair alerts'],['Facing upstairs','3 / 3'],['Looking downstairs','3 / 3'],['Other supplied frames','0 / 18']],72,405,1136,190,[800,336],20);
   text(s,'Three frames per clip are correlated; these counts are not an accuracy estimate.',72,624,1125,44,19,true);
   notes(s,'The latest user report in this conversation states that prototype testing on chairs, laptops, keyboards and monitors passed. There is no recorded denominator, lighting protocol or independent ground truth, so no recognition percentage is inferred. Stair counts come from model-comparison/evaluation/comparison.json and the actual Chromium WASM worker check in presentation-site/verification/stair-yolov8n-development-frames.json. The six stair frames come from two clips; the other 18 come from six clips. Physical iPhone stair camera/audio checks remain unreported. There is no box-annotation benchmark or warning-distance result.');
  }
  if(number===13){
   s=base(p,'Prototype scope and next assessment',13,C.pink);
   text(s,'Working software',72,173,340,45,26,true);
   text(s,'Local object/stair inference, short alerts,\nrepeat handling and a public web demonstration.',456,170,740,112,24);
   text(s,'Still unfinished',72,331,340,45,26,true);
   text(s,'Holes, metric distance, overhead hazards\nand reliable stair-direction recognition.',456,326,740,112,24);
   text(s,'Next assessment',72,489,340,45,26,true);
   text(s,'Fresh controlled trials, measured alert delay,\nmisses, unwanted alerts and accessibility review.',456,484,740,112,24);
   text(s,'Live demonstration: pathsignal-six.vercel.app',72,635,1136,36,20,true);
   notes(s,'The prototype supplements existing mobility tools. Silence gives no information about path clearance. Independent walking is not validated. An iPhone 15 Pro LiDAR scanner exists on the user device, but the current Expo Go/browser application does not expose a validated LiDAR distance feature. Future assessment must use fresh scenes, define conditions and thresholds, measure audible delay and failures, and keep development clips out of held-out results. These are next steps, not completed outcomes. Demo: https://pathsignal-six.vercel.app');
  }
  if(number===14){
   s=base(p,'References',14);
   const refs=[['WHO','Blindness and vision impairment',REF.who],['RNIB','How people with sight loss get around',REF.rnib],['Lazarillo','Accessible navigation app',REF.lazarillo],['WeWALK','Smart Cane 2 user manual',REF.wewalk],['YOLOX','Publisher model and source',REF.yolox],['Roboflow Universe','Downloaded stair model project',REF.stairs],['Expo','Phone development workflow',REF.expo],['ONNX Runtime','Browser inference documentation',REF.ort]];
   refs.forEach(([name,desc,url],i)=>{const x=i<4?72:684,y=173+(i%4)*107;const a=text(s,name,x,y,510,35,23,true);a.hyperlink={uri:url,isExternal:true};text(s,desc,x,y+42,510,52,19);});
   text(s,'Project evidence: source code, development-frame records and user reports, 21 November 2026.',72,634,1136,50,17,false,C.muted);
   notes(s,'Full reference URLs are attached to the corresponding labels and listed here. All accessed 21 November 2026. Original project image rights: supplied by the user for this project. Local evidence records: presentation-site/verification/stair-integration-release.md; stair-yolov8n-development-frames.json; model-comparison/evaluation/RESULTS.md. The public source/attribution offer is https://pathsignal-six.vercel.app/source.html .',Object.values(REF));
  }
 }
 return {slides:p.slides.items.length};
}
