"use strict";
const $=id=>document.getElementById(id);
let current=null,variant=0;
function status(s){$("status").textContent=s}
function parseUrl(value){
  let u;try{u=new URL(value.trim())}catch{throw Error("네이버 블로그 게시글 주소를 입력해 주세요.")}
  if(u.protocol!=="https:"||!["blog.naver.com","m.blog.naver.com"].includes(u.hostname))throw Error("네이버 블로그 주소만 지원합니다.");
  let m=u.pathname.match(/^\/([^/]+)\/(\d+)\/?$/), id,log;
  if(m){id=m[1];log=m[2]}else if(/^\/PostView\.naver$/i.test(u.pathname)){id=u.searchParams.get("blogId");log=u.searchParams.get("logNo")}
  if(!id||!log||!/^[\w-]{2,80}$/.test(id)||!/^\d{5,30}$/.test(log))throw Error("게시글 번호가 포함된 주소를 입력해 주세요.");
  return {url:"https://m.blog.naver.com/"+encodeURIComponent(id)+"/"+log,origin:"https://blog.naver.com/"+encodeURIComponent(id)+"/"+log};
}
function clean(s){return (s||"").replace(/\u00a0/g," ").replace(/[ \t]+/g," ").replace(/\n[\s\n]+/g,"\n").trim()}
function textFrom(doc){
  let title=clean(doc.querySelector('meta[property="og:title"]')?.content||doc.querySelector(".se-title-text")?.textContent||doc.title||"");
  let nodes=[...doc.querySelectorAll(".se-main-container, .se_doc_viewer, #postViewArea, #viewTypeSelector, .se3_view, .post-view, .se_component_wrap")];
  // Parent/child nodes overlap: prefer the first complete document container.
  let chosen=nodes.find(n=>clean(n.innerText||n.textContent).length>80);
  let body="";
  if(chosen){
    const clone=chosen.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,button,nav,footer,header,.se-oglink,.se-module-image,.se-module-video").forEach(n=>n.remove());
    body=clean(clone.textContent);
  }
  if(body.length<40){
    let paras=[...doc.querySelectorAll(".se-text-paragraph,.se_paragraph,.se-module-text,.se_textarea,p")].map(n=>clean(n.textContent)).filter(s=>s.length>5);
    body=clean([...new Set(paras)].join("\n"));
  }
  const description=clean(doc.querySelector('meta[property="og:description"]')?.content||doc.querySelector('meta[name="description"]')?.content||"");
  if(body.length<40&&description.length>=30)body=description;
// 네이버 로그인/오류 화면은 게시글 본문으로 처리하지 않습니다.
const pageTitle=clean(doc.title||"");
if(/로그인|존재하지 않는|접근이 제한|권한이 없|삭제된 게시글/.test(pageTitle)&&body.length<100)body="";

  return {title,body:body.slice(0,12000)};
}
const rules=[
  {pattern:/캠핑장|사이트|데크|파쇄석|텐트|캠핑|차박|피칭|타프/,phrases:["캠핑장 분위기가 잘 전해지네요","캠핑 장소 고를 때 참고하기 좋겠어요","캠핑 기록이 생생하게 느껴져요"]},
  {pattern:/맛집|음식|카페|커피|식당|빵|디저트|레시피/,phrases:["메뉴 소개가 알차네요","사진과 설명이 도움이 됐어요","맛집 선택할 때 참고하기 좋겠어요"]},
  {pattern:/여행|숙소|호텔|풍경|바다|산책|단풍|꽃|노을|일출/,phrases:["풍경 이야기가 인상적이네요","여행 분위기가 잘 전해져요","소개해주신 장소가 기억에 남아요"]},
  {pattern:/장비|제품|구매|사용기|리뷰|후기|비교/,phrases:["직접 써보신 이야기가 도움이 되네요","장단점이 잘 보여서 참고하기 좋아요","사용 후기가 구체적이네요"]},
  {pattern:/강아지|고양이|반려|냥이/,phrases:["일상이 따뜻하게 느껴지네요","즐거운 순간이 담겨 있네요","사진에서 귀여움이 전해져요"]}
];
function sentencesFromPost(text){
  const cleaned=(text||"").replace(/https?:\/\/\S+/g," ").replace(/[#@][\w가-힣]+/g," ").replace(/[\u200b-\u200d]/g," ").replace(/\s+/g," ").trim();
  return cleaned.split(/(?<=[.!?。])\s+|\s*[\n]+\s*/).flatMap(s=>s.length>85?s.split(/[,，;；]\s*/):[s]).map(s=>s.trim().replace(/^[\s•\-\d.)]+/,"")).filter(s=>s.length>=13&&s.length<=95);
}
function chooseDetails(post){
  const title=(post.title||"").replace(/\s*[|｜].*$/,"").replace(/\s*[:│].*$/,"").trim();
  const blacklist=/안녕하세요|방문해주셔서|잘 읽고|공감|서이추|댓글|이웃|협찬|광고|구매링크|수수료|제공받|도움이 되|포스팅|오늘은|알려드릴|소개해드릴|클릭|좋아요/;
  let arr=[...new Set(sentencesFromPost(post.body))].filter(s=>!blacklist.test(s));
  const tokens=[...new Set((title.match(/[가-힣A-Za-z0-9]{2,}/g)||[]).filter(w=>!/리뷰|후기|일상|기록|정보|블로그|추천|캠핑|가격|사용|방문/.test(w)))];
  const score=s=>{
    let n=0;
    if(/[0-9]+(?:cm|m|kg|원|분|시간|번|인|박|일|도|%)/i.test(s))n+=3;
    if(/생각보다|다만|아쉬|불편|좁|넓|좋았|편했|어려|편리|예쁘|만족|추천|특히|실제로|느꼈|차이|괜찮|의외|바람|풍경|경치|맛|향|조용|시끄럽|주차|설치|철수/.test(s))n+=3;
    n+=Math.min(4,tokens.filter(t=>s.includes(t)).length*2);
    if(s.length>=24&&s.length<=68)n+=2;
    if(/합니다|습니다|했어요|더라고요|더라구요|했는데|였어요|이었어요|좋아요|있어요|없어요/.test(s))n++;
    if(/문의|운영시간|주소|번호|전화|광고|예약|본 포스팅/.test(s))n-=5;
    return n;
  };
  arr.sort((a,b)=>score(b)-score(a));
  return arr.slice(0,5).filter(s=>score(s)>=2);
}
function detailToQuote(sentence){
  return sentence.replace(/^[\s"'‘“]+|[\s.!?'"’”]+$/g,"").replace(/\s+/g," ").slice(0,66);
}
function generate(){
  if(!current){status("먼저 게시글을 불러와 주세요.");return}
  const details=chooseDetails(current);
  if(!details.length){$("reply").value="";status("구체적인 내용을 추출하지 못했어요. 원문을 보고 직접 댓글을 작성해 주세요.");return}
  const detail=detailToQuote(details[variant%details.length]);
  const tone=$("tone").value;
  const styles=[
    "‘"+detail+"’라고 하신 부분이 특히 눈에 들어왔어요",
    "‘"+detail+"’라는 경험을 보니 현장 분위기가 더 잘 느껴지네요",
    "‘"+detail+"’라는 이야기가 기억에 남아요"
  ];
  const base=styles[Math.floor(variant/details.length)%styles.length];
  $("reply").value=tone==="short"?"‘"+detail+"’ 부분이 기억에 남네요!":tone==="plain"?base+".":base+"ㅎㅎ";
  status("본문의 구체적인 문장에 근거해 초안을 만들었어요. 인용 표현과 맥락이 자연스러운지 확인해 주세요.");
}

$("load").onclick=async()=>{const button=$("load");try{const u=parseUrl($("url").value);button.disabled=true;status("공개 게시글을 불러오는 중…");const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),12000);let response;try{response=await fetch(u.url,{signal:ctl.signal,credentials:"omit",redirect:"follow"})}finally{clearTimeout(t)}if(!response.ok)throw Error("네이버 응답 오류: "+response.status);let html=await response.text(),doc=new DOMParser().parseFromString(html,"text/html"),data=textFrom(doc);if(data.body.length<40)throw Error("본문을 확인하지 못했어요. 비공개 글이거나 네이버 페이지 구조가 다를 수 있습니다.");current={...u,...data};variant=0;$("title").textContent=data.title||"제목을 확인하지 못했어요.";$("excerpt").textContent=data.body.slice(0,210)+"…";generate();}catch(e){current=null;$("title").textContent="게시글을 불러오지 못했어요.";$("excerpt").textContent="";$("reply").value="";status(e.name==="AbortError"?"시간이 초과됐어요. 다시 시도해 주세요.":e.message||"불러오기 실패")}finally{button.disabled=false}};
$("open").onclick=()=>{try{chrome.tabs.create({url:parseUrl($("url").value).origin})}catch(e){status(e.message)}};
$("again").onclick=()=>{variant++;generate()};$("tone").onchange=()=>{if(current)generate()};
$("copy").onclick=async()=>{let v=$("reply").value.trim();if(!v){status("복사할 댓글이 없어요.");return}try{await navigator.clipboard.writeText(v);status("댓글을 복사했어요. 원문에서 직접 등록해 주세요.")}catch{status("복사에 실패했어요. 댓글을 선택해서 Ctrl+C로 복사해 주세요.")}};
async function renderHistory(){let {history=[]}=await chrome.storage.local.get("history");$("history").replaceChildren();if(!history.length){$("history").textContent="아직 기록이 없어요.";return}history.slice(0,5).forEach(x=>{let div=document.createElement("div");div.style.marginTop="10px";let a=document.createElement("a");a.textContent=x.title||x.url;a.href=x.url;a.target="_blank";let small=document.createElement("div");small.textContent=new Date(x.date).toLocaleDateString("ko-KR");div.append(a,small);$("history").append(div)})}
$("save").onclick=async()=>{if(!current||!$("reply").value.trim()){status("먼저 글을 불러오고 댓글을 작성해 주세요.");return}let {history=[]}=await chrome.storage.local.get("history");history=[{title:current.title,url:current.origin,reply:$("reply").value.trim(),date:new Date().toISOString()},...history.filter(x=>x.url!==current.origin)].slice(0,200);await chrome.storage.local.set({history});await renderHistory();status("답방 기록을 저장했어요. 댓글 게시 여부는 직접 확인해 주세요.")};
renderHistory();

