#!/usr/bin/env python3
"""Large audited full-game recap panels made from unchanged catalog artwork."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

parser=argparse.ArgumentParser();parser.add_argument('--project',type=Path,required=True);args=parser.parse_args();p=args.project
audit=json.loads((p/'review/content-count-audit.json').read_text());assert audit['edition']=='full'
out=p/'graphics/content-recap-v1';out.mkdir(exist_ok=True)
font=lambda size:ImageFont.truetype(str(p/'graphics/Inter.woff2'),size)
labels={'heroes':'HEROES','talents':'TALENTS','enemies':'ENEMIES','uniqueItems':'UNIQUES','trinkets':'TRINKETS'}
records=[]
for key,label in labels.items():
    bg=Image.new('RGBA',(1920,1080),'#08090d');draw=ImageDraw.Draw(bg)
    for radius in range(700,0,-8):
        c=int(8+24*(1-radius/700));draw.ellipse((1330-radius,510-radius,1330+radius,510+radius),fill=(c+8,9,17,255))
    arts=audit['assets'][key]
    if key=='heroes':arts=[arts[i] for i in [0,3,6,7]]
    else:arts=arts[:3]
    for i,item in enumerate(arts):
        size=(390,520) if key!='enemies' else (460,350)
        card=ImageOps.fit(Image.open(p/item['localArt']).convert('RGBA'),size,method=Image.Resampling.LANCZOS)
        mask=Image.new('L',size);ImageDraw.Draw(mask).rounded_rectangle((0,0,size[0]-1,size[1]-1),radius=24,fill=255);card.putalpha(mask)
        card=card.rotate([6,-4,4,-6][i],Image.Resampling.BICUBIC,expand=True)
        x=900+i*(185 if len(arts)==4 else 210);y=270+(i%2)*55
        bg.alpha_composite(card,(x,y))
    draw=ImageDraw.Draw(bg)
    draw.text((130,390),str(audit['fullCounts'][key]),font=font(240),fill='#fff0dd',stroke_width=1)
    draw.text((145,680),label,font=font(92),fill='#fff0dd')
    draw.text((148,820),'FULL GAME',font=font(46),fill='#d08b95')
    file=out/f'{key}.png';bg.convert('RGB').save(file)
    records.append({'category':key,'count':audit['fullCounts'][key],'file':str(file.relative_to(p)),'artIds':[a['id']for a in arts],'auditRevision':audit['revision']})
sheet=Image.new('RGB',(1920,720),'#08090d')
for i,record in enumerate(records):
    im=Image.open(p/record['file']).resize((640,360),Image.Resampling.LANCZOS);sheet.paste(im,((i%3)*640,(i//3)*360))
sheet.save(p/'review/content-recap-panels-contact.jpg',quality=94)
(out/'panels.json').write_text(json.dumps({'audit':'review/content-count-audit.json','panels':records,'readability':'Large counts and one-word labels; review at640px. Only nonboss enemy art underCountess track.','timing':'Not yet placed; align to measured instrumental tail accents after81.68s.'},indent=2)+'\n')
print(out)
