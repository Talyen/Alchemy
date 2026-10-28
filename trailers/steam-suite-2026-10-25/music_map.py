#!/usr/bin/env python3
"""Measure Countess accents and native lyric anchors; no listening signoff."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import numpy as np
from scipy import signal, ndimage

p = argparse.ArgumentParser()
p.add_argument('--project', type=Path, required=True)
args = p.parse_args()
project = args.project
song = project / 'audio/countess.mp3'
lyrics = json.loads((project / 'sources/countess-performance/assets/lyrics.json').read_text())
sr, hop = 22050, 256
y = np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-threads','1','-i',str(song),'-t','96','-ac','1','-ar',str(sr),'-f','f32le','pipe:1']),dtype='<f4')
f, times, z = signal.stft(y, fs=sr, nperseg=2048, noverlap=2048-hop)
flux = ndimage.gaussian_filter1d(np.maximum(0,np.diff(np.log1p(abs(z)*1000),axis=1)).mean(axis=0),1)
times = times[1:]
peaks, _ = signal.find_peaks(flux, distance=round(.13*sr/hop), prominence=.002)
def marker(t, strength=None):
    frame = round(float(t)*60)
    return {'measuredSeconds':round(float(t),6),'frame':frame,'seconds':frame/60,'strength':None if strength is None else round(float(strength),6)}
onsets = [marker(times[i],flux[i]) for i in peaks]
beats = []
last, period = 3.285624, .743
while last < 95:
    candidates = [i for i in peaks if abs(float(times[i])-last)<.105]
    if candidates:
        i = max(candidates,key=lambda i:float(flux[i])*np.exp(-((times[i]-last)/.07)**2))
        measured = float(times[i]); beats.append(marker(measured,flux[i]))
    else:
        measured=last; beats.append({**marker(measured),'inferred':True})
    if len(beats)>1:
        delta=measured-beats[-2]['measuredSeconds']
        if .64<delta<.85: period=.96*period+.04*delta
    last=measured+period
lines=[]
for line in lyrics['lines']:
    if line['timings'][0]>96:break
    words=line['text'].split()
    lines.append({'text':line['text'],'start':line['timings'][0],'end':line['timings'][-1],'startFrame':int(np.ceil(line['timings'][0]*60)),'endFrame':int(np.ceil(line['timings'][-1]*60)),'nativeWordPairs':line['timings']})
gaps=[];previous=0
for line in lines:
    if line['start']-previous>=.3:gaps.append({'start':previous,'end':line['start'],'duration':round(line['start']-previous,3)})
    previous=line['end']
gaps.append({'start':previous,'end':92.5,'duration':92.5-previous})
threshold=float(np.percentile(flux,85))
data={'version':1,'song':'audio/countess.mp3','songSha256':hashlib.sha256(song.read_bytes()).hexdigest(),'analysisRangeSeconds':[0,96],'fps':60,'method':'22050Hz mono,2048 STFT,256-hop whitened positive spectral flux; measured onsets snap to nearest60fps frame. Adaptive ~80BPM pulse is a guide,not a verified metronome. Native lyrics provide authoritative phrase anchors.','listeningApproval':False,'onsets':onsets,'pulse':beats,'strongAccents':[x for x in onsets if x['strength']>=threshold],'nativeLyricLines':lines,'vocalGaps':gaps,'phraseAnchors':{'verse':20.68,'preChorus':46.32,'chorus':55.78,'lastChorusWordEnd':81.68,'candidateTail':[88.5,92.5]},'editorialRule':'Use measured accents for cuts and target accepted card impacts; vary half/whole/phrase spacing. Never retime visible native lyrics.'}
out=project/'audio/countess-song-map-v1.json';out.write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({'map':str(out),'onsets':len(onsets),'pulse':len(beats),'strongAccents':len(data['strongAccents']),'openingPulse':beats[:17],'vocalGaps':gaps},indent=2))
