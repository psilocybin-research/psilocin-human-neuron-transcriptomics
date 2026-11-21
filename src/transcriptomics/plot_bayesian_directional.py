"""Publication-ready plots for the exploratory directional score comparison."""
from pathlib import Path
import csv
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm
from matplotlib.backends.backend_pdf import PdfPages
ROOT=Path(__file__).resolve().parents[2]
data=json.loads((ROOT/'explorer/src/data/bayesian-directional.json').read_text())
out=ROOT/'figures/bayesian_directional'
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none','pdf.fonttype':42,'axes.titleweight':'bold'})
colors={'Day 1':'#235780','Day 3':'#a45114'}
metadata={'Title':'Exploratory OXPHOS directional evidence','Author':'Christopher B. Germann','Subject':'Positive versus nonpositive paired expression-score shifts; not a point-null test','Keywords':'OXPHOS, Bayesian, prior sensitivity, three blocks, exploratory; input SHA256 '+data['provenance']['input_sha256'],'Creator':'Matplotlib; versioned paired scores and directional quadrature; https://psilocybin-research.github.io/psilocin-human-neuron-transcriptomics/#view=bayesian'}
fig,axes=plt.subplots(1,3,figsize=(13.4,4.3),layout='constrained')
ax=axes[0]
for i,r in enumerate(data['scores']):
 ax.plot([0,1],[float(r['day1_vs_control']),float(r['day3_vs_control'])],marker=['o','s','^'][i],lw=1.5,label=r['block'].replace('__',' / '))
ax.axhline(0,color='#84969d',ls='--',lw=1);ax.set(xticks=[0,1],xticklabels=['Day 1','Day 3'],ylabel='Observed paired score difference',title='A  Three block observations',ylim=(-.025,.51));ax.legend(fontsize=8,loc='upper right');ax.grid(axis='y',alpha=.15)
ax=axes[1]
for day,col in colors.items():
 d=[r for r in data['density'] if r['day']==day]
 x=[r['score'] for r in d];ax.plot(x,[r['posterior_density'] for r in d],color=col,label=f'{day} posterior',lw=2)
ax.plot(x,[r['prior_density'] for r in d],color='#66757b',ls='--',label='Common effect prior')
ax.axvline(0,color='#84969d',lw=1);ax.axvspan(0,1.25,color='#235780',alpha=.04);ax.set(xlim=(-.8,1),xlabel='Mean paired score shift',ylabel='Density',title='B  Baseline prior and posterior');ax.legend(fontsize=8)
ax=axes[2]
for i,day in enumerate(colors):
 rows=[r for r in data['settings'] if r['day']==day and r['eta']==2]
 for j,r in enumerate(rows):
  base=r['effect_sd']==.5 and r['residual_sd']==.5;y=i+(j-4)*.07
  ax.plot([r['lower95'],r['upper95']],[y,y],color=colors[day],alpha=1 if base else .4,lw=2.8 if base else 1)
  ax.scatter(r['mean'],y,color=colors[day],s=35 if base else 9,zorder=3)
ax.axvline(0,color='#84969d',ls='--',lw=1);ax.set(yticks=[0,1],yticklabels=['Day 1','Day 3'],xlabel='Mean paired score shift',title='C  All nine prior settings');ax.invert_yaxis();ax.set_xlabel('Mean paired score shift\nThick bars: baseline; thin bars: other priors');ax.grid(axis='x',alpha=.15)
fig.suptitle('OXPHOS expression-score uncertainty · exploratory follow-up',fontsize=14)
fig.savefig(out/'directional_uncertainty.svg',metadata={'Title':metadata['Title'],'Description':metadata['Subject'],'Creator':metadata['Author']})
fig.savefig(out/'directional_uncertainty.pdf',metadata=metadata)
fig.savefig(out/'directional_uncertainty.png',dpi=190,metadata=metadata)
fig2,axes=plt.subplots(1,3,figsize=(12.5,4.2),layout='constrained',gridspec_kw={'width_ratios':[1,1,1.1]})
for ax,(day,col) in zip(axes[:2],colors.items()):
 grid=np.array([[next(r['log10_bf'] for r in data['settings'] if r['day']==day and r['eta']==2 and r['effect_sd']==e and r['residual_sd']==s) for e in [.25,.5,1]] for s in [.25,.5,1]])
 im=ax.imshow(grid,cmap='BrBG',norm=TwoSlopeNorm(vmin=-2.5,vcenter=0,vmax=2.5),origin='lower')
 for i in range(3):
  for j in range(3):ax.text(j,i,f'{grid[i,j]:.2f}',ha='center',va='center',color='white' if abs(grid[i,j])>1.7 else '#18292f',weight='bold')
 ax.set(xticks=range(3),xticklabels=['0.25','0.5','1'],yticks=range(3),yticklabels=['0.25','0.5','1'],xlabel='Effect-prior SD',ylabel='Residual-SD prior scale',title=f'{day} · log₁₀ BF+/−')
 ax.add_patch(plt.Rectangle((.5,.5),1,1,fill=False,color='black',lw=2))
