/* MECHA WAR — Forge v2 shared JS (wallet, buy-fix, i18n, chrome).
   Ethers 6.13.2 UMD is loaded by each page before this file.
   v2 contracts DEPLOYED 2026-11-17 (see ADDRESSES.md). */

/* ---- contract addresses (deployed 2026-11-17) ---- */
const CONTRACT  = "0x94bd501F3D2bB5eF205a63c74D7995916830bc96"; // MechaWar v2 NFT — DEPLOYED 2026-11-17, block 134079356
const MARKET    = "0xD508dD38D053349eB8b30f3eC3D2a1E883D30E09"; // MechaWar v2 Market — DEPLOYED 2026-11-17, block 134079366
const CLAIM     = "0xaE76139055D83B652Bc16E381c23885F7781b085"; // MechaWar v2 Claim — DEPLOYED 2026-11-17, block 134079376
const MECH_TOKEN = "0x8C6e27040b3B384cbD02566C24Fc9aC757AD9AcA"; // $MECH token — REUSED from v1, verified on-chain (see ADDRESSES.md)
const DEPLOY_BLOCK = 134079356; // v2 NFT deploy block (claim/forge scan start)
const ZERO = "0x0000000000000000000000000000000000000000";
const IS_PLACEHOLDER = CONTRACT === ZERO; // true until v2 is deployed
const MAX_SUPPLY = 7777;
const MECH_TO_OWNER = 22230000n * 10n**18n; // $MECH minted to owner in v1 constructor
const OWNER_ADDR = "0xf5C6EE4d1b236CCbBC1F950255Ea2dEb0A09d77A"; // baw — claim fees go here

const RPCS = ["https://bsc-dataseed.bnbchain.org","https://bsc-dataseed1.binance.org","https://rpc-bsc.48.club"];
/* selectors (same signatures as the working v1 / Abyssora v3 contracts) */
const SEL_TOTAL = "0xa2309ff8", SEL_PRICEFOR = "0xd527979a"; /* totalMinted(), priceFor(address,uint256) */
const SEL_FORGECOUNT = "0xa40283d5", SEL_FORGEFEE = "0x1c1c0bda"; /* forgeCount(), forgeFee() */
const SEL_TIEROF = "0x53f96df2", SEL_MINTPAUSED = "0x7e4831d3"; /* tierOf(uint256), mintPaused() */
const SEL_BALANCEOF = "0x70a08231", SEL_ALLOWANCE = "0xdd62ed3e";
const SEL_LISTED = "0x05337198", SEL_LISTING = "0x107a274a"; /* getListedIds(), getListing(uint256) */
const SEL_OWNEROF = "0x6352211e", SEL_TOKENURI = "0xc87b56dd", SEL_ISAPPROVED = "0xe985e9c5";
const SEL_CLAIMED = "0xdbe7e3bd", SEL_FEEPERNFT = "0x6256cbc6", SEL_TOTALSUPPLY = "0x18160ddd";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

let provider = null, signer = null, userAddr = null;
let LANG = "en";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- the six tiers (names stay English in every language) ---- */
const TIERS = [
  {name:"Scout",    rarity:"Common",    cap:3889, img:"images/scout.webp",    color:"#c8d2cc"},
  {name:"Vanguard", rarity:"Uncommon",  cap:1944, img:"images/vanguard.webp", color:"#7ddf8e"},
  {name:"Titan",    rarity:"Rare",      cap:1167, img:"images/titan.webp",    color:"#35e0c8"},
  {name:"Warlord",  rarity:"Epic",      cap:544,  img:"images/warlord.webp",  color:"#b388ff"},
  {name:"Prime",    rarity:"Legendary", cap:194,  img:"images/prime.webp",    color:"#ffb020"},
  {name:"Omega",    rarity:"Mythic",    cap:39,   img:"images/omega.webp",    color:"#3dff8e"}
];

async function rpcCall(to, data){
  for(const url of RPCS){
    try{
      const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_call",params:[{to,data},"latest"]})});
      const j = await r.json(); if(j.result) return j.result;
    }catch(e){}
  }
  return null;
}
async function rpcGasPrice(){
  for(const url of RPCS){
    try{
      const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_gasPrice",params:[]})});
      const j = await r.json(); if(j.result) return BigInt(j.result);
    }catch(e){}
  }
  return 1000000000n;
}
/* BUY FIX: explicit gasPrice from the site's own RPCs + explicit gas limit.
   Never let the buyer wallet's provider return null fee data. */
async function sendTx(tx, gasLimit){
  const gp = await rpcGasPrice();
  return signer.sendTransaction({...tx, gasPrice: gp, gasLimit: BigInt(gasLimit)});
}
function txErrMsg(e){
  const m = (e && e.message) || String(e || "");
  if(m.indexOf("invalid BigNumberish") >= 0 || m.indexOf("value=null") >= 0) return STR[LANG].txWalletFee;
  return (e && e.reason) || m;
}
function shortAddr(a){ return a.slice(0,6) + "…" + a.slice(-4); }
function fmtBnb(wei){ return (Number(wei) / 1e18).toFixed(5).replace(/\.?0+$/,"") || "0"; }

