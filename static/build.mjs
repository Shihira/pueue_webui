import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'

import fs from 'fs';
import path from 'path';

const views = fs.readdirSync(path.join(path.resolve(), 'views'))
    .map((x) => path.parse(x).name)
    .filter((x) => x !== 'index');
const importViews = views.map((x, i) => `import * as view_${i} from './${x}'`);
const exportedViews = views.map((_, i) => `    view_${i}.exportedView,`);

const finalIndex = [
    ...importViews,
    'export const views = [',
    ...exportedViews,
    '];'
].join('\n');

fs.writeFileSync(path.join(path.resolve(), 'views', 'index.tsx'), finalIndex);

await esbuild.build({
    bundle: true,
    entryPoints: ['index.tsx'],
    external: ['*.woff', '*.woff2', '*.jpg', '*.svg', '../../assets*'],
    plugins: [
        sassPlugin()
    ],
    outdir: './dist'
})

