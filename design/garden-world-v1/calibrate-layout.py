"""Read-only PNG analysis; emits source rectangles/anchors without editing pixels."""
from PIL import Image
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'frontend/src/assets/garden/monsters'

def components(im, bounds, predicate):
    pix = im.load(); x0,y0,x1,y1 = bounds; seen = set(); result=[]
    for y in range(y0,y1):
        for x in range(x0,x1):
            if (x,y) in seen or not predicate(pix[x,y]): continue
            stack=[(x,y)];seen.add((x,y));xs=[];ys=[]
            while stack:
                px,py=stack.pop();xs.append(px);ys.append(py)
                for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
                    if x0<=nx<x1 and y0<=ny<y1 and (nx,ny) not in seen and predicate(pix[nx,ny]):
                        seen.add((nx,ny));stack.append((nx,ny))
            result.append((len(xs),min(xs),min(ys),max(xs)+1,max(ys)+1))
    return result

layout={}
for sheet, filename, keys, rowbounds in [
    ('creeps','creeps-v1.png',['crawler','scout','phantom','replicator','shielder','titan'],[0,208,419,621,823,1042,1254]),
    ('bosses','bosses-v2.png',['boss_overlord','boss_devourer'],[0,512,1024])]:
    im=Image.open(ASSETS/filename); W,H=im.size
    full = components(im,(0,0,W,H),lambda p:p[3]>200) if sheet=='bosses' else None
    for row,key in enumerate(keys):
        frames=[]
        for col in range(4):
            x0,y0,x1,y1=round(col*W/4),rowbounds[row],round((col+1)*W/4),rowbounds[row+1]
            if full:
                candidates=[c for c in full if c[0]>15000 and y0<(c[2]+c[4])/2<y1]
                _,bx,by,ex,ey=min(candidates,key=lambda c:abs((c[1]+c[3])/2-(col+.5)*W/4))
                x0,y0,x1,y1=max(0,bx-4),max(0,by-4),min(W,ex+4),min(H,ey+4)
            alpha=im.getchannel('A').crop((x0,y0,x1,y1)).point(lambda p:255 if p>=128 else 0).getbbox()
            bx,by,ex,ey=alpha;bx=max(x0,x0+bx-3);by=max(y0,y0+by-3);ex=min(x1,x0+ex+3);ey=min(y1,y0+ey+3)
            cc=components(im,(x0,y0,x1,y1),lambda p:p[3]>150 and p[0]<40 and p[1]<85 and p[2]<90)
            eyes=[]
            for area,l,t,r,b in cc:
                w,h=r-l,b-t
                if 70<area<3000 and 1.6<h/w<5 and 15<h<80:eyes.append([(l+r)/2,(t+b)/2,w,h])
            pairs=[(a,b) for i,a in enumerate(eyes) for b in eyes[i+1:] if (40 if sheet=='creeps' else 55)<abs(a[0]-b[0])<(65 if sheet=='creeps' else 110) and abs(a[1]-b[1])<18 and abs(a[3]-b[3])<8]
            a,b=min(pairs,key=lambda p:abs(p[0][1]-p[1][1])+abs(p[0][3]-p[1][3]))
            ax=(a[0]+b[0])/2;ay=(a[1]+b[1])/2+(a[3]+b[3])*.125
            frames.append([bx,by,ex-bx,ey-by,round(ax,2),round(ay,2),round(abs(a[0]-b[0])*3.1,2)])
        layout[key]={'sheet':sheet,'filename':filename,'frames':frames}
(ASSETS/'layout-v1.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2)+'\n')
js=ROOT/'frontend/src/arcade/garden-world-art.js'
source=js.read_text(); start=source.index('/* MONSTER_LAYOUT */');end=source.index(';',start)
js.write_text(source[:start]+'/* MONSTER_LAYOUT */ '+json.dumps(layout,separators=(',',':'))+source[end:])
print('Calibrated',sum(len(entry['frames']) for entry in layout.values()),'frames')
