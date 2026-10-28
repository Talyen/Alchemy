#!/usr/bin/env python3
"""Controlled short transition comparisons: identical source time and audio."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

parser=argparse.ArgumentParser();parser.add_argument('--project',type=Path,required=True);parser.add_argument('--revision',default='v1');args=parser.parse_args();p=args.project.resolve()
spec=importlib.util.spec_from_file_location('edit',p/'scripts/edit.py');edit=importlib.util.module_from_spec(spec);spec.loader.exec_module(edit)
out=p/'review'/f'transition-options-{args.revision}'
if out.exists() and any(out.iterdir()):raise RuntimeError('Preserve existing comparisons;choose a fresh revision')
out.mkdir(parents=True,exist_ok=True)
base=p/'finals/06-countess-music-video-opening-v1.mp4';base_receipt=edit.read(base.with_suffix('.json'));assert edit.digest(base)==base_receipt['sha256']
capture=edit.read(p/'sources/music-video-opening-v2/capture.json');source=p/'sources/music-video-opening-v2/clips/opening-performance.mp4';assert edit.digest(source)==capture['clips']['opening-performance']['sha256']
start=226/60;duration=4;cut=1
pcm=out/'common-audio.wav';aac=out/'common-audio.m4a'
edit.ff(['-i',base,'-ss',start,'-t',duration,'-vn','-ar',48000,'-ac',2,'-c:a','pcm_s24le',pcm])
edit.ff(['-i',pcm,'-c:a','aac','-b:a','192k','-ar',48000,'-ac',2,aac])

def mask_frames(name,count,shape):
    folder=out/name;folder.mkdir()
    planes=[]
    for i in range(count):
        progress=i/(count-1)
        if not shape:im=Image.new('L',(1920,1080),round(progress*255))
        elif i in [0,count-1]:im=Image.new('L',(1920,1080),0 if i==0 else 255)
        else:
            # Revealing a tilted card silhouette changes only the matte;both views stay locked.
            factor=progress*progress*(3-2*progress);h=5200*factor;w=h*.75;angle=math.radians(-12)
            points=[(int(1248+x*math.cos(angle)-y*math.sin(angle)),int(475+x*math.sin(angle)+y*math.cos(angle)))for x,y in [(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]]
            im=Image.new('L',(3840,2160));ImageDraw.Draw(im).polygon([(x*2,y*2)for x,y in points],fill=255)
            im=im.resize((1920,1080),Image.Resampling.LANCZOS)
        im.save(folder/f'{i:02}.png')
        # Raw equal-valued planes prevent PNG grayscale conversion from mapping
        # the matte endpoints to limited-range16/235 and leaving a ghost image.
        channel=im.tobytes();planes.append(channel*3)
    raw=folder/'full-range-matte.yuv';raw.write_bytes(b''.join(planes))
    return raw

def crop(label,z,cx,cy):
    return f"[{label}]crop=w='floor(iw/{z}/32)*32':h='floor(ih/{z}/18)*18':x='floor(max(0,min(iw-ow,iw*{cx}-ow/2))/2)*2':y='floor(max(0,min(ih-oh,ih*{cy}-oh/2))/2)*2',scale=1920:1080:flags=lanczos:out_color_matrix=bt709,format=yuv444p"

variants=[('A-clean-impact-cut',None,0,0),('B-card-shaped-wipe','card-masks',56,8),('C-fast-dissolve','dissolve-masks',57,6)]
records=[]
for name,matte,first,count in variants:
    target=out/f'{name}.mp4'
    inputs=['-ss',start,'-i',base]
    filters=['[0:v]trim=end_frame=240,setpts=PTS-STARTPTS,format=yuv444p[base]']
    last='base';audio_index=1
    if matte:
        mask=mask_frames(matte,count,matte=='card-masks')
        absolute=start+first/60
        inputs+=['-ss',absolute,'-i',source,'-f','rawvideo','-pixel_format','yuv444p','-video_size','1920x1080','-framerate',60,'-i',mask]
        filters += [f'[1:v]trim=end_frame={count},setpts=PTS-STARTPTS,split=2[h][w]',crop('h',1.6,.5,.72)+'[hand]',crop('w',1.125,.49,.57)+'[wide]','[2:v]format=yuv444p[mask]','[hand][wide][mask]maskedmerge[blend]',f'[blend]setpts=PTS+{first}/60/TB[effect]',f"[base][effect]overlay=eof_action=pass:repeatlast=0:enable='gte(t,{first/60})*lt(t,{(first+count)/60})'[combined]"]
        last='combined';audio_index=3
    filters += [f'[{last}]format=yuv420p,setsar=1,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709[out]']
    inputs += ['-i',aac]
    edit.ff([*inputs,'-filter_complex_threads',1,'-filter_complex',';'.join(filters),'-map','[out]','-map',f'{audio_index}:a','-c:v','libx264','-preset','fast','-profile:v','high','-level:v','4.2','-b:v','10M','-maxrate','14M','-bufsize','20M','-g',120,'-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-bsf:v','h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1','-threads',2,'-c:a','copy','-frames:v',240,'-t',4,'-movflags','+faststart',target])
    meta=edit.probe(target,True);v=next(s for s in meta['streams']if s['codec_type']=='video');a=next(s for s in meta['streams']if s['codec_type']=='audio')
    assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_read_frames']))==(1920,1080,'60/1',240)
    assert a['codec_name']=='aac' and a['channels']==2 and a['sample_rate']=='48000'
    assert target.stat().st_size<20_000_000
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(target),'-vn','-c:a','copy','-f','adts','pipe:1'])
    records.append({'name':name,'file':str(target.relative_to(p)),'sha256':edit.digest(target),'bytes':target.stat().st_size,'audioAdtsSha256':hashlib.sha256(raw).hexdigest(),'transitionFrames':[first,first+count]if matte else[60,60],'sourceSongRange':[start,start+4],'frames':240,'fps':60,'dimensions':[1920,1080]})
    print(name,'ready',flush=True)
assert len({r['audioAdtsSha256']for r in records})==1
sheet=Image.new('RGB',(1920,3*252),'#0a0d10');draw=ImageDraw.Draw(sheet);font=ImageFont.truetype(str(p/'graphics/Inter.woff2'),20)
for row,record in enumerate(records):
    for col,frame in enumerate([55,58,60,62,65]):
        file=out/f'{record["name"]}-{frame}.jpg';edit.ff(['-ss',frame/60,'-i',p/record['file'],'-frames:v',1,'-q:v',2,file]);im=Image.open(file).convert('RGB').resize((384,216),Image.Resampling.LANCZOS);sheet.paste(im,(col*384,row*252));draw.text((col*384+8,row*252+221),f'{record["name"][0]} / {frame}/60s',font=font,fill='#ead7b7')
sheet.save(out/'transition-comparison-contact.jpg',quality=94)
edit.write(out/'comparison.json',{'baseMaster':str(base.relative_to(p)),'baseSha256':base_receipt['sha256'],'sameSourceFrames':True,'sameMusicAndSoundTiming':True,'audioPacketsIdentical':True,'audioNote':'Same source audio decoded at an exact sample boundary and encoded once;the sameAACpackets are copied into all3files.','onlyChange':'Transition at local1.000s/song4.766667s;all other cuts and content match. Mattinguses two locked views of the same native frame,withoutretiming/freezes/camera motion.','impactReadability':'Wipe finishes1.067s;dissolve1.05s,before the damage pop peak around1.085s.','variants':records,'contactSheet':str((out/'transition-comparison-contact.jpg').relative_to(p)),'listeningApproval':False})
print(json.dumps(records,indent=2))
