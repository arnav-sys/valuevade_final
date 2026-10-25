import { useEffect,useRef,useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Pause,Play,RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { buildBusinessScene } from './businessSceneObjects';
import { disposeScene } from '../landing/immersive/financeObjects';

export const BusinessScene = ({mode,id='enterprise-hero-3d'}) => {
  const host=useRef(null);const [active,setActive]=useState(1);const [paused,setPaused]=useState(false);const [reset,setReset]=useState(0);const [fallback,setFallback]=useState(false);
  const reduced=useReducedMotion();const settings=useRef({});settings.current={active,paused,reduced,reset};
  const labels=mode==='course'?['Research notes','Financial models','Analyst judgement']:['Source inputs','AI workflow','Human approval'];
  useEffect(()=>{
    const mount=host.current;if(!mount)return;setFallback(false);let renderer;
    try{
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});
      const context=renderer.getContext();
      if(!context||context.isContextLost()||!context.getParameter(context.MAX_TEXTURE_SIZE))throw new Error('Graphics context unavailable');
    }catch{renderer?.dispose();setFallback(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.dataset.testid=`${id}-canvas`;renderer.domElement.setAttribute('aria-hidden','true');mount.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-7,7,2,-2,.1,50);camera.position.set(0,2.15,13);camera.lookAt(0,0,0);
    scene.add(new THREE.HemisphereLight('#FFFFFF','#B9A6E0',2.9));const light=new THREE.DirectionalLight('#FFFFFF',3.2);light.position.set(-3,6,7);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-8;light.shadow.camera.right=8;scene.add(light);
    const {root,groups,connections,particles}=buildBusinessScene(scene,mode);let frame,visible=true,mobile=false,drag=false,lastX=0,angle=0,lastReset=0,clock=0,lastTime=0;
    const resize=()=>{const {width,height}=mount.getBoundingClientRect();if(!width||!height)return;mobile=width<650;const halfH=mobile?2.04:1.95;camera.left=-halfH*width/height;camera.right=-camera.left;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();renderer.setSize(width,height,false);};
    const observer=new ResizeObserver(resize);observer.observe(mount);resize();
    const intersection=new IntersectionObserver(([e])=>{visible=e.isIntersecting;});intersection.observe(mount);
    const render=time=>{frame=requestAnimationFrame(render);const delta=Math.min(time-lastTime,40);lastTime=time;if(!visible||document.hidden)return;const s=settings.current;
      if(s.reset!==lastReset){angle=0;lastReset=s.reset;}
      if(!s.paused&&!s.reduced)clock+=delta;
      root.rotation.y=THREE.MathUtils.lerp(root.rotation.y,angle,.1);
      groups.forEach((g,i)=>{g.visible=!mobile||i===s.active;g.position.x=mobile?0:[-3.7,0,3.7][i];g.position.y=(mode==='course'&&i===1?-.04:.04)+(s.reduced?0:Math.sin(clock*.001+i*1.7)*.07);g.rotation.y=mobile?-.1:[.18,-.06,-.18][i];g.scale.setScalar(mobile?(mode==='course'&&i===1?.85:1.08):(s.active===i?1.02:.91));});
      connections.forEach(c=>{c.visible=!mobile;});particles.forEach(({mesh,curve},i)=>{mesh.visible=!mobile;mesh.position.copy(curve.getPoint(((clock*.00024+i*.5)%1)));});
      try{renderer.render(scene,camera);}catch{cancelAnimationFrame(frame);setFallback(true);}
    };
    const down=e=>{drag=true;lastX=e.clientX;mount.setPointerCapture?.(e.pointerId);};const move=e=>{if(drag){angle=THREE.MathUtils.clamp(angle+(e.clientX-lastX)*.004,-.35,.35);lastX=e.clientX;}};const up=()=>{drag=false;};const lost=e=>{e.preventDefault();cancelAnimationFrame(frame);setFallback(true);};
    mount.addEventListener('pointerdown',down);mount.addEventListener('pointermove',move);mount.addEventListener('pointerup',up);mount.addEventListener('pointercancel',up);renderer.domElement.addEventListener('webglcontextlost',lost);frame=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();mount.removeEventListener('pointerdown',down);mount.removeEventListener('pointermove',move);mount.removeEventListener('pointerup',up);mount.removeEventListener('pointercancel',up);renderer.domElement.removeEventListener('webglcontextlost',lost);disposeScene(scene);renderer.dispose();renderer.domElement.remove();};
  },[mode,id]);
  return <div className="be-scene" data-testid={id} data-paused={paused||!!reduced} data-active={active}>
    <div ref={host} className="be-scene-canvas" style={{display:fallback?'none':undefined}}/>
    {fallback&&<img className="be-scene-fallback" src={mode==='course'?'/brand/roadmap-art.webp':'/brand/claude-art.webp'} alt={mode==='course'?'Finance learning and analysis':'AI-assisted finance workflows'} data-testid={`${id}-fallback`}/>}
    <div className="be-scene-toolbar"><div className="be-scene-modes" aria-label="Workspace focus">{labels.map((label,i)=><button key={label} disabled={fallback} onClick={()=>setActive(i)} aria-pressed={active===i} data-testid={`${id}-focus-${i}`}>{label}</button>)}</div><div className="be-scene-actions"><button disabled={fallback} aria-label="Reset 3D view" title="Reset 3D view" onClick={()=>{setReset(r=>r+1);setActive(1);}} data-testid={`${id}-reset`}><RotateCcw size={15}/></button><button disabled={fallback} aria-label={paused?'Play 3D animation':'Pause 3D animation'} title={paused?'Play animation':'Pause animation'} onClick={()=>setPaused(p=>!p)} data-testid={`${id}-pause`}>{paused?<Play size={15}/>:<Pause size={15}/>}</button></div></div>
    <p className="be-scene-caption" data-testid={`${id}-caption`}>ILLUSTRATIVE {mode==='course'?'LEARNING WORKSPACE':'AGENT WORKFLOW'} · HUMAN JUDGEMENT AT THE CENTRE</p>
  </div>;
};