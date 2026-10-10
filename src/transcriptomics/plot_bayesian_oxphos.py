"""Render all frozen prior sensitivities; no favorable model selection."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[2]
T=ROOT/'tables/bayesian_oxphos'
FIG=ROOT/'figures/bayesian_oxphos'

def main():
    manifest=json.loads((ROOT/'provenance/bayesian_oxphos_run.json').read_text())
    p=pd.read_csv(T/'posterior_summary.csv')
    d=pd.read_csv(T/'diagnostics.csv')
    pairs=pd.read_csv(T/'paired_scores.csv')
    baseline=p[p.fit=='normal_effect0.5_residual0.5']
    assert len(p.fit.unique())==10 and len(baseline)==6
    FIG.mkdir(parents=True,exist_ok=True)
    plt.rcParams.update({'font.size':8.5,'svg.fonttype':'none','pdf.fonttype':42})
    fig,ax=plt.subplots(1,3,figsize=(8.2,5.4),sharex=True)
    for j,(parameter,label) in enumerate([('mu_day1_vs_control','Day 1 / common control'),('mu_day3_vs_control','Day 3 / common control'),('treated_day_difference','Treated Day 3 − Day 1')]):
        sub=p[p.parameter==parameter].reset_index(drop=True)
        for i,row in sub.iterrows():
            color='#155e75' if row.fit=='normal_effect0.5_residual0.5' else ('#933f20' if row.likelihood=='student_t4' else '#687782')
            if not row.computationally_valid: color='#b91c1c'
            ax[j].plot([row.lower95,row.upper95],[i,i],color=color,lw=1.4)
            ax[j].plot(row['median'],i,'o',color=color,ms=4)
        ax[j].axvline(0,color='#888888',lw=.7,ls='--')
        ax[j].set_title(label)
        ax[j].set_yticks(range(10),[f'N: {r.effect_sd:g}, {r.residual_sd:g}' if r.likelihood=='normal' else 't₄: 0.5, 0.5' for _,r in sub.iterrows()] if j==0 else [])
        ax[j].invert_yaxis();ax[j].set_xlabel('Difference in mean log₂\n(normalized count + 1)');ax[j].set_xticks([-.5,0,.5])
        ax[j].spines[['top','right']].set_visible(False)
        observed=(pairs.day1_vs_control if j==0 else pairs.day3_vs_control if j==1 else pairs.treated_day3_minus_day1)
        ax[j].plot(observed,[-1]*3,'x',color='black',ms=5)
    ax[0].set_ylabel('Likelihood: effect-prior SD, residual-prior SD')
    fig.suptitle('OXPHOS block-level uncertainty: all declared prior sensitivities',fontsize=12)
    fig.text(.5,.01,'Median and equal-tail 95% credible interval; crosses show observed blocks.\n182 genes per profile; three differentiation blocks across two backgrounds.',ha='center',fontsize=8)
    fig.tight_layout(rect=(0,.07,1,.94))
    for ext in ('pdf','svg','png'):fig.savefig(FIG/f'bayesian_oxphos_intervals.{ext}',dpi=200)

if __name__ == '__main__':
    main()
