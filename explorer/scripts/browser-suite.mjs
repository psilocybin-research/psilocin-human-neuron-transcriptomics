// One release-suite registry shared by CI and local targeted checks.
export const groups = {
 'research-a':['source','research-integration','shared-r','research-workstation','python-app'],
 'research-b':['scientific-scene-r','research-session','r-variable','workspace-layout','analysis-navigation'],
 ui:['tour','network-introduction','tree','f7-data-surfaces','feedback-notification','plot-layout','systems','smart-select'],
};
export function scripts(group) {
 const selected = groups[group] || (Object.values(groups).flat().includes(group) ? [group] : null);
 if (!selected) throw Error(`Unknown test group: ${group}. Use ${Object.keys(groups).join(', ')} or a registered test name.`);
 return selected.map(name=>`test/${name}-browser-check.mjs`);
}
