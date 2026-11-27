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
function generate(){if(!current){status("먼저 게시글을 불러와 주세요.");return}let text=current.title+" "+current.body.slice(0,2500), selected=rules.find(r=>r.pattern.test(text));let phrases=selected?.phrases||["소개해주신 내용이 인상적이네요","읽으면서 새로운 정보를 알게 됐어요","정성스럽게 남겨주신 글 잘 봤어요"];let base=phrases[variant%phrases.length];$("reply").value=$("tone").value==="short"?base+"!":$("tone").value==="plain"?base+". 잘 읽었습니다.":base+"ㅎㅎ 잘 보고 갑니다!";status("글 내용에서 감지한 주제를 바탕으로 댓글을 제안했어요.")}
$("load").onclick=async()=>{const button=$("load");try{const u=parseUrl($("url").value);button.disabled=true;status("공개 게시글을 불러오는 중…");const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),12000);let response;try{response=await fetch(u.url,{signal:ctl.signal,credentials:"omit",redirect:"follow"})}finally{clearTimeout(t)}if(!response.ok)throw Error("네이버 응답 오류: "+response.status);let html=await response.text(),doc=new DOMParser().parseFromString(html,"text/html"),data=textFrom(doc);if(data.body.length<40)throw Error("본문을 확인하지 못했어요. 비공개 글이거나 네이버 페이지 구조가 다를 수 있습니다.");current={...u,...data};variant=0;$("title").textContent=data.title||"제목을 확인하지 못했어요.";$("excerpt").textContent=data.body.slice(0,210)+"…";generate();}catch(e){current=null;$("title").textContent="게시글을 불러오지 못했어요.";$("excerpt").textContent="";$("reply").value="";status(e.name==="AbortError"?"시간이 초과됐어요. 다시 시도해 주세요.":e.message||"불러오기 실패")}finally{button.disabled=false}};
$("open").onclick=()=>{try{chrome.tabs.create({url:parseUrl($("url").value).origin})}catch(e){status(e.message)}};
$("again").onclick=()=>{variant++;generate()};$("tone").onchange=()=>{if(current)generate()};
$("copy").onclick=async()=>{let v=$("reply").value.trim();if(!v){status("복사할 댓글이 없어요.");return}try{await navigator.clipboard.writeText(v);status("댓글을 복사했어요. 원문에서 직접 등록해 주세요.")}catch{status("복사에 실패했어요. 댓글을 선택해서 Ctrl+C로 복사해 주세요.")}};
async function renderHistory(){let {history=[]}=await chrome.storage.local.get("history");$("history").replaceChildren();if(!history.length){$("history").textContent="아직 기록이 없어요.";return}history.slice(0,5).forEach(x=>{let div=document.createElement("div");div.style.marginTop="10px";let a=document.createElement("a");a.textContent=x.title||x.url;a.href=x.url;a.target="_blank";let small=document.createElement("div");small.textContent=new Date(x.date).toLocaleDateString("ko-KR");div.append(a,small);$("history").append(div)})}
$("save").onclick=async()=>{if(!current||!$("reply").value.trim()){status("먼저 글을 불러오고 댓글을 작성해 주세요.");return}let {history=[]}=await chrome.storage.local.get("history");history=[{title:current.title,url:current.origin,reply:$("reply").value.trim(),date:new Date().toISOString()},...history.filter(x=>x.url!==current.origin)].slice(0,200);await chrome.storage.local.set({history});await renderHistory();status("답방 기록을 저장했어요. 댓글 게시 여부는 직접 확인해 주세요.")};
renderHistory();
