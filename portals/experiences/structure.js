import { edgeKey, reachable, networkReport } from '../core.js';
import { $, $$, button, research, announce } from '../ui.js';
const starter = [[4,1],[1,0],[1,2],[4,3],[4,5],[4,7],[7,6],[7,8]];
const names = 'ABCDEFGHI'.split('');
const positions = Array.from({length:9},(_,i)=>({x:100+(i%3)*200,y:70+Math.floor(i/3)*140}));
export function mount() {
  let edges=starter.map(e=>[...e]), selected=null, broken=null, budget=12;
  const undo=[];
  $('#stage').innerHTML = `<div class="stage-top"><strong>Nine places. One source of light.</strong><span id="link-count">8 / 12 links</span></div><div class="network"><svg viewBox="0 0 600 420" aria-hidden="true" id="network-lines"></svg>${positions.map((p,i)=>`<button type="button" class="network-node ${i===4?'source':''}" data-node="${i}" style="left:${p.x/6}%;top:${p.y/4.2}%" aria-pressed="false" aria-label="${names[i]}${i===4?', light source':''}">${names[i]}</button>`).join('')}</div><div class="stats"><div class="stat"><strong id="lit">9 / 9</strong><span>places with light now</span></div><div class="stat"><strong id="worst">—</strong><span>fewest lit after one break</span></div><div class="stat"><strong id="spare">4</strong><span>links left to use</span></div></div>`;
  $('#controls').innerHTML=`<h2>Give the light another way.</h2><p>Tap two letters to join them. Tap a joined pair again to remove its link. E is the source.</p><p class="note" id="network-task">Keep all nine places lit even when any one link breaks. Use at most twelve links.</p>${button('break','Test a broken link',true)}${button('repair','Restore the broken link')}${button('undo','Undo my last change')}${button('reset','Start again')}<hr><h2>Build a living village</h2><p>Gather resources, choose buildings and grow your village.</p><a class="secondary" href="../../games/empire-dawn/">Enter the village →</a>`;
  $('#extra').innerHTML=`<details class="history"><summary>Edit links by name</summary><p class="hint">These buttons remove a link. The letter buttons above add one.</p><div class="edge-list" id="edge-list"></div></details>`;
  const changed = () => {
    const report=networkReport(edges), lit=reachable(edges,4,broken);
    $('#network-lines').innerHTML=edges.map(([a,b])=>{const p=positions[a],q=positions[b],off=edgeKey(a,b)===broken;return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${off?'#fda796':lit.has(a)&&lit.has(b)?'#ffd48980':'#4c607a'}" stroke-width="${off?3:2}" ${off?'stroke-dasharray="7 9"':''}/>`;}).join('');
    $$('[data-node]').forEach(b=>{const i=Number(b.dataset.node);b.classList.toggle('powered',lit.has(i));b.setAttribute('aria-pressed',String(selected===i));b.setAttribute('aria-label',`${names[i]}${i===4?', light source':''}, ${lit.has(i)?'lit':'unlit'}${selected===i?', selected':''}`);});
    $('#lit').textContent=`${lit.size} / 9`;$('#worst').textContent=`${report.worst.reached} / 9`;$('#spare').textContent=budget-edges.length;$('#link-count').textContent=`${edges.length} / ${budget} links`;
    $('#repair').hidden=!broken;$('#break').disabled=Boolean(broken)||!edges.length;$('#undo').disabled=!undo.length;
    $('#edge-list').innerHTML=edges.map(([a,b])=>`<button type="button" data-remove="${edgeKey(a,b)}" aria-label="Remove link ${names[a]} to ${names[b]}">${names[a]}–${names[b]} ×</button>`).join('');
    $$('[data-remove]').forEach(b=>b.addEventListener('click',()=>{undo.push(edges.map(e=>[...e]));edges=edges.filter(e=>edgeKey(...e)!==b.dataset.remove);broken=null;selected=null;changed();announce('Link removed. Check which places still receive light.');}));
  };
  $$('[data-node]').forEach(b=>b.addEventListener('click',()=>{
    const node=Number(b.dataset.node);
    if (selected===null) { selected=node;changed();announce(`${names[node]} selected. Choose a second letter to add or remove a link.`);return; }
    if (selected===node) {selected=null;changed();announce('Selection cleared.');return;}
    const key=edgeKey(selected,node), existing=edges.some(e=>edgeKey(...e)===key);
    if (!existing&&edges.length>=budget) {announce(`All ${budget} links are in use. Remove one or undo a change first.`);return;}
    undo.push(edges.map(e=>[...e]));
    if(existing)edges=edges.filter(e=>edgeKey(...e)!==key);else edges.push([selected,node]);
    selected=null;broken=null;changed();
    const report=networkReport(edges);
    announce(report.resilient?'Every place stays lit after every possible single-link break. Test it!':`${report.working} places are connected now. After the worst single break, ${report.worst.reached} keep their light. A loop can offer another path.`,report.resilient?'success':'');
  }));
  $('#break').addEventListener('click',()=>{
    const report=networkReport(edges);broken=report.worst.key||edgeKey(...edges[0]);selected=null;changed();
    const [a,b]=broken.split('-').map(Number);
    announce(report.resilient?`Link ${names[a]}–${names[b]} is broken. All nine stay lit, and we checked every other single break too. You built a resilient network.`:`Link ${names[a]}–${names[b]} is broken. ${report.worst.reached} places still have light. Where could a new route help?`,report.resilient?'success':'');
    if(report.resilient&&budget===12&&!$('#harder')) {
      $('#controls').insertAdjacentHTML('afterbegin',button('harder','Try the nine-link challenge'));
      $('#harder').addEventListener('click',()=>{budget=9;edges=starter.map(e=>[...e]);undo.length=0;broken=null;selected=null;$('#harder').remove();$('#network-task').textContent='Same goal. Only nine links. Can you make one unbroken route around all nine places?';changed();announce('A new challenge: all nine lit after any one link breaks, with nine links.');});
    }
  });
  $('#repair').addEventListener('click',()=>{broken=null;changed();announce('The broken link is restored. Keep shaping the network.');});
  $('#undo').addEventListener('click',()=>{if(undo.length){edges=undo.pop();broken=null;selected=null;changed();announce('Your last link change is undone.');}});
  $('#reset').addEventListener('click',()=>{edges=starter.map(e=>[...e]);undo.length=0;broken=null;selected=null;changed();announce('Back to the starting branches. Make a loop so light has another way.');});
  changed();announce('Everything is lit, but some links have no backup. Test a break to find one.');
  research({question:'What makes a connection strong?',finding:'In an undirected graph, a bridge is an edge whose removal disconnects part of a connected network. A cycle provides another route around any one of its edges.',model:'The game searches the actual graph from source E. It then removes each link in turn and repeats the search. “Fewest lit” reports the worst of those single-link failures. The challenge is edge resilience, not simply having many links.',limits:'All links are assumed to carry unlimited light at equal cost. Length, electrical resistance, physical crossings, congestion and node failure are omitted. A topology game is not an engineering safety assessment. The village is a separate strategy game with authored rules.',maths:'Success: reachable(E, G − edge) = 9 for every edge in G, within the link budget.',sources:[['NetworkX documentation · bridges in an undirected graph','https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.bridges.bridges.html']]});
}
