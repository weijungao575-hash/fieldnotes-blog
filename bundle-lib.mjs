import {createHash} from 'node:crypto';
export function bundleHTML({template,css,sources,assets,content}){
  const prelude=`globalThis.FIELDNOTES_ASSETS=${JSON.stringify(assets)};\nglobalThis.FIELDNOTES_INITIAL_CONTENT=${JSON.stringify(content)};\n`;
  let script=prelude+sources.map(source=>source.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'')).join('\n');
  for(const [path,src] of Object.entries(assets))script=script.replaceAll(`src="${path}"`,`src="${src}"`);
  script=script.replaceAll('</script','<\\/script');
  const hash=createHash('sha256').update(script).digest('base64');
  const csp=`default-src 'self'; script-src 'self' 'sha256-${hash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; form-action 'self'`;
  return template.replace('<!-- CONTENT_SECURITY_POLICY -->',`<meta http-equiv="Content-Security-Policy" content="${csp}">`).replace('<link rel="stylesheet" href="styles.css">',`<style>${css}</style>`).replace('<script type="module" src="app.js"></script>',`<script type="module">${script}</script>`).replace('href="assets/favicon.svg"',`href="${assets['assets/favicon.svg']}"`);
}
