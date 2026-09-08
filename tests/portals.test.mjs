import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { Clock, rng, signalField, brier, forecastWorld, posteriorMean, calibration, makeBall, stepBall, energies, bounceHeight, reachable, networkReport, makeFlock, stepFlock, flockReport, stepPilot } from '../portals/core.js';
import { portals, portalUrl } from '../portals/catalog.js';
import { fmt } from '../portals/ui.js';

test('all eleven leaf portals and every native asset resolve at root and project subpaths', async () => {
  assert.equal(portals.length,11);
  assert.equal(new Set(portals.map(p=>p.id)).size,11);
  for(const portal of portals) {
    const url=portalUrl(portal.id,new URL('https://example.org/one/portals/'));
    assert.ok(url.startsWith('https://example.org/one/'));
    await access(new URL(`../${new URL(url).pathname.replace('/one/','')}index.html`,import.meta.url));
    assert.ok(portals.some(p=>p.id===portal.next));
  }
  const files=(await readdir(new URL('../portals/',import.meta.url),{recursive:true})).filter(f=>f.endsWith('.html')||f.endsWith('.js'));
  for(const file of files) {
    const base=new URL(`../portals/${file}`,import.meta.url),text=await readFile(base,'utf8');
    for(const match of text.matchAll(/(?:src|href)="(\.{1,2}\/[^"$<>]+)"/g)) {
      const target=new URL(match[1].replaceAll('&amp;','&').split(/[?#]/)[0],base);
      await access(target.pathname.endsWith('/')?new URL('index.html',target):target);
    }
    for(const match of text.matchAll(/(?:from\s*|import\()['"](\.{1,2}\/[^'"]+)['"]/g))await access(new URL(match[1],base));
  }
});

test('perception has a real non-tied majority, unchanged by repeated inspection',()=>{
  for(let seed=0;seed<25;seed++)for(let round=0;round<8;round++){
    const f=signalField(seed,round);
    assert.equal(f.values.length,48);assert.notEqual(f.rightCount,24);
    assert.equal(f.values.filter(Boolean).length,f.rightCount);
    assert.equal(f.rightCount>24,f.right);assert.deepEqual(signalField(seed,round),f);
  }
});

test('probability scores reward truthful forecasts in expectation and keep empty bins honest',()=>{
  assert.equal(brier(.7,true),.09000000000000002);assert.equal(brier(.5,false),.25);
  for(const truth of [.2,.35,.65,.8]){
    const expected=p=>truth*brier(p,true)+(1-truth)*brier(p,false);
    for(const report of [0,.1,.5,.9,1])assert.ok(expected(truth)<=expected(report)+1e-12);
  }
  const world=forecastWorld(451);assert.deepEqual(forecastWorld(451),world);assert.equal(world.future.length,12);
  assert.equal(posteriorMean([]),.5);assert.equal(posteriorMean([true,true,false]),.6);
  const bins=calibration([{p:0,y:false},{p:.25,y:true},{p:.5,y:false},{p:1,y:true}]);
  assert.deepEqual(bins.map(b=>b.n),[1,1,1,1]);assert.equal(calibration([])[0].n,0);
});

test('timers exclude paused and hidden time, end once, and never display 0:60',()=>{
  const c=new Clock(120);c.start(0);c.tick(10500);c.pause(11000);c.tick(600000);assert.equal(c.elapsed,11);
  c.start(900000);c.tick(909000);assert.equal(c.elapsed,20);
  c.tick(1200000);assert.equal(c.elapsed,120);assert.equal(c.done,true);assert.equal(c.running,false);
  c.start(1500000);c.tick(1501000);assert.equal(c.elapsed,120);
  assert.equal(fmt(59.9),'1:00');assert.equal(fmt(60.1),'1:01');assert.equal(fmt(0),'0:00');
});

test('ballistics conserves the full energy account through many inelastic impacts',()=>{
  for(const gravity of [1.62,9.81])for(const mass of [.5,1,3])for(const restitution of [0,.1,.5,.8,.95,1]){
    let ball=makeBall({height:3,mass,gravity,restitution});
    for(let frame=0;frame<2400;frame++){
      ball=stepBall(ball,1/60);const e=energies(ball);
      assert.ok(ball.y>=-1e-10);assert.ok(e.height>=0&&e.motion>=0&&e.surroundings>=-1e-8);
      assert.ok(Math.abs(e.height+e.motion+e.surroundings-ball.initial)<1e-7);
    }
  }
});

test('bounce height uses squared speed restitution and mass does not change the trajectory',()=>{
  assert.ok(Math.abs(bounceHeight(3,.8)-1.92)<1e-12);
  let a=makeBall({height:5,mass:.5,restitution:.7}),b=makeBall({height:5,mass:3,restitution:.7});
  for(let i=0;i<400;i++){a=stepBall(a,.016);b=stepBall(b,.016);assert.equal(a.y,b.y);assert.equal(a.v,b.v);}
  const one=stepBall(makeBall({height:3}),2);
  let many=makeBall({height:3});for(let i=0;i<120;i++)many=stepBall(many,1/60);
  assert.ok(Math.abs(one.y-many.y)<1e-10);assert.ok(Math.abs(one.v-many.v)<1e-10);
});

test('a loop survives every single-link failure; a tree and a disconnected graph do not',()=>{
  const ring=Array.from({length:9},(_,i)=>[i,(i+1)%9]);
  assert.equal(networkReport(ring).resilient,true);assert.equal(networkReport(ring).worst.reached,9);
  assert.equal(networkReport(ring.slice(0,8)).resilient,false);
  const disconnected=[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[6,7],[7,8],[8,6]];
  assert.equal(networkReport(disconnected).resilient,false);assert.equal(reachable(disconnected).size,3);
  assert.equal(networkReport([]).working,1);
});

test('paired flocks reproduce exactly, stay bounded, and expose actual order instead of scripted scores',()=>{
  let a=makeFlock(85),b=makeFlock(85);const rules={space:1.4,align:1,near:.6};const before=structuredClone(a);
  for(let i=0;i<180;i++){a=stepFlock(a,rules,1/60);b=stepFlock(b,rules,1/60);}
  assert.deepEqual(a,b);assert.deepEqual(makeFlock(85),before);
  assert.notDeepEqual(a,stepFlock(a,{space:0,align:0,near:0},1/60));
  for(const p of a){assert.ok(p.x>=0&&p.x<600&&p.y>=0&&p.y<360);assert.ok(Math.hypot(p.vx,p.vy)>=24-1e-8&&Math.hypot(p.vx,p.vy)<=65+1e-8);}
  assert.ok(flockReport(a).alignment>=0&&flockReport(a).alignment<=1+1e-10);
  assert.equal(flockReport([{x:10,y:10,vx:1,vy:0},{x:100,y:10,vx:1,vy:0}]).alignment,1);
  assert.equal(flockReport([{x:10,y:10,vx:1,vy:0},{x:100,y:10,vx:-1,vy:0}]).alignment,0);
});

test('pilot motion preserves inertia, allows braking, and requires position AND low speed to dock',()=>{
  const initial={x:100,v:20,target:440,hold:0,time:0};
  const coast=stepPilot(initial,0,0,.5);assert.equal(coast.x,110);assert.equal(coast.v,20);
  assert.equal(stepPilot(initial,-1,0,.1).v,11);
  assert.equal(stepPilot({...initial,x:440,v:30},0,0,.1).hold,0);
  let dock={...initial,x:440,v:0};for(let i=0;i<91;i++)dock=stepPilot(dock,0,0,1/60);assert.ok(dock.hold>=1.5);
  assert.equal(stepPilot({...initial,x:440,v:0},0,10,1).v,10);
});
