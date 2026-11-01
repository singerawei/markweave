import { readFile,readdir,writeFile } from 'node:fs/promises';
const lock = JSON.parse(await readFile('package-lock.json','utf8'));
let output = '# Third-party notices\n\nRuntime libraries bundled with MarkdownUP. Build/test tools are excluded.\n';
for (const [directory,info] of Object.entries(lock.packages)) {
  if (!directory || info.dev) continue;
  const metadata = JSON.parse(await readFile(`${directory}/package.json`,'utf8'));
  const files = await readdir(directory); const license = files.find(name => /^licen[cs]e(?:[.-].*)?$/i.test(name));
  output += `\n## ${metadata.name} ${metadata.version}\n\nLicense: ${metadata.license ?? 'See upstream'}\n\n`;
  if (license) output += '```text\n' + (await readFile(`${directory}/${license}`,'utf8')).trim() + '\n```\n';
}
await writeFile('THIRD_PARTY_NOTICES.md',output);