/* ---- i18n: dynamic strings (static copy uses data-en/ja/zh/ko attrs) ---- */
const STR = {
en:{loading:"Loading live count…",noCount:"Could not load live count — check your connection and refresh.",
  comingSoon:"Contracts deploying — mint opens soon.",
  minted:(n,p)=>n+" of 7,777 minted ("+p+"%)",
  total:(q,t,f)=>"Total for "+q+": "+t+" BNB"+(f?" — FREE":""),
  txWalletFee:"Your wallet could not prepare this transaction (empty answer from the browser). Open this site inside your wallet app browser (MetaMask / Trust Wallet / Binance Wallet) and try again.",
  noWallet:"No browser wallet detected. Open this site inside your wallet app browser (MetaMask / Trust Wallet / Binance Wallet).",
  connected:"Connected. Your price is based on how many you have minted before.",
  connectFailed:"Connect failed: ",
  forgeFree:"FREE — gas only",
  forgeBurn:"1,000 $MECH burned"},
ja:{loading:"ライブカウントを読み込み中…",noCount:"ライブカウントを読み込めませんでした — 接続を確認して更新してください。",
  comingSoon:"コントラクトをデプロイ中 — ミントは近日開始。",
  minted:(n,p)=>"7,777体中"+n+"体ミント済み（"+p+"%）",
  total:(q,t,f)=>"合計（"+q+"体）: "+t+" BNB"+(f?" — 無料":""),
  txWalletFee:"ウォレットがこの取引を準備できませんでした（ブラウザからの応答が空でした）。MetaMask / Trust Wallet / Binance Wallet のアプリ内ブラウザでこのサイトを開いて、もう一度お試しください。",
  noWallet:"ブラウザウォレットが見つかりません。MetaMask / Trust Wallet / Binance Wallet のアプリ内ブラウザでこのサイトを開いてください。",
  connected:"接続しました。価格はあなたのミント回数で決まります。",
  connectFailed:"接続に失敗しました: ",
  forgeFree:"無料 — ガスのみ",
  forgeBurn:"1,000 $MECH バーン"},
zh:{loading:"正在加载实时数量…",noCount:"无法加载实时数量——请检查网络并刷新。",
  comingSoon:"合约部署中——铸造即将开始。",
  minted:(n,p)=>"已铸造 "+n+" / 7,777（"+p+"%）",
  total:(q,t,f)=>"总价（"+q+"台）: "+t+" BNB"+(f?"——免费":""),
  txWalletFee:"您的钱包无法准备这笔交易（浏览器返回为空）。请在钱包应用内浏览器（MetaMask / Trust Wallet / Binance Wallet）中打开本网站，然后重试。",
  noWallet:"未检测到浏览器钱包。请在钱包应用内浏览器（MetaMask / Trust Wallet / Binance Wallet）中打开本网站。",
  connected:"已连接。价格按你之前的铸造次数计算。",
  connectFailed:"连接失败：",
  forgeFree:"免费——仅需 gas",
  forgeBurn:"燃烧 1,000 $MECH"},
ko:{loading:"실시간 수량 불러오는 중…",noCount:"실시간 수량을 불러올 수 없습니다 — 연결을 확인하고 새로고침하세요.",
  comingSoon:"컨트랙트 배포 중 — 민팅 곧 시작.",
  minted:(n,p)=>"7,777대 중 "+n+"대 민팅됨 ("+p+"%)",
  total:(q,t,f)=>"총액（"+q+"대）: "+t+" BNB"+(f?" — 무료":""),
  txWalletFee:"지갑이 이 거래를 준비하지 못했습니다(브라우저의 응답이 비어 있습니다). MetaMask / Trust Wallet / Binance Wallet 앱 내 브라우저에서 이 사이트를 열고 다시 시도해 주세요.",
  noWallet:"브라우저 지갑이 없습니다. MetaMask / Trust Wallet / Binance Wallet 앱 내 브라우저에서 이 사이트를 여세요.",
  connected:"연결됨. 가격은 이전 민팅 횟수를 따릅니다.",
  connectFailed:"연결 실패: ",
  forgeFree:"무료 — 가스만",
  forgeBurn:"1,000 $MECH 소각"}
};

function setLang(l){
  LANG = l;
  try{ localStorage.setItem("mechawar-v2-lang", l); }catch(e){}
  document.documentElement.lang = l === "zh" ? "zh-CN" : l;
  document.querySelectorAll("[data-lang]").forEach(b=>{ b.classList.toggle("on", b.dataset.lang === l); });
  document.querySelectorAll("[data-en]").forEach(el=>{
    if(el.id === "connectBtn" && userAddr) return;
    const v = el.dataset[l]; if(v !== undefined) el.textContent = v;
  });
  document.querySelectorAll("[data-en-html]").forEach(el=>{
    const v = el.dataset[l+"Html"]; if(v !== undefined) el.innerHTML = v;
  });
  if(typeof refresh === "function") refresh();
}
function initLang(){
  const saved = (function(){ try{ return localStorage.getItem("mechawar-v2-lang") || ""; }catch(e){ return ""; } })();
  const nav = (navigator.language || "en").slice(0,2);
  setLang(saved || (nav === "ja" ? "ja" : nav === "zh" ? "zh" : nav === "ko" ? "ko" : "en"));
}