fig2.colorbar(im,ax=list(axes[:2]),shrink=.75,label='log₁₀ BF+/− (0 = equal directional evidence)')
ax=axes[2]
for day,col in colors.items():
 r=sorted([r for r in data['settings'] if r['day']==day and r['effect_sd']==.5 and r['residual_sd']==.5],key=lambda r:r['eta'])
 ax.plot([v['eta'] for v in r],[v['log10_bf'] for v in r],marker='o',color=col,label=day)
ax.axhline(0,color='#84969d',ls='--',lw=1);ax.set(xticks=[1,2,4],xlabel='Correlation prior · LKJ eta',ylabel='log₁₀ BF+/−',title='Correlation-prior sensitivity');ax.legend();ax.grid(axis='y',alpha=.15)
fig2.suptitle('Directional evidence depends on the specified prior · H+: μ > 0 versus H−: μ ≤ 0',fontsize=13)
fig2.savefig(out/'directional_prior_sensitivity.svg',metadata={'Title':'OXPHOS directional prior sensitivity','Description':metadata['Subject'],'Creator':metadata['Author']})
fig2.savefig(out/'directional_prior_sensitivity.pdf',metadata=metadata)
fig2.savefig(out/'directional_prior_sensitivity.png',dpi=190,metadata=metadata)
# JASP-inspired presentation, retaining the declared sign-restricted model.
fig3,axes=plt.subplots(2,2,figsize=(10.5,8.2),layout='constrained')
maximum=max(max(r['posterior_density'],r['prior_density']) for r in data['density'])
for column,(day,col) in enumerate(colors.items()):
 ax=axes[0,column]
 d=[r for r in data['density'] if r['day']==day]
 baseline=next(r for r in data['settings'] if r['day']==day and r['effect_sd']==.5 and r['residual_sd']==.5 and r['eta']==2)
 x=[r['score'] for r in d]
 ax.axvspan(0,1.25,color=col,alpha=.045)
 ax.plot(x,[r['prior_density'] for r in d],color='#687a85',ls='--',label='Prior')
 ax.plot(x,[r['posterior_density'] for r in d],color=col,lw=2,label='Posterior')
 ax.axvline(0,color='#83969e',ls=':',lw=1)
 ax.plot([baseline['lower95'],baseline['upper95']],[-.13*maximum]*2,color=col,lw=3)
 ax.plot(baseline['mean'],-.13*maximum,'o',color=col)
 ax.text(.5,-.25*maximum,f"Mean {baseline['mean']:.3f}; 95% CrI {baseline['lower95']:.3f} to {baseline['upper95']:.3f}",transform=ax.get_yaxis_transform(),ha='center',fontsize=8)
 ax.text(-.5,maximum,'H−: μ ≤ 0',ha='center',fontsize=9,color='#536771')
 ax.text(.6,maximum,'H+: μ > 0',ha='center',fontsize=9,color='#536771')
 ax.set(xlim=(-1,1.25),ylim=(-.31*maximum,1.08*maximum),yticks=np.arange(0,maximum,1),xlabel='Mean paired OXPHOS score shift',ylabel='Density',title=f"{day} · BF+/− {baseline['bf_positive_nonpositive']:.2f}")
 ax.legend(fontsize=8,loc='upper left',bbox_to_anchor=(0,.92))
 ax=axes[1,column]
 for residual,c in zip([.25,.5,1],['#235780','#a45114','#26734d']):
  rows=sorted([r for r in data['settings'] if r['day']==day and r['eta']==2 and r['residual_sd']==residual],key=lambda r:r['effect_sd'])
  ax.plot([r['effect_sd'] for r in rows],[r['bf_positive_nonpositive'] for r in rows],marker='o',lw=1.5,color=c,label=f'Residual scale {residual:g}')
 ax.scatter([.5],[baseline['bf_positive_nonpositive']],s=100,facecolors='none',edgecolors='black',lw=1.5,zorder=5)
 ax.axhline(1,color='#687a85',ls='--',lw=1)
 ax.set_xscale('log',base=2);ax.set_yscale('log')
 ax.set(xlim=(.23,1.08),ylim=(1/3,300),xticks=[.25,.5,1],xticklabels=['0.25','0.5','1'],yticks=[1/3,1,3,10,30,100,300],yticklabels=['⅓','1','3','10','30','100','300'],xlabel='Effect-prior SD',ylabel='BF+/− · logarithmic scale',title=f'{day} · prior-width robustness')
 ax.grid(axis='y',alpha=.15);ax.legend(fontsize=8,loc='lower left')
fig3.suptitle('Positive versus nonpositive OXPHOS score shifts · exploratory follow-up',fontsize=13)
fig3.savefig(out/'directional_annotated_evidence.svg',metadata={'Title':'Annotated directional evidence and prior-width robustness','Description':metadata['Subject'],'Creator':metadata['Author']})
fig3.savefig(out/'directional_annotated_evidence.pdf',metadata=metadata)
fig3.savefig(out/'directional_annotated_evidence.png',dpi=190,metadata=metadata)
with PdfPages(out/'directional_analysis_figures.pdf',metadata=metadata) as pdf:pdf.savefig(fig);pdf.savefig(fig2);pdf.savefig(fig3)
plt.close('all')
print('Wrote uncertainty and sensitivity figures: SVG, PDF and PNG; combined vector PDF (three pages).')
