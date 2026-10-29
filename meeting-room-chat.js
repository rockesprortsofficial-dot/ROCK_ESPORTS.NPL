(() => {
  'use strict';
  if (window.__rockPrivateMessengerLoaded) return;
  window.__rockPrivateMessengerLoaded = true;
  const API='https://pokdcjqvyjddbixqaktj.supabase.co/functions/v1/rock-meeting-chat-media';
  const KEY='sb_publishable_jK4Pnt8Ou9lZOmQ2AEB60w_YFytJcbp';
  const MAX=25*1024*1024, TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']);
  let dispose=null;
  const style=document.createElement('style');style.id='rock-private-messenger-style';
  style.textContent=`
  body.rock-meeting-active #rlCall:not([hidden]){display:grid!important;grid-template-columns:minmax(0,1fr) minmax(220px,32%)!important;grid-template-rows:1fr auto!important;gap:10px!important;padding:12px!important;box-sizing:border-box!important;overflow:hidden!important}
  body.rock-meeting-active #rlTitle,body.rock-meeting-active #rlCount{display:none!important}
  body.rock-meeting-active #rlVideos{grid-column:2;grid-row:1;display:flex!important;flex-direction:column!important;gap:8px!important;overflow:auto!important;min-height:0!important;padding:0!important;margin:0!important}
  body.rock-meeting-active #rlVideos .rl-participant{position:relative!important;inset:auto!important;width:100%!important;height:auto!important;min-height:160px!important;max-height:45vh!important;flex:0 0 auto!important;transform:none!important}
  body.rock-meeting-active #rlVideos video{min-height:140px!important}
  body.rock-meeting-active #rlCall>.rl-controls{grid-column:1/-1;grid-row:2;position:static!important;display:flex!important;opacity:1!important;visibility:visible!important;transform:none!important;margin:0!important;padding:8px!important;background:#081b2f!important;pointer-events:auto!important}
  #rockMeetingChatPanel{grid-column:1;grid-row:1;display:flex;flex-direction:column;min-height:0;min-width:0;color:#eff8ff;background:#071626;border:1px solid #2675a8;border-radius:16px;overflow:hidden;font:14px system-ui}
  #rockMeetingChatPanel [hidden]{display:none!important}
  #rockMeetingChatPanel button{cursor:pointer;border:1px solid #285675;border-radius:12px;background:#12344e;color:#fff;padding:9px 12px;font:inherit;min-height:40px}
  #rockMeetingChatPanel button:disabled{opacity:.5;cursor:wait}
  #rockMeetingChatHead{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:13px;border-bottom:1px solid #23465e;background:#0b2136}
  #rockMeetingChatHead strong{flex:1;min-width:120px}
  #rockMeetingChatHead small{display:block;font-weight:400;color:#a6c6dc;margin-top:4px}
  #rockMeetingChatStatus{padding:6px 13px;color:#a6c6dc;font-size:12px;min-height:20px;overflow-wrap:anywhere}
  #rockMeetingChatMessages{flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
  #rockMeetingChatMessages .rock-chat-msg{align-self:flex-start;max-width:85%;padding:10px 13px;border-radius:16px 16px 16px 4px;background:#173149;overflow-wrap:anywhere}
  #rockMeetingChatMessages .rock-chat-own{align-self:flex-end;background:#0878bd;border-radius:16px 16px 4px 16px}
  #rockMeetingChatMessages strong{display:block;font-size:11px;color:#b9ddf6;margin-bottom:4px}
  #rockMeetingChatMessages small{display:block;font-size:10px;color:#c3d6e2;margin-top:5px}
  #rockMeetingChatMessages img,#rockMeetingChatMessages video{display:block;max-width:100%;max-height:240px;border-radius:10px;background:#000}
  #rockMeetingChatMessages a{color:#d3edff}
  #rockMeetingChatMessages .rock-chat-sticker{font-size:36px;line-height:1.5}
  #rockMeetingChatForm{display:flex;gap:6px;padding:10px;border-top:1px solid #23465e;align-items:center}
  #rockMeetingChatText{flex:1;min-width:0;border:1px solid #315a75;border-radius:22px;background:#102b42;color:#fff;padding:12px;font:inherit}
  #rockMeetingChatTools{display:flex;flex-wrap:wrap;gap:6px;padding:6px 10px}
  #rockMeetingChatPicker{display:flex;flex-wrap:wrap;gap:6px;padding:8px;max-height:120px;overflow:auto}
  #rockMeetingChatPreview{display:flex;align-items:center;gap:8px;padding:8px 12px;overflow-wrap:anywhere}
  #rockMeetingChatPreview img,#rockMeetingChatPreview video{width:70px;height:60px;object-fit:contain;border-radius:8px}
  #rockMeetingChatPeople{padding:10px;color:#b6cee2;font:13px system-ui;background:#071626;border:1px solid #23465e;border-radius:12px}
  #rockMeetingChatPeople p{margin:8px 0;overflow-wrap:anywhere}
  @media(max-width:700px){body.rock-meeting-active #rlCall:not([hidden]){grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr) auto auto!important;padding:5px!important;gap:4px!important}body.rock-meeting-active #rlVideos{grid-column:1!important;grid-row:2!important;flex-direction:row!important;max-height:145px!important}body.rock-meeting-active #rlVideos .rl-participant{width:150px!important;min-height:100px!important;max-height:140px!important}body.rock-meeting-active #rlVideos video{min-height:90px!important}body.rock-meeting-active #rlCall>.rl-controls{grid-row:3!important;padding:5px!important;gap:7px!important}#rockMeetingChatPeople{min-width:150px;font-size:11px}#rockMeetingChatHead{padding:9px;gap:5px}#rockMeetingChatHead button{padding:7px}#rockMeetingChatMessages{padding:9px}#rockMeetingChatForm{padding:7px}}
  `;document.head.append(style);
  window.addEventListener('rock-private-meeting-ready',event=>mount(event.detail));
  function mount({room,token}={}){
    if(!room||!token||!room.name?.startsWith('rock-private-'))return;
    dispose?.();
    const panel=document.createElement('section');panel.id='rockMeetingChatPanel';panel.setAttribute('aria-label','Private member messenger');
    panel.innerHTML=`<header id="rockMeetingChatHead"><strong>ROCK ESPORTS<small>निजी सदस्य समूह / Private member group</small></strong><button type="button" id="rockMeetingAudio">📞 Audio / अडियो</button><button type="button" id="rockMeetingVideo">📹 Video / भिडियो</button></header><div id="rockMeetingChatStatus" role="status">जडान हुँदैछ / Connecting…</div><div id="rockMeetingChatMessages" aria-live="polite" aria-label="Member messages"></div><div id="rockMeetingChatPicker" hidden></div><div id="rockMeetingChatPreview" hidden></div><div id="rockMeetingChatTools"><button type="button" id="rockMeetingEmoji" aria-expanded="false">😊 Emoji</button><button type="button" id="rockMeetingSticker" aria-expanded="false">🎨 Sticker</button><button type="button" id="rockMeetingAttach">＋ फोटो / Photo</button><input id="rockMeetingChatFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden></div><form id="rockMeetingChatForm"><input id="rockMeetingChatText" maxlength="2000" autocomplete="off" aria-label="Message / सन्देश" placeholder="सन्देश लेख्नुहोस् / Message…"><button type="submit">पठाउनुहोस् / Send</button></form>`;
    document.getElementById('rlCall').prepend(panel);
    const $=id=>panel.querySelector('#'+id),list=$('rockMeetingChatMessages'),input=$('rockMeetingChatText'),file=$('rockMeetingChatFile'),picker=$('rockMeetingChatPicker'),preview=$('rockMeetingChatPreview');
    const people=document.createElement('aside');people.id='rockMeetingChatPeople';document.getElementById('rlVideos').prepend(people);
    let closed=false,busy=false,loading=false,pending=null,previewUrl=null,pickerKind='',timer;
    const seen=new Map();
    const status=text=>{if(!closed)$('rockMeetingChatStatus').textContent=text};
    const request=async(options={})=>{const response=await fetch(API+(options.method?'':'?room='+encodeURIComponent(room.name)),{...options,headers:{apikey:KEY,Authorization:'Bearer '+token,'x-rock-room':room.name,...options.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'पुनः प्रयास गर्नुहोस् / Please try again');return data;};
    function renderPeople(){if(closed)return;people.replaceChildren();const title=document.createElement('strong');title.textContent='अनलाइन सदस्य / Online ('+(room.remoteParticipants.size+1)+')';people.append(title);for(const person of [room.localParticipant,...room.remoteParticipants.values()]){const line=document.createElement('p');line.textContent='● '+(person.name||'Member')+(person===room.localParticipant?' (तपाईं / You)':'');people.append(line);}}
    function show(item){if(closed||!item?.id)return;const old=seen.get(item.id);if(old){const media=old.querySelector('[data-media]');if(media&&item.media_url&&media.dataset.media!==item.media_url){media.src=item.media_url;media.dataset.media=item.media_url;const link=old.querySelector('a');if(link)link.href=item.media_url;}return;}
      const nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<90;
      const card=document.createElement('article');card.className='rock-chat-msg'+(item.sender_id===room.localParticipant.identity?' rock-chat-own':'');const author=document.createElement('strong');author.textContent=item.sender_name||'ROCK member';card.append(author);
      if(item.message){const text=document.createElement('div');text.textContent=item.message;if(/^🎨 (🔥|🏆|🎮|❤️|👏|🎉) ROCK$/.test(item.message))text.className='rock-chat-sticker';card.append(text);}
      if(item.media_url){const media=document.createElement(item.media_type==='video'?'video':'img');media.src=item.media_url;media.dataset.media=item.media_url;if(item.media_type==='video'){media.controls=true;media.playsInline=true;media.preload='metadata';card.append(media);}else{media.alt='सदस्यले पठाएको फोटो / Member photo';media.loading='lazy';const link=document.createElement('a');link.href=item.media_url;link.target='_blank';link.rel='noopener noreferrer';link.append(media);card.append(link);}}
      const date=document.createElement('small');date.textContent=new Date(item.created_at||Date.now()).toLocaleString();card.append(date);list.append(card);seen.set(item.id,card);if(nearBottom||item.sender_id===room.localParticipant.identity)list.scrollTop=list.scrollHeight;
    }
    async function load(){if(closed||loading)return;loading=true;try{const data=await request();if(closed)return;for(const item of data.messages||[])show(item);status('निजी समूह • Camera/mic आफ्नो बटनबाट खोल्नुहोस् / Private group • Use call buttons for audio/video');}catch(error){status(error.message);}finally{loading=false;}}
    function clearFile(){pending=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;file.value='';preview.replaceChildren();preview.hidden=true;}
    file.onchange=()=>{if(busy)return;const candidate=file.files?.[0];clearFile();if(!candidate)return;if(!TYPES.has(candidate.type)||candidate.size<=0||candidate.size>MAX){status('२५ MB सम्मको फोटो/भिडियो छान्नुहोस् / Choose a photo/video up to 25 MB');return;}pending=candidate;previewUrl=URL.createObjectURL(candidate);const media=document.createElement(candidate.type.startsWith('video/')?'video':'img');media.src=previewUrl;if(media.tagName==='VIDEO')media.controls=true;const name=document.createElement('span');name.textContent=candidate.name;const cancel=document.createElement('button');cancel.type='button';cancel.textContent='✕';cancel.setAttribute('aria-label','Remove attachment');cancel.onclick=clearFile;preview.append(media,name,cancel);preview.hidden=false;};
    $('rockMeetingAttach').onclick=()=>file.click();
    function choose(kind){picker.hidden=pickerKind===kind&&!picker.hidden;pickerKind=kind;picker.replaceChildren();$('rockMeetingEmoji').setAttribute('aria-expanded',String(!picker.hidden&&kind==='emoji'));$('rockMeetingSticker').setAttribute('aria-expanded',String(!picker.hidden&&kind==='sticker'));for(const icon of (kind==='emoji'?['😀','😂','❤️','🔥','👍','🎮','🏆','👏','🙏','🎉']:['🔥','🏆','🎮','❤️','👏','🎉'])){const button=document.createElement('button');button.type='button';button.textContent=kind==='emoji'?icon:icon+' ROCK';button.onclick=()=>{input.value=(input.value+(kind==='sticker'?'🎨 '+icon+' ROCK':icon)).slice(0,2000);input.focus();};picker.append(button);}}
    $('rockMeetingEmoji').onclick=()=>choose('emoji');$('rockMeetingSticker').onclick=()=>choose('sticker');
    $('rockMeetingAudio').onclick=()=>{document.getElementById('rlMic').click();};
    $('rockMeetingVideo').onclick=()=>{if(!room.localParticipant.isCameraEnabled&&!room.localParticipant.isMicrophoneEnabled)document.getElementById('rlMic').click();document.getElementById('rlCam').click();};
    $('rockMeetingChatForm').onsubmit=async event=>{event.preventDefault();if(busy||closed)return;const message=input.value.trim(),attachment=pending;if(!message&&!attachment)return;busy=true;for(const button of panel.querySelectorAll('button'))button.disabled=true;input.disabled=true;file.disabled=true;status('पठाउँदै छ / Sending…');try{let options;if(attachment){const body=new FormData();body.append('media',attachment);body.append('message',message);options={method:'POST',body};}else options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})};const data=await request(options);if(closed)return;show(data.message);input.value='';clearFile();status('पठाइयो / Sent');}catch(error){status(error.message);}finally{busy=false;if(!closed){for(const button of panel.querySelectorAll('button'))button.disabled=false;input.disabled=false;file.disabled=false;input.focus();}}};
    panel.addEventListener('click',event=>event.stopPropagation());
    const events=window.LivekitClient.RoomEvent;
    room.on(events.ParticipantConnected,renderPeople);room.on(events.ParticipantDisconnected,renderPeople);
    dispose=()=>{if(closed)return;closed=true;clearInterval(timer);clearFile();room.off(events.ParticipantConnected,renderPeople);room.off(events.ParticipantDisconnected,renderPeople);room.off(events.Disconnected,dispose);window.removeEventListener('pagehide',dispose);panel.remove();people.remove();};
    room.on(events.Disconnected,dispose);window.addEventListener('pagehide',dispose,{once:true});renderPeople();load();timer=setInterval(load,3000);
  }
})();