/* ---- wallet ---- */
async function connectWallet(){
  const msgEl = document.getElementById("mintMsg") || document.getElementById("pageMsg");
  if(!window.ethereum){
    if(msgEl){ msgEl.className = "warn"; msgEl.textContent = STR[LANG].noWallet; }
    return false;
  }
  try{
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const net = await provider.getNetwork();
    if(net.chainId !== 56n){ await window.ethereum.request({method:"wallet_switchEthereumChain", params:[{chainId:"0x38"}]}); }
    signer = await provider.getSigner(); userAddr = await signer.getAddress();
    const btn = document.getElementById("connectBtn");
    if(btn) btn.textContent = "CONNECTED: " + userAddr.slice(0,6) + "…" + userAddr.slice(-4);
    if(msgEl){ msgEl.className = ""; msgEl.textContent = STR[LANG].connected; }
    if(typeof updateCost === "function") updateCost();
    if(typeof onConnect === "function") onConnect();
    return true;
  }catch(e){
    if(msgEl) msgEl.textContent = STR[LANG].connectFailed + (e.message || e);
    return false;
  }
}

/* ---- chrome: reveals, sticky CTA, burger menu, to-top ---- */
function initChrome(){
  const reveals = document.querySelectorAll(".reveal");
  if(REDUCED_MOTION || !("IntersectionObserver" in window)){
    reveals.forEach(el=>el.classList.add("on"));
  } else {
    const io = new IntersectionObserver((es,o)=>{ es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("on"); o.unobserve(e.target); } }); },
      {threshold:0.12, rootMargin:"0px 0px -6% 0px"});
    reveals.forEach(el=>io.observe(el));
  }
  const top = document.getElementById("toTop");
  window.addEventListener("scroll", ()=>{
    if(top) top.classList.toggle("show", window.scrollY > 700);
    const cta = document.getElementById("mobileCta");
    if(cta) cta.classList.toggle("show", window.scrollY > 560);
  }, {passive:true});
  if(top) top.addEventListener("click", ()=>window.scrollTo({top:0, behavior: REDUCED_MOTION ? "auto" : "smooth"}));
  const mm = document.getElementById("mobileMenu");
  if(mm){
    mm.querySelectorAll("a").forEach(a=>a.addEventListener("click", ()=>mm.classList.remove("open")));
    document.addEventListener("keydown", e=>{ if(e.key === "Escape") mm.classList.remove("open"); });
  }
}
function toggleMenu(){
  const m = document.getElementById("mobileMenu"); if(m) m.classList.toggle("open");
}
var lastCount = null;
function countUp(el, to){
  if(!el) return;
  if(REDUCED_MOTION){ el.textContent = to; lastCount = to; return; }
  if(lastCount === null){ el.textContent = to; lastCount = to; return; }
  const from = lastCount; lastCount = to;
  if(from === to){ el.textContent = to; return; }
  const t0 = performance.now();
  function step(ts){
    const k = Math.min(1, (ts - t0) / 700);
    el.textContent = Math.round(from + (to - from) * k);
    if(k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
/* scan owned tokens via Transfer logs from the deploy block (shared by forge + claim) */
async function scanOwnedIds(){
  const rp = new ethers.JsonRpcProvider(RPCS[0]);
  const padded = "0x" + userAddr.slice(2).padStart(64, "0");
  const found = new Set();
  const latest = await rp.getBlockNumber();
  for(let from = DEPLOY_BLOCK; from <= latest; from += 10000){
    const to = Math.min(from + 9999, latest);
    let logs;
    try{ logs = await rp.getLogs({address:CONTRACT, fromBlock:from, toBlock:to, topics:[TRANSFER_TOPIC, null, padded]}); }
    catch(e){ const rp2 = new ethers.JsonRpcProvider(RPCS[1]); logs = await rp2.getLogs({address:CONTRACT, fromBlock:from, toBlock:to, topics:[TRANSFER_TOPIC, null, padded]}); }
    logs.forEach(l=>found.add(BigInt(l.topics[3]).toString()));
  }
  const owned = [];
  for(const id of found){
    const ores = await rpcCall(CONTRACT, SEL_OWNEROF + BigInt(id).toString(16).padStart(64,"0"));
    if(!ores) continue;
    const owner = ethers.AbiCoder.defaultAbiCoder().decode(["address"], ores)[0];
    if(owner.toLowerCase() !== userAddr.toLowerCase()) continue;
    const tres = await rpcCall(CONTRACT, SEL_TIEROF + BigInt(id).toString(16).padStart(64,"0"));
    const tier = tres ? Number(ethers.AbiCoder.defaultAbiCoder().decode(["uint8"], tres)[0]) : 0;
    owned.push({id:Number(id), tier});
  }
  owned.sort((a,b)=>a.id-b.id);
  return owned;
}
