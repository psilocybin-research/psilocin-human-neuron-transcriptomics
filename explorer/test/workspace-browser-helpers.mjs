export async function openWorkspaceNavigation(page) {
 const navigation=page.locator('#research-sidebar');
 if(!await navigation.evaluate(n=>n.classList.contains('panel-in-breakpoint')||n.classList.contains('panel-in'))){await page.getByRole('button',{name:'Open section menu',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#research-sidebar')?.dataset.shellModalReady==='true');}
}
export async function selectWorkspace(page,name){const tab=page.getByRole('tab',{name,exact:true});if(!await tab.isVisible())await openWorkspaceNavigation(page);if(['Reports','Projects'].includes(name)){const disclosure=page.getByText('Project & report tools',{exact:true});if(!await tab.isVisible())await disclosure.click();}await tab.click();if(await page.locator('#research-sidebar').evaluate(n=>!n.classList.contains('panel-in-breakpoint')))await page.waitForFunction(()=>document.querySelector('#psilocin-app').dataset.modalOpen!=='true');}
