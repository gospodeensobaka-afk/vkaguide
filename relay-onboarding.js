/* Existing quest controls remain in index.html. */
(() => {
  'use strict';
  window.VK_DEBUG=false;
  const R=window.Relay;
  let active='', selected='', operation=false, connected=false;
  let tokenRequest, tokenDenied=false;
  function refusal(e){const detail=e?.error_data||e;return R.code(e)===4 || /denied|cancel|отказ|отмен/i.test(String(detail?.error_reason||detail?.error_msg||e?.message||''));}
  window.getToken=function(){
    if(tokenDenied)return Promise.reject({auth:true});
    if(ctoken)return Promise.resolve(ctoken);
    if(!tokenRequest)tokenRequest=(async()=>{
      const args={app_id:R.appId,group_id:Number(R.GROUP),scope:'manage'};
      let result;
      try{result=await vkBridge.send('VKWebAppGetCommunityToken',args);}
      catch(e){
        if(refusal(e))throw {auth:true};
        await vkBridge.send('VKWebAppAddToCommunity');
        result=await vkBridge.send('VKWebAppGetCommunityToken',args);
      }
      if(!result?.access_token)throw {auth:true};
      return ctoken=result.access_token;
    })().catch(e=>{tokenDenied=true;throw e;}).finally(()=>{tokenRequest=null;});
    return tokenRequest;
  };
  const menu=R.shell('modeChoice','<div class="relay-card relay-welcome"><div class="relay-compass" aria-hidden="true"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"> <circle cx="24" cy="24" r="23" stroke="#E8C97A" stroke-width="1.2" stroke-dasharray="6 3"/> <path d="M24 8 L26 18 L24 16 L22 18 Z" fill="#E8C97A"/> <path d="M24 40 L26 30 L24 32 L22 30 Z" fill="#E8C97A"/> <path d="M8 24 L18 22 L16 24 L18 26 Z" fill="#E8C97A"/> <path d="M40 24 L30 22 L32 24 L30 26 Z" fill="#E8C97A"/> <circle cx="24" cy="24" r="6" stroke="#E8C97A" stroke-width="1"/> <circle cx="24" cy="24" r="2" fill="#E8C97A"/> </svg></div><h1>Пульт гида</h1><p>Выберите режим экскурсии</p><button class="relay-choice" data-mode="quest"><strong>Пульт квеста</strong>Загадки 0–14</button><button class="relay-choice" data-mode="relay"><strong>Пульт ретранслятора</strong>Фотографии для туристов</button></div>');
  const page=R.shell('relayGuide','<div class="relay-card"><button class="relay-back">← Выбор режима</button><h1>Ретранслятор фото</h1><p id="relayNow">Сейчас у туристов: —</p><div class="relay-status" role="status" aria-live="polite"></div><button class="relay-pause" id="relayPause">Убрать фото / пауза</button><button id="relayRefresh">Обновить состояние</button> <button id="relayPrepare">Подготовить фото ВК</button><div class="relay-grid"></div></div>');
  const back=document.createElement('button');back.className='relay-quest-back';back.textContent='← Режимы';back.hidden=true;document.body.append(back);
  const status=page.querySelector('.relay-status'), now=page.querySelector('#relayNow'), grid=page.querySelector('.relay-grid');
  let ordered=[...R.photos].sort((a,b)=>Number(a.id)-Number(b.id));
  const ORDER_KEY='relay-guide-photo-order-v1';
  try {
    const ids=JSON.parse(localStorage.getItem(ORDER_KEY)||'[]');
    if(Array.isArray(ids)) {
      const byId=new Map(ordered.map(p=>[String(p.id),p]));
      const saved=[];
      for(const id of ids){const p=byId.get(String(id));if(p){saved.push(p);byId.delete(String(id));}}
      ordered=[...saved,...byId.values()];
    }
  } catch(_) {}
  let editing=false, drag=null;
  const edit=document.createElement('button');edit.id='relayEditOrder';edit.textContent='Изменить порядок';
  grid.before(edit);
  const reverse=document.createElement('button');reverse.textContent='Обратить порядок фото';grid.before(reverse);
  reverse.onclick=()=>{if(operation||drag)return;ordered.reverse();persistOrder();draw();};
  const closeSession=document.createElement('button');closeSession.textContent='Очистить галерею у всех';grid.before(closeSession);
  const resetPanel=document.createElement('div');resetPanel.hidden=true;
  resetPanel.innerHTML='<p>Убрать фото и очистить галереи у подключённых туристов?</p><button type="button" data-reset="yes">Да, очистить</button> <button type="button" data-reset="no">Отмена</button>';
  closeSession.after(resetPanel);
  closeSession.onclick=()=>{
    if(operation||drag||!connected)return;
    editing=false;hint.hidden=true;edit.textContent='Изменить порядок';resetPanel.hidden=false;draw();
  };
  resetPanel.querySelector('[data-reset="no"]').onclick=()=>{resetPanel.hidden=true;};
  resetPanel.querySelector('[data-reset="yes"]').onclick=()=>{resetPanel.hidden=true;write('');};


  const hint=document.createElement('p');hint.hidden=true;
  hint.textContent='Тяни фото за ручку ↕. У края экрана список прокручивается. Можно также выбрать ручку и нажимать стрелки на клавиатуре. Порядок сохраняется на этом устройстве.';
  grid.before(hint);
  function persistOrder(){
    try{localStorage.setItem(ORDER_KEY,JSON.stringify(ordered.map(p=>String(p.id))));status.textContent='Порядок сохранён на этом устройстве.';}
    catch(_){status.textContent='Не удалось сохранить порядок. Он действует до закрытия приложения.';}
  }
  function movePhoto(from,to){
    const a=ordered.findIndex(p=>String(p.id)===String(from)), b=ordered.findIndex(p=>String(p.id)===String(to));
    if(a<0||b<0||a===b)return;
    ordered.splice(b,0,ordered.splice(a,1)[0]);persistOrder();
  }
  edit.onclick=()=>{if(operation)return;editing=!editing;hint.hidden=!editing;edit.textContent=editing?'Готово — показывать фото':'Изменить порядок';draw();};
  function markTarget(x,y){
    grid.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));
    const tile=document.elementFromPoint(x,y)?.closest('.relay-tile');
    drag.target=tile&&grid.contains(tile)?tile.dataset.photo:null;
    if(tile&&drag.target!==drag.id)tile.classList.add('drop-target');
  }
  function attachHandle(handle,button,p){
    handle.onpointerdown=e=>{
      if(!editing||drag||!e.isPrimary||e.button!==0)return;
      e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);
      drag={id:String(p.id),pointer:e.pointerId,x:e.clientX,y:e.clientY,target:null};
      button.classList.add('dragging');
      drag.timer=setInterval(()=>{
        if(!drag)return;
        const box=page.getBoundingClientRect();
        const step=drag.y<box.top+130?-14:drag.y>box.bottom-80?14:0;
        if(step){page.scrollTop+=step;markTarget(drag.x,drag.y);}
      },30);
    };
    handle.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;markTarget(drag.x,drag.y);};
    const end=(e,commit)=>{
      if(!drag||drag.pointer!==e.pointerId)return;
      const old=drag;clearInterval(old.timer);drag=null;
      if(commit&&old.target)movePhoto(old.id,old.target);
      draw();
    };
    handle.onpointerup=e=>end(e,true);handle.onpointercancel=e=>end(e,false);
    handle.onlostpointercapture=e=>end(e,false);
    handle.onclick=e=>{e.preventDefault();e.stopPropagation();};
    handle.onkeydown=e=>{
      const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[e.key];
      if(delta===undefined)return;e.preventDefault();e.stopPropagation();
      const i=ordered.indexOf(p),next=ordered[Math.max(0,Math.min(ordered.length-1,i+delta))];
      movePhoto(p.id,next.id);draw();
      [...grid.querySelectorAll('.relay-tile')].find(el=>el.dataset.photo===String(p.id))?.querySelector('.relay-drag-handle')?.focus();
    };
  }

  function choose(){if(operation)return;active='';menu.hidden=false;page.hidden=true;back.hidden=true;document.getElementById('questControls').hidden=true;}
  back.onclick=choose;page.querySelector('.relay-back').onclick=choose;
  menu.querySelector('[data-mode="quest"]').onclick=()=>{active='quest';menu.hidden=true;back.hidden=false;document.getElementById('questControls').hidden=false;refresh();};
  menu.querySelector('[data-mode="relay"]').onclick=()=>{active='relay';menu.hidden=true;page.hidden=false;draw();refreshRelay();};
  function draw(){
    grid.replaceChildren();
    ordered.forEach(p=>{
      const button=document.createElement('button');button.type='button';button.className='relay-tile';button.dataset.photo=p.id;button.title=p.title;
      button.setAttribute('aria-label',p.title);button.classList.toggle('selected',p.id===selected);button.setAttribute('aria-pressed',String(p.id===selected));
      const ready=R.allowedURL(p.url);
      if(ready){const img=document.createElement('img');img.src=R.allowedURL(p.thumb)?p.thumb:p.url;img.alt='';img.loading='lazy';button.append(img);img.onerror=()=>{button.title=p.title+' — изображение не загрузилось';};}
      const label=document.createElement('span');label.textContent=p.title+(ready?'':' · не готово');button.append(label);
      button.disabled=!editing&&(!ready || operation || !connected);
      button.onclick=()=>{if(!editing)write('p'+p.id);};
      if(editing){
        const handle=document.createElement('span');handle.className='relay-drag-handle';handle.textContent='↕';handle.tabIndex=0;handle.setAttribute('role','button');handle.setAttribute('aria-label','Переместить '+p.title);attachHandle(handle,button,p);button.append(handle);
      }
      grid.append(button);
    });
    grid.classList.toggle('editing-order',editing);edit.disabled=operation;reverse.disabled=operation;closeSession.disabled=operation||!!drag||!connected;
    page.querySelector('#relayPause').disabled=editing || operation || !connected;
  }
  function state(text){
    const s=R.parse(text);selected=s.type==='photo'?s.id:'';
    now.textContent='Сейчас у туристов: '+(s.type==='photo'?(R.byId.get(s.id)?.title || 'Фото '+s.id):s.type==='quest'?'квест, '+(s.id===0?'пауза':'загадка '+s.id):s.type==='pause'?'пауза':'неизвестная команда');draw();
  }
  async function refreshRelay(){
    if(operation)return;operation=true;draw();status.textContent='Читаю состояние ВК…';
    try{await getToken();const text=await R.read(ctoken);connected=true;state(text);status.textContent='Выберите фотографию. Один режим для всей группы.';}
    catch(e){connected=false;status.textContent=R.errorText(e);}
    finally{operation=false;draw();}
  }
  async function write(description){
    if(editing || operation || !connected)return;operation=true;draw();status.textContent='Отправляю…';
    try{
      await getToken();
      const result=await R.api('groups.edit',{group_id:R.GROUP,description},ctoken);
      if(result!==1 && result!==true)throw new Error('Unexpected edit result');
      const text=await R.read(ctoken);state(text);
      status.textContent=text===description?'Готово. Туристы получат изменение при следующем опросе.':'ВК показывает другую команду. Проверьте состояние.';
    }catch(e){status.textContent=R.errorText(e);}
    finally{setTimeout(()=>{operation=false;draw();},1200);}
  }
  page.querySelector('#relayRefresh').onclick=refreshRelay;
  page.querySelector('#relayPause').onclick=()=>write('');
  page.querySelector('#relayPrepare').onclick=()=>{if(!operation)window.RelayUpload.open();};
  window.RelayGuide={redraw:draw};
  choose();
})();
