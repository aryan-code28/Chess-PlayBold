(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "chessPlayBold.accounts.v1";
  const SESSION_KEY = "chessPlayBold.session.v1";
  const THEMES = {
    "Black & White": {light:"#e8e8e8",dark:"#292929",selected:"#55a9d6",move:"#d4af37"},
    "Red & Cream": {light:"#f3e2c7",dark:"#8d3030",selected:"#f4a261",move:"#d4af37"},
    "Lavender & Purple": {light:"#d9c8ec",dark:"#4a2c61",selected:"#9b72cf",move:"#e7c95c"}
  };
  const PIECES = {w:{k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"},b:{k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"}};
  const VALUES = {p:100,n:320,b:330,r:500,q:900,k:20000};
  let currentUser = null, game = null, mode = "bot", selected = null, legalTargets = [], theme = "Black & White", soundEnabled = true, flipped = false, gameActive = false, lastMove = null, botTimer = null, audioCtx = null;
  const auth = $("auth-screen"), home = $("home-screen"), gameScreen = $("game-screen"), boardEl = $("chessboard");
  const readAccounts = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } };
  const saveAccounts = (accounts) => localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  const toast = (message) => { const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2800); };
  const setMessage = (id, message, bad=false) => { $(id).textContent=message; $(id).style.color=bad?"#ff9b8d":"var(--gold-light)"; };
  const showScreen = (screen) => { [auth,home,gameScreen].forEach(el=>el.classList.add("hidden")); screen.classList.remove("hidden"); };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function passwordHash(password, salt) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:100000,hash:"SHA-256"},key,256);
    return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  const randomSalt = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,"0")).join("");
  function userKey(name) { return name.trim().toLowerCase(); }
  function stats() { return currentUser?.stats || {wins:0,losses:0,draws:0}; }
  function persistUser() { if (!currentUser) return; const accounts=readAccounts(); accounts[userKey(currentUser.username)]=currentUser; saveAccounts(accounts); }
  async function register(event) {
    event.preventDefault();
    const username=$("register-username").value.trim(), password=$("register-password").value;
    if(username.length<3){setMessage("register-message","Username must contain at least 3 characters.",true);return;}
    if(password.length<6){setMessage("register-message","Password must contain at least 6 characters.",true);return;}
    const accounts=readAccounts(), key=userKey(username);
    if(accounts[key]){setMessage("register-message","That username already exists.",true);return;}
    const salt=randomSalt(), hash=await passwordHash(password,salt);
    accounts[key]={username,passwordHash:hash,salt,stats:{wins:0,losses:0,draws:0},theme:"Black & White",soundEnabled:true,createdAt:new Date().toISOString()};
    saveAccounts(accounts); $("register-form").reset(); $("register-form").classList.add("hidden"); $("login-form").classList.remove("hidden");
    $("login-username").value=username; setMessage("login-message","Account created. You can now log in."); toast("Account created successfully.");
  }
  async function login(event) {
    event.preventDefault();
    const username=$("login-username").value.trim(), password=$("login-password").value, user=readAccounts()[userKey(username)];
    if(!user){setMessage("login-message","Incorrect username or password.",true);return;}
    const hash=await passwordHash(password,user.salt);
    if(hash!==user.passwordHash){setMessage("login-message","Incorrect username or password.",true);return;}
    currentUser=user; theme=user.theme||"Black & White"; soundEnabled=user.soundEnabled!==false;
    localStorage.setItem(SESSION_KEY,userKey(user.username)); $("login-form").reset(); setMessage("login-message","");
    renderHome(); showScreen(home);
  }
  function logout() { if(!confirm("Log out of CHESS — PLAY BOLD?"))return; stopBot(); currentUser=null; game=null; localStorage.removeItem(SESSION_KEY); $("login-password").value=""; showScreen(auth); }
  function renderHome() {
    const s=stats(); $("home-greeting").textContent=`Hey, ${currentUser.username}`;
    $("home-wins").textContent=s.wins;$("home-losses").textContent=s.losses;$("home-draws").textContent=s.draws;
    $("toggle-sound-home").textContent=soundEnabled?"🔊 SOUND ON":"🔇 SOUND OFF";
  }
  function startGame(nextMode=mode) {
    stopBot(); mode=nextMode; game=new Chess(); selected=null;legalTargets=[];lastMove=null;flipped=false;gameActive=true;
    $("game-username").textContent=currentUser.username;$("game-mode").textContent=mode==="bot"?"🤖 VS BOT":"♟ ♙ TWO PLAYER";
    $("opponent-label").textContent=mode==="bot"?"🤖 COMPUTER":"♟ SECOND PLAYER";
    renderGameStats();renderBoard();updateTurn();$("status-text").textContent="Select a piece to begin.";
    $("toggle-sound-game").textContent=soundEnabled?"🔊 SOUND ON":"🔇 SOUND OFF";
    showScreen(gameScreen);
  }
  function renderGameStats(){const s=stats();$("game-wins").textContent=s.wins;$("game-losses").textContent=s.losses;$("game-draws").textContent=s.draws;}
  function renderBoard() {
    if(!game)return;
    const t=THEMES[theme];document.documentElement.style.setProperty("--board-light",t.light);document.documentElement.style.setProperty("--board-dark",t.dark);document.documentElement.style.setProperty("--selected",t.selected);document.documentElement.style.setProperty("--move",t.move);
    boardEl.innerHTML="";
    for(let visualRow=0;visualRow<8;visualRow++){
      for(let visualCol=0;visualCol<8;visualCol++){
        const file=flipped?7-visualCol:visualCol, rank=flipped?visualRow+1:8-visualRow, square="abcdefgh"[file]+rank;
        const piece=game.get(square), btn=document.createElement("button");btn.type="button";btn.className="square "+(((visualRow+visualCol)%2===0)?"light":"dark");btn.dataset.square=square;btn.setAttribute("role","gridcell");btn.setAttribute("aria-label",`${square}${piece?`, ${piece.color==="w"?"white":"black"} ${piece.type}`:""}`);
        if(selected===square)btn.classList.add("selected");
        if(lastMove&&(lastMove.from===square||lastMove.to===square))btn.classList.add("last-move");
        if(legalTargets.includes(square)){btn.classList.add("legal");if(piece)btn.classList.add("capture");}
        if(piece){const span=document.createElement("span");span.className="piece "+(piece.color==="w"?"white":"black");span.textContent=PIECES[piece.color][piece.type];btn.appendChild(span);}
        if(visualCol===0||visualRow===7){const coord=document.createElement("span");coord.className="coord";coord.textContent=visualCol===0?rank:"";if(visualRow===7)coord.textContent+=("abcdefgh"[file]);btn.appendChild(coord);}
        btn.addEventListener("click",()=>onSquareClick(square));boardEl.appendChild(btn);
      }
    }
    renderHistory();
    $("theme-name").textContent=theme;
    const swatches=document.querySelector(".theme-swatches");swatches.style.background=`linear-gradient(90deg,${t.light} 0 25%,${t.dark} 25% 50%,${t.light} 50% 75%,${t.dark} 75%)`;
  }
  function onSquareClick(square) {
    if(!gameActive||!game)return;
    if(mode==="bot"&&game.turn()==="b")return;
    const piece=game.get(square);
    if(selected && legalTargets.includes(square)){
      const fromPiece=game.get(selected);
      let promotion="q";
      if(fromPiece?.type==="p"&&((fromPiece.color==="w"&&square[1]==="8")||(fromPiece.color==="b"&&square[1]==="1"))){
        const answer=(prompt("Promote pawn to: Q (Queen), R (Rook), B (Bishop), or N (Knight)","q")||"q").toLowerCase();
        promotion=["q","r","b","n"].includes(answer)?answer:"q";
      }
      const move=game.move({from:selected,to:square,promotion});
      if(move){lastMove={from:move.from,to:move.to};selected=null;legalTargets=[];playSound(move.captured?"capture":"move");renderBoard();updateTurn();if(finishIfOver())return;if(game.in_check()){$("status-text").textContent="⚠ Check! Protect your king.";playSound("check");}else $("status-text").textContent=`${move.color==="w"?"White":"Black"} moved ${move.from} → ${move.to}.`;if(mode==="bot"&&game.turn()==="b")scheduleBot();}
      else {selectSquare(square);}
      return;
    }
    if(piece&&piece.color===game.turn()){selectSquare(square);return;}
    selected=null;legalTargets=[];renderBoard();
  }
  function selectSquare(square){selected=square;legalTargets=game.moves({square,verbose:true}).map(m=>m.to);renderBoard();}
  function updateTurn(){
    if(!game)return;
    const side=game.turn()==="w"?"WHITE":"BLACK";
    $("turn-indicator").textContent=(mode==="bot"&&game.turn()==="b")?"🤖 BOT THINKING":`${side} TO MOVE`;
    if(game.in_check())$("status-text").textContent=`⚠ ${side} is in check.`;
  }
  function renderHistory(){
    const list=$("move-history");list.innerHTML="";
    const history=game.history();for(let i=0;i<history.length;i+=2){const li=document.createElement("li");li.textContent=`${Math.floor(i/2)+1}. ${history[i]}${history[i+1]?"  "+history[i+1]:""}`;list.appendChild(li);}
    list.scrollTop=list.scrollHeight;
  }
  function materialScore() {
    let score=0;
    for(let r=1;r<=8;r++)for(const f of "abcdefgh"){const p=game.get(f+r);if(p){const v=VALUES[p.type]||0;score+=(p.color==="b"?v:-v);}}
    return score;
  }
  function botMove(){
    if(!gameActive||!game||game.turn()!=="b")return;
    const moves=game.moves({verbose:true});if(!moves.length)return;
    let best=null,bestScore=-Infinity;
    for(const move of moves){
      game.move(move);let score;
      if(game.in_checkmate())score=1e8;else score=materialScore();
      // Bot is playing black, so it prefers positive material scores.
      score+=Math.random()*10;game.undo();
      if(score>bestScore){bestScore=score;best=move;}
    }
    if(!best)best=moves[Math.floor(Math.random()*moves.length)];
    const played=game.move({from:best.from,to:best.to,promotion:best.promotion||"q"});
    if(!played)return;
    lastMove={from:played.from,to:played.to};selected=null;legalTargets=[];playSound(played.captured?"capture":"move");renderBoard();updateTurn();
    if(finishIfOver())return;
    $("status-text").textContent=game.in_check()?"⚠ Check! Your king is under attack.":"Your move.";
    if(game.in_check())playSound("check");
  }
  function scheduleBot(){stopBot();$("status-text").textContent="🤖 Bot is thinking…";botTimer=setTimeout(botMove,500);}
  function stopBot(){if(botTimer){clearTimeout(botTimer);botTimer=null;}}
  function finishIfOver(){
    if(!game.game_over())return false;
    gameActive=false;stopBot();const s=stats();let title,description,icon="🤝";
    if(game.in_checkmate()){
      if(mode==="bot"){
        if(game.turn()==="b"){s.wins++;title="CHECKMATE!";description=`Congratulations, ${currentUser.username}! You won the match.`;icon="🎉";playSound("win");}
        else{s.losses++;title="CHECKMATE";description="The bot won this match. Ready for a rematch?";icon="♟";playSound("loss");}
      }else{
        const winner=game.turn()==="w"?"Black":"White";title="CHECKMATE!";description=`${winner} wins the match!`;icon="🏆";
        if(winner==="White")s.wins++;else s.losses++;
      }
    }else if(game.in_draw()||game.in_stalemate()||game.in_threefold_repetition()||game.insufficient_material()){
      s.draws++;title="DRAW";description="The match ended in a draw.";icon="🤝";playSound("draw");
    }else return false;
    currentUser.stats=s;persistUser();renderHome();renderGameStats();
    $("result-icon").textContent=icon;$("result-title").textContent=title;$("result-description").textContent=description;
    $("result-dialog").showModal();return true;
  }
  function playSound(type){
    if(!soundEnabled)return;
    try{
      audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),freq={move:650,capture:450,check:900,win:1200,loss:300,draw:600}[type]||600;
      osc.frequency.value=freq;osc.type="sine";gain.gain.setValueAtTime(.07,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.16);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.17);
    }catch(e){/* Browser audio can be unavailable until user interaction. */}
  }
  function toggleSound(){soundEnabled=!soundEnabled;if(currentUser){currentUser.soundEnabled=soundEnabled;persistUser();}renderHome();$("toggle-sound-game").textContent=soundEnabled?"🔊 SOUND ON":"🔇 SOUND OFF";$("settings-sound").textContent=soundEnabled?"🔊 SOUND: ON":"🔇 SOUND: OFF";if(soundEnabled)playSound("move");}
  function openSettings(){
    if(!currentUser)return;
    $("settings-username").textContent=currentUser.username;const s=stats();$("settings-stats").textContent=`Wins ${s.wins} · Losses ${s.losses} · Draws ${s.draws}`;
    $("new-username").value=currentUser.username;$("board-theme").value=theme;$("settings-sound").textContent=soundEnabled?"🔊 SOUND: ON":"🔇 SOUND: OFF";setMessage("settings-message","");$("settings-dialog").showModal();
  }
  async function saveUsername(){
    const name=$("new-username").value.trim(),accounts=readAccounts(),oldKey=userKey(currentUser.username),newKey=userKey(name);
    if(name.length<3){setMessage("settings-message","Username must contain at least 3 characters.",true);return;}
    if(newKey!==oldKey&&accounts[newKey]){setMessage("settings-message","That username is already taken.",true);return;}
    delete accounts[oldKey];currentUser.username=name;accounts[newKey]=currentUser;saveAccounts(accounts);localStorage.setItem(SESSION_KEY,newKey);renderHome();$("game-username").textContent=name;$("settings-username").textContent=name;setMessage("settings-message","Username updated successfully.");
  }
  async function savePassword(){
    const current=$("current-password").value,next=$("new-password").value,confirm=$("confirm-password").value;
    if(await passwordHash(current,currentUser.salt)!==currentUser.passwordHash){setMessage("settings-message","Current password is incorrect.",true);return;}
    if(next.length<6){setMessage("settings-message","New password must contain at least 6 characters.",true);return;}
    if(next!==confirm){setMessage("settings-message","New passwords do not match.",true);return;}
    currentUser.salt=randomSalt();currentUser.passwordHash=await passwordHash(next,currentUser.salt);persistUser();
    $("current-password").value=$("new-password").value=$("confirm-password").value="";setMessage("settings-message","Password changed successfully.");
  }
  function changeTheme(value){theme=value;if(currentUser){currentUser.theme=value;persistUser();}renderBoardIfGame();$("theme-name").textContent=value;}
  function renderBoardIfGame(){if(game)renderBoard();}
  function undoMove(){
    if(!game||!gameActive||!game.history().length)return;
    stopBot();game.undo();
    if(mode==="bot"&&game.turn()==="b"&&game.history().length)game.undo();
    const hist=game.history({verbose:true});lastMove=hist.length?{from:hist[hist.length-1].from,to:hist[hist.length-1].to}:null;selected=null;legalTargets=[];renderBoard();updateTurn();$("status-text").textContent="Last move undone.";
  }
  function resign(){
    if(!gameActive||!confirm("Resign this match?"))return;
    gameActive=false;stopBot();const s=stats();s.losses++;currentUser.stats=s;persistUser();renderHome();renderGameStats();
    $("result-icon").textContent="♟";$("result-title").textContent="MATCH RESIGNED";$("result-description").textContent=mode==="bot"?"The bot wins this match.":"Match ended. Your opponent wins."; $("result-dialog").showModal();
  }
  $("show-register").addEventListener("click",()=>{ $("login-form").classList.add("hidden");$("register-form").classList.remove("hidden");setMessage("register-message","");});
  $("show-login").addEventListener("click",()=>{ $("register-form").classList.add("hidden");$("login-form").classList.remove("hidden");setMessage("login-message","");});
  $("login-form").addEventListener("submit",login);$("register-form").addEventListener("submit",register);
  $("play-bot").addEventListener("click",()=>startGame("bot"));$("play-person").addEventListener("click",()=>startGame("person"));
  $("logout-home").addEventListener("click",logout);$("logout-game").addEventListener("click",logout);
  $("open-settings").addEventListener("click",openSettings);$("game-settings").addEventListener("click",openSettings);$("quick-theme").addEventListener("click",openSettings);
  $("toggle-sound-home").addEventListener("click",toggleSound);$("toggle-sound-game").addEventListener("click",toggleSound);$("settings-sound").addEventListener("click",toggleSound);
  $("board-theme").addEventListener("change",e=>changeTheme(e.target.value));
  $("save-username").addEventListener("click",saveUsername);$("save-password").addEventListener("click",savePassword);
  $("settings-done").addEventListener("click",()=>$("settings-dialog").close());
  $("back-home").addEventListener("click",()=>{stopBot();gameActive=false;renderHome();showScreen(home);});
  $("new-game").addEventListener("click",()=>startGame(mode));$("undo-move").addEventListener("click",undoMove);
  $("flip-board").addEventListener("click",()=>{flipped=!flipped;renderBoard();});
  $("resign-game").addEventListener("click",resign);
  $("result-home").addEventListener("click",()=>{$("result-dialog").close();renderHome();showScreen(home);});
  $("result-again").addEventListener("click",()=>{$("result-dialog").close();startGame(mode);});
  window.addEventListener("beforeunload",stopBot);
  // Resume a previous browser session if one exists.
  (async()=>{
    const key=localStorage.getItem(SESSION_KEY),user=key?readAccounts()[key]:null;
    if(user){currentUser=user;theme=user.theme||"Black & White";soundEnabled=user.soundEnabled!==false;renderHome();showScreen(home);}
    else showScreen(auth);
    if(!window.Chess){setMessage("login-message","Chess engine is still loading. Refresh if the board does not start.",true);}
  })();
})();