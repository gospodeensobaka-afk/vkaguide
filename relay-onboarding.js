/* Existing quest controls remain in index.html. */
(() => {
  'use strict';
  window.VK_DEBUG=false;
  const R=window.Relay;
  let active='', limit=36, selected='', operation=false, connected=false;
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
  const menu=R.shell('modeChoice','<div class="relay-card"><h1>Пульт гида</h1><p>Выберите режим экскурсии</p><button class="relay-choice" data-mode="quest"><strong>Пульт квеста</strong>Загадки 0–14</button><button class="relay-choice" data-mode="relay"><strong>Пульт ретранслятора</strong>Фотографии для туристов</button></div>');
  const page=R.shell('relayGuide','<div class="relay-card"><button class="relay-back">← Выбор режима</button><h1>Ретранслятор фото</h1><p id="relayNow">Сейчас у туристов: —</p><div class="relay-status" role="status" aria-live="polite"></div><button class="relay-pause" id="relayPause">Убрать фото / пауза</button><button id="relayRefresh">Обновить состояние</button> <button id="relayPrepare">Подготовить фото ВК</button><div class="relay-grid"></div><button id="relayMore">Ещё</button></div>');
  const back=document.createElement('button');back.className='relay-quest-back';back.textContent='← Режимы';back.hidden=true;document.body.append(back);
  const status=page.querySelector('.relay-status'), now=page.querySelector('#relayNow'), grid=page.querySelector('.relay-grid');
  const ordered=[...R.photos].sort((a,b)=>Number(b.id)-Number(a.id));
  function choose(){if(operation)return;active='';menu.hidden=false;page.hidden=true;back.hidden=true;document.getElementById('questControls').hidden=true;}
  back.onclick=choose;page.querySelector('.relay-back').onclick=choose;
  menu.querySelector('[data-mode="quest"]').onclick=()=>{active='quest';menu.hidden=true;back.hidden=false;document.getElementById('questControls').hidden=false;refresh();};
  menu.querySelector('[data-mode="relay"]').onclick=()=>{active='relay';menu.hidden=true;page.hidden=false;draw();refreshRelay();};
  function draw(){
    grid.replaceChildren();
    ordered.slice(0,limit).forEach(p=>{
      const button=document.createElement('button');button.type='button';button.className='relay-tile';button.dataset.photo=p.id;button.title=p.title;
      button.setAttribute('aria-label',p.title);button.classList.toggle('selected',p.id===selected);button.setAttribute('aria-pressed',String(p.id===selected));
      const ready=R.allowedURL(p.url);
      if(ready){const img=document.createElement('img');img.src=R.allowedURL(p.thumb)?p.thumb:p.url;img.alt='';img.loading='lazy';button.append(img);img.onerror=()=>{button.title=p.title+' — изображение не загрузилось';};}
      const label=document.createElement('span');label.textContent=p.title+(ready?'':' · не готово');button.append(label);
      button.disabled=!ready || operation || !connected;button.onclick=()=>write('p'+p.id);grid.append(button);
    });
    page.querySelector('#relayMore').hidden=limit>=ordered.length;
    page.querySelector('#relayPause').disabled=operation || !connected;
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
    if(operation || !connected)return;operation=true;draw();status.textContent='Отправляю…';
    try{
      await getToken();const result=await R.api('groups.edit',{group_id:R.GROUP,description},ctoken);
      if(result!==1 && result!==true)throw new Error('Unexpected edit result');
      const text=await R.read(ctoken);state(text);
      status.textContent=text===description?'Готово. Туристы получат изменение при следующем опросе.':'ВК показывает другую команду. Проверьте состояние.';
    }catch(e){status.textContent=R.errorText(e);}
    finally{setTimeout(()=>{operation=false;draw();},1200);}
  }
  page.querySelector('#relayRefresh').onclick=refreshRelay;
  page.querySelector('#relayMore').onclick=()=>{limit+=36;draw();};
  page.querySelector('#relayPause').onclick=()=>write('');
  page.querySelector('#relayPrepare').onclick=()=>{if(!operation)window.RelayUpload.open();};
  window.RelayGuide={redraw:draw};
  choose();
})();