/** 현재 탭과 각 iframe에서 현재 글 정보 조회. 네이버 화면의 URL 복사와 동일한 글번호를 찾기 위해 canonical, og:url, iframe 주소도 확인합니다. */
function inspectCurrentFrame(){
  const clean=s=>(s||"").replace(/\s+/g," ").trim();
  let urls=[location.href];
  for(const sel of ['link[rel="canonical"]','meta[property="og:url"]','meta[property="twitter:url"]']){
    let e=document.querySelector(sel);if(e)urls.push(e.href||e.content||"");
  }
  let frame=document.querySelector('iframe#mainFrame,iframe[name="mainFrame"]');if(frame?.src)urls.push(frame.src);
  const title=clean(document.querySelector('.se-title-text,.se_title,.pcol1 .htitle')?.textContent||document.querySelector('meta[property="og:title"]')?.content||document.title);
  let body="",max=0;
  for(let sel of [".se-main-container",".se_doc_viewer","#postViewArea","#viewTypeSelector",".se3_view",".post-view",".se_component_wrap"]){
    let node=document.querySelector(sel);if(!node)continue;
    let clone=node.cloneNode(true);clone.querySelectorAll("script,style,nav,footer,header,button,.se-oglink").forEach(n=>n.remove());
    let val=clean(clone.innerText||clone.textContent);
    if(val.length>max){max=val.length;body=val;}
  }
  if(body.length<40)body=clean([...document.querySelectorAll(".se-text-paragraph,.se_paragraph,.se-module-text,.se_textarea")].map(n=>n.textContent).join(" "));
  return {urls,title,body:body.slice(0,12000)};
}
function findPostUrl(urls){
  for(const value of urls){
    try{return parseUrl(value)}catch{}
  }
  return null;
}
async function readCurrentPost(){
  const button=$("auto");button.disabled=true;status("현재 열린 네이버 블로그 글을 확인하는 중…");
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!/^https:\/\/(?:m\.)?blog\.naver\.com\//.test(tab.url||""))throw Error("네이버 블로그 게시글을 먼저 열어주세요.");
    const frames=await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func:inspectCurrentFrame});
    const items=frames.map(x=>x.result).filter(Boolean);
    const candidates=items.flatMap(x=>x.urls||[]);
    // iframe은 대체로 실제 PostView.naver?blogId=...&logNo=... 주소를 포함합니다.
    const u=findPostUrl(candidates);
    if(!u)throw Error("실제 게시글 주소를 찾지 못했어요. 글 안의 ‘URL 복사’로 가져온 주소를 아래 칸에 붙여넣어 주세요.");
    $("url").value=u.origin;
    const best=items.filter(x=>x.body?.length>=40).sort((a,b)=>b.body.length-a.body.length)[0];
    if(best){
      current={...u,title:best.title||"게시글",body:best.body};variant=0;
      $("title").textContent=current.title;$("excerpt").textContent=current.body.slice(0,210)+"…";generate();
      status("현재 게시글 주소와 내용을 가져왔어요. 댓글 내용을 확인해 주세요.");
    }else{
      status("주소는 찾았지만 본문은 아직 읽지 못했어요. 공개 글 불러오기를 다시 시도해요.");
      await $("load").onclick();
    }
  }catch(e){status(e.message||"현재 게시글을 읽지 못했어요.");}
  finally{button.disabled=false}
}
$("auto").onclick=readCurrentPost;
readCurrentPost();
