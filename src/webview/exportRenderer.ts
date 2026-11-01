import { diagram,highlight } from './diagrams';
(window as any).renderExport = async () => {
  for (const code of document.querySelectorAll<HTMLElement>('pre > code')) {
    const language = [...code.classList].find(name=>name.startsWith('language-'))?.slice(9) ?? '';
    if (language === 'mermaid') { const figure=document.createElement('figure'); figure.innerHTML=await diagram(code.textContent ?? ''); code.parentElement!.replaceWith(figure); }
    else code.innerHTML=highlight(code.textContent ?? '',language);
  }
};
