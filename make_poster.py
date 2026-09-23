from PIL import Image, ImageDraw, ImageFont
import math, random
W,H=1400,2000
im=Image.new('RGB',(W,H),(10,28,55)); d=ImageDraw.Draw(im)
# gradient background
for y in range(H):
    t=y/H
    c=(10+int(8*t),28+int(20*t),55+int(18*t))
    d.line((0,y,W,y),fill=c)
# stars and grid
random.seed(4)
for _ in range(180):
    x=random.randrange(50,W-50); y=random.randrange(80,H-80); r=random.choice([1,1,2,3])
    d.ellipse((x-r,y-r,x+r,y+r),fill=(80,145,170))
for x in range(80,W,160): d.line((x,260,x,H-120),fill=(24,59,82),width=2)
for y in range(280,H-100,160): d.line((70,y,W-70,y),fill=(24,59,82),width=2)
# title
font_b='/System/Library/Fonts/STHeiti Medium.ttc'; font='/System/Library/Fonts/STHeiti Light.ttc'
def txt(xy,s,size,fill,anchor='la',stroke=0): d.text(xy,s,font=ImageFont.truetype(font_b,size),fill=fill,anchor=anchor,stroke_width=stroke,stroke_fill=(7,20,37))
txt((90,110),'守 护 萝 卜',92,(255,190,58),stroke=3)
txt((95,220),'THE CARROT DEFENSE',28,(157,222,196))
d.line((95,275,1305,275),fill=(255,190,58),width=4)
# circular arena
cx,cy=700,1110
for r,col,w in [(500,(36,94,106),12),(430,(238,165,46),8),(365,(47,117,92),6)]: d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=col,width=w)
# path arcs
for ang in range(0,360,30):
    a=math.radians(ang); x=cx+430*math.cos(a); y=cy+430*math.sin(a)
    d.ellipse((x-10,y-10,x+10,y+10),fill=(255,213,96))
# winding path
pts=[]
for i in range(220):
    a=i/219*math.pi*2*1.5; r=260+70*math.sin(i/18)
    pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
d.line(pts,fill=(219,180,88),width=28,joint='curve'); d.line(pts,fill=(244,218,139),width=8,joint='curve')
# carrot central
d.ellipse((cx-105,cy-145,cx+105,cy+160),fill=(244,116,32),outline=(255,193,75),width=8)
d.polygon([(cx-70,cy-130),(cx-130,cy-245),(cx-18,cy-165),(cx+25,cy-265),(cx+65,cy-150),(cx+145,cy-215),(cx+86,cy-95)],fill=(81,181,91),outline=(157,235,133))
d.ellipse((cx-50,cy-15,cx-25,cy+15),fill=(24,42,51)); d.ellipse((cx+28,cy-15,cx+53,cy+15),fill=(24,42,51))
d.arc((cx-50,cy+5,cx+52,cy+75),10,165,fill=(90,47,36),width=8)
# towers around
for ang in [25,115,205,295]:
    a=math.radians(ang); x=int(cx+300*math.cos(a)); y=int(cy+300*math.sin(a))
    d.ellipse((x-58,y-58,x+58,y+58),fill=(57,143,177),outline=(168,239,219),width=6)
    d.polygon([(x-22,y-18),(x+65,y-42),(x+78,y-18),(x-10,y+10)],fill=(255,190,58))
    d.ellipse((x-18,y-20,x+18,y+16),fill=(16,43,69))
# labels
for ang,label in [(25,'LV. 08'),(115,'LV. 12'),(205,'WAVE 24'),(295,'BOSS')]:
    a=math.radians(ang); x=int(cx+540*math.cos(a)); y=int(cy+540*math.sin(a)); txt((x,y),label,24,(174,222,204),'mm')
# footer
for i,s in enumerate(['每一口新鲜空气','都是守住家园的力量','START  /  01']): txt((90,1640+i*75),s,34 if i<2 else 26,(220,243,226))
txt((W-90,1880),'橙色警戒线 · 绿色生长区',24,(255,190,58),'ra')
im.save('/Users/edy/myProject/aabbBox/carrot_defense_poster.png',quality=95)
